const { query } = require('../db/pool');
const { mapNotification } = require('../utils/formatters');

// GET /api/notifications
const getByUser = async (req, res) => {
    const { limit = 20, offset = 0 } = req.query;
    const { getPagination } = require('../utils/pagination');

    const countRes = await query('SELECT COUNT(*)::int as total FROM notifications WHERE user_id = $1', [req.user.id]);
    const total = countRes.rows[0].total;

    const result = await query(
        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [req.user.id, parseInt(limit), parseInt(offset)]
    );

    const pageNum = Math.floor(parseInt(offset) / parseInt(limit)) + 1;

    res.json({
        success: true,
        data: result.rows.map(mapNotification),
        pagination: getPagination(total, pageNum, limit)
    });
};

// PUT /api/notifications/:id/read
const markRead = async (req, res) => {
    await query('UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
};

// PUT /api/notifications/read-all
const markAllRead = async (req, res) => {
    await query('UPDATE notifications SET read = true WHERE user_id = $1', [req.user.id]);
    res.json({ success: true });
};

// DELETE /api/notifications/clear-all
const clearAll = async (req, res) => {
    await query('DELETE FROM notifications WHERE user_id = $1', [req.user.id]);
    res.json({ success: true });
};

// POST /api/notifications
const create = async (req, res) => {
    const { userId, message, type = 'system', link } = req.body;
    const result = await query(
        'INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, message, type, link]
    );
    res.status(201).json(mapNotification(result.rows[0]));
};

module.exports = { getByUser, markRead, markAllRead, clearAll, create };
