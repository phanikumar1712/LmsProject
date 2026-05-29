const { query } = require('../db/pool');
const { mapNotification } = require('../utils/formatters');

// GET /api/notifications
const getByUser = async (req, res) => {
    const result = await query(
        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
        [req.user.id]
    );
    res.json(result.rows.map(mapNotification));
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

module.exports = { getByUser, markRead, markAllRead, clearAll };
