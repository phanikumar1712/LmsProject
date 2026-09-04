const { query, pool } = require('../db/pool');
const { getDepartmentScope } = require('../utils/permissions');
const { writeAudit } = require('../utils/audit');

// POST /api/support/requests — create a new support request
const createRequest = async (req, res) => {
    const { requestType, subject, message, priority = 'medium' } = req.body;

    if (!subject || !subject.trim()) return res.status(400).json({ error: 'Subject is required' });
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });
    if (!requestType) return res.status(400).json({ error: 'Request type is required' });

    const result = await query(
        `INSERT INTO support_requests (user_id, request_type, subject, message, priority)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.user.id, requestType, subject.trim(), message.trim(), priority]
    );

    const request = result.rows[0];

    // Notify all SUPER_ADMIN users
    const admins = await query(`SELECT id FROM users WHERE role = 'SUPER_ADMIN' AND active = true`);
    if (admins.rows.length) {
        const values = admins.rows.map((a, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ');
        const params = admins.rows.flatMap(a => [
            a.id,
            `[Support] ${req.user.name} submitted a ${requestType.replace(/_/g, ' ')} request: ${subject.trim()}`,
            'support',
            `/super-admin/support`,
        ]);
        await query(
            `INSERT INTO notifications (user_id, message, type, link) VALUES ${values}`,
            params
        ).catch(() => {}); // non-fatal
    }

    // Audit log
    await writeAudit(req, {
        action: 'SUPPORT_REQUEST_CREATED',
        resource: 'support_requests',
        resource_id: request.id,
        newValue: { requestType, subject: subject.trim(), priority },
        details: { requestType, subject: subject.trim(), priority },
    }).catch(() => {});

    res.status(201).json({
        success: true,
        data: {
            id: request.id,
            requestType: request.request_type,
            subject: request.subject,
            message: request.message,
            status: request.status,
            priority: request.priority,
            createdAt: request.created_at,
        },
    });
};

// GET /api/support/requests — list requests (SUPER_ADMIN sees all, others see own)
const listRequests = async (req, res) => {
    const { status, limit = 50, offset = 0 } = req.query;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';

    let whereClause = '';
    const params = [];

    if (isSuperAdmin) {
        if (status) {
            whereClause = 'WHERE sr.status = $1';
            params.push(status);
        }
    } else {
        if (status) {
            whereClause = 'WHERE sr.user_id = $1 AND sr.status = $2';
            params.push(req.user.id, status);
        } else {
            whereClause = 'WHERE sr.user_id = $1';
            params.push(req.user.id);
        }
    }

    const countRes = await query(
        `SELECT COUNT(*)::int as total FROM support_requests sr ${whereClause}`,
        params
    );
    const total = countRes.rows[0].total;

    const result = await query(
        `SELECT sr.*, u.name AS user_name, u.email AS user_email, u.role AS user_role,
                u.department_id AS user_department_id,
                d.name AS department_name,
                r.name AS responder_name
         FROM support_requests sr
         JOIN users u ON sr.user_id = u.id
         LEFT JOIN departments d ON d.id = u.department_id
         LEFT JOIN users r ON sr.responded_by = r.id
         ${whereClause}
         ORDER BY sr.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
        success: true,
        data: result.rows.map(r => ({
            id: r.id,
            userId: r.user_id,
            userName: r.user_name,
            userEmail: r.user_email,
            userRole: r.user_role,
            departmentName: r.department_name,
            requestType: r.request_type,
            subject: r.subject,
            message: r.message,
            status: r.status,
            priority: r.priority,
            adminResponse: r.admin_response,
            responderName: r.responder_name,
            respondedAt: r.responded_at,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        })),
        pagination: { total, limit: parseInt(limit), offset: parseInt(offset) },
    });
};

// GET /api/support/requests/:id
const getRequest = async (req, res) => {
    const result = await query(
        `SELECT sr.*, u.name AS user_name, u.email AS user_email, u.role AS user_role,
                d.name AS department_name,
                r.name AS responder_name
         FROM support_requests sr
         JOIN users u ON sr.user_id = u.id
         LEFT JOIN departments d ON d.id = u.department_id
         LEFT JOIN users r ON sr.responded_by = r.id
         WHERE sr.id = $1`,
        [req.params.id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Request not found' });

    const r = result.rows[0];
    // Non-super-admins can only see their own requests
    if (req.user.role !== 'SUPER_ADMIN' && r.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
        success: true,
        data: {
            id: r.id,
            userId: r.user_id,
            userName: r.user_name,
            userEmail: r.user_email,
            userRole: r.user_role,
            departmentName: r.department_name,
            requestType: r.request_type,
            subject: r.subject,
            message: r.message,
            status: r.status,
            priority: r.priority,
            adminResponse: r.admin_response,
            responderName: r.responder_name,
            respondedAt: r.responded_at,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        },
    });
};

// PUT /api/support/requests/:id/respond — SUPER_ADMIN responds
const respondToRequest = async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Only Super Admin can respond' });

    const { status, adminResponse } = req.body;
    if (!adminResponse || !adminResponse.trim()) return res.status(400).json({ error: 'Response is required' });

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const result = await query(
        `UPDATE support_requests
         SET status = COALESCE($1, status),
             admin_response = $2,
             responded_by = $3,
             responded_at = NOW(),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [status || 'IN_PROGRESS', adminResponse.trim(), req.user.id, req.params.id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Request not found' });

    const r = result.rows[0];

    // Notify the requester
    await query(
        `INSERT INTO notifications (user_id, message, type, link)
         VALUES ($1, $2, 'support', '/admin/settings')`,
        [r.user_id, `[Support] Your request "${r.subject}" has been responded to. Status: ${r.status}`]
    ).catch(() => {});

    res.json({
        success: true,
        data: {
            id: r.id,
            status: r.status,
            adminResponse: r.admin_response,
            respondedAt: r.responded_at,
        },
    });
};

// GET /api/support/stats — counts for super admin dashboard
const getStats = async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Access denied' });

    const result = await query(
        `SELECT status, COUNT(*)::int as count FROM support_requests GROUP BY status`
    );

    const stats = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0, total: 0 };
    result.rows.forEach(r => {
        stats[r.status] = r.count;
        stats.total += r.count;
    });

    res.json({ success: true, data: stats });
};

module.exports = { createRequest, listRequests, getRequest, respondToRequest, getStats };
