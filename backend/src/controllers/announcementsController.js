const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { getDepartmentScope } = require('../utils/scope');

// GET /api/announcements — list announcements (department-scoped admin sees their dept)
const list = async (req, res) => {
    const { scoped, departmentId } = getDepartmentScope(req);

    let where = '';
    const values = [];

    if (req.user.role === 'INSTRUCTOR' || req.user.role === 'STUDENT') {
        // Instructors/students see announcements from their own department
        where = 'WHERE a.department_id = $1 OR a.department_id IS NULL';
        values.push(req.user.department_id);
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

    // Create notifications for all department users if department-scoped
    if (scoped || departmentId) {
        const deptUsers = await query(
            'SELECT id FROM users WHERE department_id = $1 AND role = ANY($2) AND active = true',
            [scoped ? departmentId : departmentId, targetRoles]
        );
        for (const user of deptUsers.rows) {
            await query(
                `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4)`,
                [user.id, `📢 New announcement: ${title}`, 'announcement', '/announcements']
            ).catch(() => {});
        }
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

module.exports = { list, create, update, remove };
