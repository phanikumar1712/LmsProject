const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapUser } = require('../utils/formatters');

const safeUserFields = `id, name, email, role, avatar, bio, active, subscription_plan, subscription_expiry, earnings, created_at`;

// GET /api/subscriptions/plans
const getPlans = async (req, res) => {
    const result = await query('SELECT * FROM subscription_plans ORDER BY price ASC');
    res.json(result.rows);
};

// POST /api/subscriptions/upgrade
const upgrade = async (req, res) => {
    const { planId } = req.body;
    const plan = await query('SELECT * FROM subscription_plans WHERE id = $1', [planId]);
    if (!plan.rows.length) throw createError('Plan not found', 404);

    const p = plan.rows[0];
    const expiry = p.duration > 0
        ? new Date(Date.now() + p.duration * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : null;

    const userRes = await query(
        `UPDATE users SET subscription_plan = $1, subscription_expiry = $2, updated_at = NOW() WHERE id = $3 RETURNING ${safeUserFields}`,
        [p.name.toUpperCase(), expiry, req.user.id]
    );

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'SUBSCRIPTION_UPGRADED', 'subscription_plans', planId]
    ).catch(() => { });

    await query(
        `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4)`,
        [req.user.id, `Your plan was upgraded to ${p.name}.`, 'subscription', '/student/subscription']
    ).catch(() => { });

    res.json({ success: true, plan: p, user: mapUser(userRes.rows[0]) });
};

// GET /api/categories
const getCategories = async (req, res) => {
    const result = await query(`
        SELECT cat.*, COUNT(c.id) as course_count
        FROM categories cat
        LEFT JOIN courses c ON c.category_id = cat.id AND c.status = 'PUBLISHED'
        GROUP BY cat.id
        ORDER BY cat.name ASC
    `);
    res.json(result.rows);
};

// POST /api/categories (Admin)
const createCategory = async (req, res) => {
    const { name, icon = '📚' } = req.body;
    if (!name) throw createError('Category name is required', 400);
    const result = await query(
        'INSERT INTO categories (name, icon) VALUES ($1,$2) RETURNING *',
        [name, icon]
    );
    res.status(201).json(result.rows[0]);
};

// DELETE /api/categories/:id (Admin)
const deleteCategory = async (req, res) => {
    const result = await query('DELETE FROM categories WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) throw createError('Category not found', 404);
    res.json({ success: true });
};

// PUT /api/subscriptions/plans/:id (Super Admin)
const updatePlan = async (req, res) => {
    const { price, duration, features } = req.body;
    const { id } = req.params;

    const result = await query(
        `UPDATE subscription_plans 
         SET price = $1, duration = $2, features = $3, updated_at = NOW() 
         WHERE id = $4 RETURNING *`,
        [price, duration, features, id]
    );

    if (!result.rows.length) throw createError('Plan not found', 404);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'PLAN_UPDATED', 'subscription_plans', id]
    ).catch(() => { });

    res.json(result.rows[0]);
};

module.exports = { getPlans, upgrade, updatePlan, getCategories, createCategory, deleteCategory };
