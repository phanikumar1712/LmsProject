const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapDepartment } = require('../utils/formatters');
const { getDepartmentScope } = require('../utils/scope');

// GET /api/departments — list departments (with category + admin counts).
// A department-scoped ADMIN only sees their own department.
const list = async (req, res) => {
    const { scoped, departmentId } = getDepartmentScope(req);
    const where = scoped ? 'WHERE d.id = $1' : '';
    const values = scoped ? [departmentId] : [];
    const result = await query(`
        SELECT d.*,
               (SELECT COUNT(*)::int FROM categories c WHERE c.department_id = d.id) as category_count,
               (SELECT COUNT(*)::int FROM users u WHERE u.department_id = d.id AND u.role IN ('ADMIN','SUPER_ADMIN')) as admin_count
        FROM departments d
        ${where}
        ORDER BY d.name ASC
    `, values);
    res.json(result.rows.map(mapDepartment));
};

// GET /api/departments/public — no auth; minimal list for the signup branch picker.
const publicList = async (req, res) => {
    const result = await query('SELECT id, name, icon FROM departments ORDER BY name ASC');
    res.json(result.rows);
};

// POST /api/departments — SUPER_ADMIN only
const create = async (req, res) => {
    const { name, icon } = req.body;
    if (!name || !name.trim()) throw createError('Department name is required', 400);
    const exists = await query('SELECT id FROM departments WHERE LOWER(name) = LOWER($1)', [name.trim()]);
    if (exists.rows.length) throw createError('Department already exists', 409);
    const result = await query(
        `INSERT INTO departments (name, icon) VALUES ($1, $2) RETURNING *`,
        [name.trim(), icon || '🏛️']
    );
    res.status(201).json(mapDepartment(result.rows[0]));
};

// PUT /api/departments/:id — SUPER_ADMIN only
const update = async (req, res) => {
    const { name, icon } = req.body;
    const result = await query(
        `UPDATE departments SET name = COALESCE($1, name), icon = COALESCE($2, icon) WHERE id = $3 RETURNING *`,
        [name?.trim() || null, icon || null, req.params.id]
    );
    if (!result.rows.length) throw createError('Department not found', 404);
    res.json(mapDepartment(result.rows[0]));
};

// DELETE /api/departments/:id — SUPER_ADMIN only.
// FK is ON DELETE SET NULL, so categories/admins become unassigned (global) rather than breaking.
const remove = async (req, res) => {
    const result = await query('DELETE FROM departments WHERE id = $1 RETURNING id, name', [req.params.id]);
    if (!result.rows.length) throw createError('Department not found', 404);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'DEPARTMENT_DELETED', 'departments', req.params.id,
         JSON.stringify({ name: result.rows[0].name })]
    ).catch(() => {});

    res.json({ success: true });
};

// PUT /api/departments/:id/limits — SUPER_ADMIN sets department-wide student/course quotas.
// A null/blank value clears the override so all admins in this department fall back to the
// global default from platform_settings.
const updateLimits = async (req, res) => {
    const { maxStudents, maxCourses } = req.body;

    const parseLimit = (v, label) => {
        if (v === undefined || v === null || v === '') return null;
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0) throw createError(`${label} must be a non-negative integer`, 400);
        return n;
    };
    const maxStudentsVal = parseLimit(maxStudents, 'maxStudents');
    const maxCoursesVal = parseLimit(maxCourses, 'maxCourses');

    const exists = await query('SELECT id, name FROM departments WHERE id = $1', [req.params.id]);
    if (!exists.rows.length) throw createError('Department not found', 404);

    await query(
        `UPDATE departments SET max_students = $1, max_courses = $2 WHERE id = $3`,
        [maxStudentsVal, maxCoursesVal, req.params.id]
    );

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'DEPARTMENT_LIMITS_UPDATED', 'departments', req.params.id,
         JSON.stringify({ name: exists.rows[0].name, maxStudents: maxStudentsVal, maxCourses: maxCoursesVal })]
    ).catch(() => {});

    res.json({ success: true, maxStudents: maxStudentsVal, maxCourses: maxCoursesVal });
};

module.exports = { list, publicList, create, update, remove, updateLimits };
