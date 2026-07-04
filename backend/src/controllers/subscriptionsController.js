const { getClient, query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapUser } = require('../utils/formatters');

const safeUserFields = `id, name, email, role, avatar, bio, active, subscription_plan, subscription_expiry, earnings, current_streak, longest_streak, created_at`;

const ensureSubscriptionCourseSchema = async (db = { query }) => {
    await db.query(`
        CREATE TABLE IF NOT EXISTS subscription_plan_courses (
            plan_id     UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
            course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            priority    INT NOT NULL DEFAULT 1,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (plan_id, course_id)
        );
    `);
    await db.query(`
        ALTER TABLE subscription_plan_courses
        ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);
    await db.query(`
        CREATE INDEX IF NOT EXISTS idx_subscription_plan_courses_course
        ON subscription_plan_courses(course_id);
    `);
};

// GET /api/subscriptions/plans
const getPlans = async (req, res) => {
    await ensureSubscriptionCourseSchema();
    const result = await query(`
        SELECT sp.*,
               COALESCE(
                   jsonb_agg(
                       jsonb_build_object(
                           'id', c.id,
                           'title', c.title,
                           'thumbnail', c.thumbnail,
                           'status', c.status,
                           'requiredPlan', c.required_plan,
                           'priority', spc.priority
                       )
                       ORDER BY spc.priority ASC
                   ) FILTER (WHERE c.id IS NOT NULL),
                   '[]'::jsonb
               ) AS courses,
               COALESCE(
                   array_agg(c.id ORDER BY spc.priority ASC) FILTER (WHERE c.id IS NOT NULL),
                   '{}'::uuid[]
               ) AS course_ids
        FROM subscription_plans sp
        LEFT JOIN subscription_plan_courses spc ON spc.plan_id = sp.id
        LEFT JOIN courses c ON c.id = spc.course_id
        GROUP BY sp.id
        ORDER BY sp.price ASC
    `);
    res.json(result.rows);
};

const normalizeCourseAssignments = (body) => {
    const raw = Array.isArray(body.courseIds)
        ? body.courseIds
        : Array.isArray(body.courses)
            ? body.courses.map(course => course.id || course.courseId)
            : null;

    if (!raw) return null;

    const seen = new Set();
    return raw
        .map(String)
        .map(courseId => courseId.trim())
        .filter(Boolean)
        .filter(courseId => {
            if (seen.has(courseId)) return false;
            seen.add(courseId);
            return true;
        })
        .map((courseId, index) => ({ courseId, priority: index + 1 }));
};

const syncPlanCourses = async (client, planId, assignments) => {
    if (!assignments) return;

    await client.query('DELETE FROM subscription_plan_courses WHERE plan_id = $1', [planId]);
    if (!assignments.length) return;

    const courseIds = assignments.map(item => item.courseId);
    const existing = await client.query('SELECT id FROM courses WHERE id = ANY($1::uuid[])', [courseIds]);
    if (existing.rows.length !== courseIds.length) {
        throw createError('One or more selected courses no longer exist', 400);
    }

    for (const item of assignments) {
        await client.query(
            `INSERT INTO subscription_plan_courses (plan_id, course_id, priority)
             VALUES ($1, $2, $3)`,
            [planId, item.courseId, item.priority]
        );
    }
};

const getPlanById = async (planId) => {
    const result = await query(`
        SELECT sp.*,
               COALESCE(
                   jsonb_agg(
                       jsonb_build_object(
                           'id', c.id,
                           'title', c.title,
                           'thumbnail', c.thumbnail,
                           'status', c.status,
                           'requiredPlan', c.required_plan,
                           'priority', spc.priority
                       )
                       ORDER BY spc.priority ASC
                   ) FILTER (WHERE c.id IS NOT NULL),
                   '[]'::jsonb
               ) AS courses,
               COALESCE(
                   array_agg(c.id ORDER BY spc.priority ASC) FILTER (WHERE c.id IS NOT NULL),
                   '{}'::uuid[]
               ) AS course_ids
        FROM subscription_plans sp
        LEFT JOIN subscription_plan_courses spc ON spc.plan_id = sp.id
        LEFT JOIN courses c ON c.id = spc.course_id
        WHERE sp.id = $1
        GROUP BY sp.id
    `, [planId]);

    if (!result.rows.length) throw createError('Plan not found', 404);
    return result.rows[0];
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
    const assignments = normalizeCourseAssignments(req.body);
    const client = await getClient();

    try {
        await client.query('BEGIN');
        await ensureSubscriptionCourseSchema(client);

        const result = await client.query(
            `UPDATE subscription_plans 
             SET price = $1, duration = $2, features = $3, updated_at = NOW() 
             WHERE id = $4 RETURNING id`,
            [price, duration, features, id]
        );

        if (!result.rows.length) throw createError('Plan not found', 404);
        await syncPlanCourses(client, id, assignments);

        await client.query(
            `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
            [req.user.id, 'PLAN_UPDATED', 'subscription_plans', id]
        ).catch(() => { });

        await client.query('COMMIT');
        res.json(await getPlanById(id));
    } catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        throw err;
    } finally {
        client.release();
    }
};

// POST /api/subscriptions/plans (Super Admin)
const createPlan = async (req, res) => {
    const { name, price, duration, features, popular } = req.body;
    if (!name || price === undefined) throw createError('Name and price are required', 400);

    const planName = String(name).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const assignments = normalizeCourseAssignments(req.body) || [];
    const client = await getClient();

    try {
        await client.query('BEGIN');
        await ensureSubscriptionCourseSchema(client);

        const result = await client.query(
            `INSERT INTO subscription_plans (name, price, duration, features, popular)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [planName, Number(price), Number(duration) || 30, features || [], Boolean(popular)]
        );
        const planId = result.rows[0].id;

        await syncPlanCourses(client, planId, assignments);
        await client.query(
            `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
            [req.user.id, 'PLAN_CREATED', 'subscription_plans', planId]
        ).catch(() => { });

        await client.query('COMMIT');
        res.status(201).json(await getPlanById(planId));
    } catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        throw err;
    } finally {
        client.release();
    }
};

// DELETE /api/subscriptions/plans/:id (Super Admin)
const deletePlan = async (req, res) => {
    const { id } = req.params;

    // Prevent deleting default plans
    const existing = await query('SELECT name FROM subscription_plans WHERE id = $1', [id]);
    if (!existing.rows.length) throw createError('Plan not found', 404);
    const reserved = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'];
    if (reserved.includes(existing.rows[0].name?.toUpperCase())) {
        throw createError('Cannot delete default plans', 400);
    }

    await query('DELETE FROM subscription_plans WHERE id = $1', [id]);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'PLAN_DELETED', 'subscription_plans', id]
    ).catch(() => { });

    res.json({ success: true });
};

module.exports = { getPlans, upgrade, updatePlan, createPlan, deletePlan, getCategories, createCategory, deleteCategory };
