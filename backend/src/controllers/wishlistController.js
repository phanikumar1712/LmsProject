const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapCourse } = require('../utils/formatters');

// GET /api/wishlist
const getWishlist = async (req, res) => {
    const userId = req.params.userId || req.user.id;
    const { limit = 20, offset = 0 } = req.query;
    const { getPagination } = require('../utils/pagination');

    const countRes = await query('SELECT COUNT(*)::int as total FROM wishlist WHERE user_id = $1', [userId]);
    const total = countRes.rows[0].total;

    const result = await query(`
        SELECT w.added_at,
               c.id, c.title, c.thumbnail,
               c.rating, c.level, c.enrollment_count, c.review_count, c.duration, c.status,
               u.name as "instructorName", u.avatar as "instructorAvatar",
               cat.name as "categoryName", cat.id as "categoryId"
        FROM wishlist w
        JOIN courses c ON w.course_id = c.id
        JOIN users u ON c.instructor_id = u.id
        LEFT JOIN categories cat ON c.category_id = cat.id
        WHERE w.user_id = $1
        ORDER BY w.added_at DESC
        LIMIT $2 OFFSET $3
    `, [userId, parseInt(limit), parseInt(offset)]);

    const pageNum = Math.floor(parseInt(offset) / parseInt(limit)) + 1;

    res.json({
        success: true,
        data: result.rows.map(r => mapCourse({
            ...r,
            instructorId: null,
            categoryIcon: null,
        })),
        pagination: getPagination(total, pageNum, limit)
    });
};

// POST /api/wishlist/toggle
const toggle = async (req, res) => {
    const { courseId } = req.body;
    if (!courseId) throw createError('courseId is required', 400);

    const existing = await query('SELECT * FROM wishlist WHERE user_id = $1 AND course_id = $2', [req.user.id, courseId]);
    if (existing.rows.length) {
        await query('DELETE FROM wishlist WHERE user_id = $1 AND course_id = $2', [req.user.id, courseId]);
    } else {
        await query('INSERT INTO wishlist (user_id, course_id) VALUES ($1,$2)', [req.user.id, courseId]);
    }

    const result = await query('SELECT course_id FROM wishlist WHERE user_id = $1', [req.user.id]);
    res.json(result.rows.map(r => r.course_id));
};

module.exports = { getWishlist, toggle };
