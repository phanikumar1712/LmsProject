const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { getDepartmentScope } = require('../utils/scope');

// GET /api/announcements — list announcements (department-scoped admin sees their dept)
const list = async (req, res) => {
    const { scoped, departmentId } = getDepartmentScope(req);

    const showAll = req.query.all === 'true';

    let where = '';
    const values = [];

    if (showAll) {
        // Bypass role filtering — show all announcements the user can possibly see
        // based on their department scope.
        where = scoped ? 'WHERE a.department_id = $1' : '';
        if (scoped) values.push(departmentId);
    } else if (req.user.role === 'STUDENT') {
        // Students see announcements meant for STUDENT role (or legacy with no roles set)
        where = 'WHERE (a.target_roles IS NULL OR $1 = ANY(a.target_roles)) AND (a.department_id IS NULL OR a.department_id = $2)';
        values.push('STUDENT');
        values.push(req.user.department_id || null);
    } else if (req.user.role === 'INSTRUCTOR') {
        // Instructors see announcements meant for INSTRUCTOR role (or legacy with no roles set)
        where = 'WHERE (a.target_roles IS NULL OR $1 = ANY(a.target_roles)) AND (a.department_id IS NULL OR a.department_id = $2)';
        values.push('INSTRUCTOR');
        values.push(req.user.department_id || null);
    } else if (scoped) {
        where = 'WHERE a.department_id = $1';
        values.push(departmentId);
    }

    const result = await query(`
        SELECT a.*, u.name as author_name, u.avatar as author_avatar
        FROM announcements a
        LEFT JOIN users u ON a.author_id = u.id
        ${where}
        ORDER BY a.pinned DESC, a.created_at DESC
        LIMIT 50
    `, values);

    res.json(result.rows.map(a => ({
        ...a,
        authorName: a.author_name,
        authorAvatar: a.author_avatar,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
    })));
};

// POST /api/announcements — create announcement
const create = async (req, res) => {
    const { title, content, priority = 'normal', pinned = false, targetRoles = ['STUDENT', 'INSTRUCTOR'] } = req.body;
    if (!title || !content) throw createError('Title and content are required', 400);

    const { scoped, departmentId } = getDepartmentScope(req);

    const result = await query(`
        INSERT INTO announcements (department_id, author_id, title, content, priority, pinned, target_roles)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `, [scoped ? departmentId : null, req.user.id, title, content, priority, pinned, targetRoles]);

    // Create notifications for target users. Department-scoped admins notify
    // their department; global admins/super-admins notify all matching roles.
    const targetUsers = scoped
        ? await query(
            'SELECT id FROM users WHERE department_id = $1 AND role = ANY($2) AND active = true',
            [departmentId, targetRoles]
        )
        : await query(
            'SELECT id FROM users WHERE role = ANY($1) AND active = true',
            [targetRoles]
        );
    const announcementLink = `/announcements?focus=${result.rows[0].id}`;
    for (const user of targetUsers.rows) {
        await query(
            `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4)`,
            [user.id, `📢 New announcement: ${title}`, 'announcement', announcementLink]
        ).catch(() => {});
    }

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'ANNOUNCEMENT_CREATED', 'announcements', result.rows[0].id]
    ).catch(() => {});

    res.status(201).json(result.rows[0]);
};

// PUT /api/announcements/:id — update announcement
const update = async (req, res) => {
    const { title, content, priority, pinned, targetRoles } = req.body;
    const result = await query(`
        UPDATE announcements
        SET title = COALESCE($1, title),
            content = COALESCE($2, content),
            priority = COALESCE($3, priority),
            pinned = COALESCE($4, pinned),
            target_roles = COALESCE($5, target_roles),
            updated_at = NOW()
        WHERE id = $6
        RETURNING *
    `, [title, content, priority, pinned, targetRoles, req.params.id]);
    if (!result.rows.length) throw createError('Announcement not found', 404);
    res.json(result.rows[0]);
};

// DELETE /api/announcements/:id
const remove = async (req, res) => {
    const result = await query('DELETE FROM announcements WHERE id = $1 RETURNING id, title', [req.params.id]);
    if (!result.rows.length) throw createError('Announcement not found', 404);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'ANNOUNCEMENT_DELETED', 'announcements', req.params.id,
         JSON.stringify({ title: result.rows[0].title })]
    ).catch(() => {});

    res.json({ success: true });
};

// POST /api/announcements/:id/mark-read — mark announcement as read by current user
const markRead = async (req, res) => {
    // Only increment view_count when the user hasn't already read this announcement.
    // The CTE ensures the INSERT and conditional UPDATE are atomic.
    await query(`
        WITH inserted AS (
            INSERT INTO announcement_reads (announcement_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT (announcement_id, user_id) DO NOTHING
            RETURNING 1 AS is_new
        )
        UPDATE announcements SET view_count = view_count + (
            SELECT CASE WHEN EXISTS (SELECT 1 FROM inserted) THEN 1 ELSE 0 END
        )
        WHERE id = $1
    `, [req.params.id, req.user.id]);

    res.json({ success: true });
};

// GET /api/announcements/:id/reads — get read receipts (admin only)
const getReads = async (req, res) => {
    const result = await query(`
        SELECT ar.read_at, u.id as user_id, u.name, u.avatar, u.role,
               COALESCE(u.department_id::text, '') as department_id
        FROM announcement_reads ar
        JOIN users u ON ar.user_id = u.id
        WHERE ar.announcement_id = $1
        ORDER BY ar.read_at DESC
        LIMIT 200
    `, [req.params.id]);

    res.json({
        total: result.rows.length,
        readers: result.rows.map(r => ({
            userId: r.user_id,
            name: r.name,
            avatar: r.avatar,
            role: r.role,
            departmentId: r.department_id,
            readAt: r.read_at,
        })),
    });
};

module.exports = { list, create, update, remove, markRead, getReads };
