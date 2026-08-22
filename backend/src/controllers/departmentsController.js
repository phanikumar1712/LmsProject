const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapDepartment } = require('../utils/formatters');
const { getDepartmentScope } = require('../utils/scope');
const { writeAudit } = require('../utils/audit');

// ── Field normalization ───────────────────────────────────────────────────────
// Accepts both camelCase (frontend) and snake_case payloads, and trims strings.
const pickText = (body, key) => {
    const raw = body[key] ?? body[key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()];
    return raw === undefined || raw === null ? null : String(raw).trim();
};

// GET /api/departments — list departments (with user/course/admin counts).
// A department-scoped ADMIN only sees their own department.
const list = async (req, res) => {
    const { scoped, departmentId } = getDepartmentScope(req);
    const where = scoped ? 'WHERE d.id = $1' : '';
    const values = scoped ? [departmentId] : [];
    const result = await query(`
        SELECT d.*,
               (SELECT COUNT(*)::int FROM categories c WHERE c.department_id = d.id) as category_count,
               (SELECT COUNT(*)::int FROM users u WHERE u.department_id = d.id AND u.role = 'STUDENT') as student_count,
               (SELECT COUNT(*)::int FROM users u WHERE u.department_id = d.id AND u.role = 'INSTRUCTOR') as instructor_count,
               (SELECT COUNT(*)::int FROM courses co JOIN categories cat ON co.category_id = cat.id
                WHERE cat.department_id = d.id AND co.status NOT IN ('REJECTED', 'ARCHIVED')) as course_count,
               (SELECT COUNT(*)::int FROM users u WHERE u.department_id = d.id AND u.role IN ('ADMIN','SUPER_ADMIN')) as admin_count
        FROM departments d
        ${where}
        ORDER BY d.name ASC
    `, values);
    res.json(result.rows.map(mapDepartment));
};

// GET /api/departments/public — no auth; minimal list for the signup branch picker.
// Inactive departments are hidden so new users can't register into a disabled branch.
const publicList = async (req, res) => {
    const result = await query('SELECT id, name, icon FROM departments WHERE active = true ORDER BY name ASC');
    res.json(result.rows);
};

// POST /api/departments — SUPER_ADMIN only
const create = async (req, res) => {
    const name = pickText(req.body, 'name');
    if (!name) throw createError('Department name is required', 400);

    const code = (pickText(req.body, 'code') || '').toUpperCase();
    const description = pickText(req.body, 'description') || '';
    const hod = pickText(req.body, 'hod') || '';
    const contactEmail = pickText(req.body, 'contactEmail') || '';
    const contactNumber = pickText(req.body, 'contactNumber') || '';
    const icon = pickText(req.body, 'icon') || '🏛️';
    const active = req.body.active !== false; // default active

    const exists = await query(
        'SELECT id FROM departments WHERE LOWER(name) = LOWER($1)',
        [name]
    );
    if (exists.rows.length) throw createError('Department already exists', 409);
    if (code) {
        const codeExists = await query('SELECT id FROM departments WHERE code = $1', [code]);
        if (codeExists.rows.length) throw createError('Department code already in use', 409);
    }

    const result = await query(
        `INSERT INTO departments (name, icon, code, description, hod, contact_email, contact_number, active)
         VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6, $7, $8) RETURNING *`,
        [name, icon, code, description, hod, contactEmail, contactNumber, active]
    );

    await writeAudit(req, {
        action: 'DEPARTMENT_CREATED',
        resource: 'departments',
        resourceId: result.rows[0].id,
        newValue: { name, code, active },
        details: { name, code },
    });

    res.status(201).json(mapDepartment(result.rows[0]));
};

// PUT /api/departments/:id — SUPER_ADMIN only. COALESCE keeps existing values
// when a field is omitted; empty strings intentionally clear text fields.
const update = async (req, res) => {
    const name = pickText(req.body, 'name');
    const icon = pickText(req.body, 'icon');
    const codeRaw = pickText(req.body, 'code');
    const code = codeRaw === null ? null : (codeRaw || '').toUpperCase();
    const description = pickText(req.body, 'description');
    const hod = pickText(req.body, 'hod');
    const contactEmail = pickText(req.body, 'contactEmail');
    const contactNumber = pickText(req.body, 'contactNumber');
    const active = req.body.active === undefined ? null : !!req.body.active;

    if (code) {
        const clash = await query(
            'SELECT id FROM departments WHERE code = $1 AND id <> $2',
            [code, req.params.id]
        );
        if (clash.rows.length) throw createError('Department code already in use', 409);
    }

    // Capture the pre-edit row so the audit trail records OLD → NEW values for
    // every field the admin changed (or the whole row when details matter).
    const before = await query(
        `SELECT id, name, icon, code, description, hod, contact_email, contact_number, active
         FROM departments WHERE id = $1`,
        [req.params.id]
    );
    if (!before.rows.length) throw createError('Department not found', 404);
    const old = before.rows[0];

    // code: '' clears the code back to NULL (consistent with the other text
    // fields, and NULL never collides with the partial unique index).
    const result = await query(
        `UPDATE departments SET
            name = COALESCE($1, name),
            icon = COALESCE($2, icon),
            code = CASE WHEN $3::varchar IS NULL THEN code WHEN $3::varchar = '' THEN NULL ELSE $3::varchar END,
            description = COALESCE($4, description),
            hod = COALESCE($5, hod),
            contact_email = COALESCE($6, contact_email),
            contact_number = COALESCE($7, contact_number),
            active = COALESCE($8, active)
         WHERE id = $9 RETURNING *`,
        [name, icon, code, description, hod, contactEmail, contactNumber, active, req.params.id]
    );
    if (!result.rows.length) throw createError('Department not found', 404);

    await writeAudit(req, {
        action: 'DEPARTMENT_UPDATED',
        resource: 'departments',
        resourceId: req.params.id,
        oldValue: {
            name: old.name, code: old.code, active: old.active,
            description: old.description, hod: old.hod,
            contactEmail: old.contact_email, contactNumber: old.contact_number,
        },
        newValue: {
            name: result.rows[0].name, code: result.rows[0].code, active: result.rows[0].active,
            description: result.rows[0].description, hod: result.rows[0].hod,
            contactEmail: result.rows[0].contact_email, contactNumber: result.rows[0].contact_number,
        },
        details: { name: result.rows[0].name },
    });

    res.json(mapDepartment(result.rows[0]));
};

// PUT /api/departments/:id/status — SUPER_ADMIN activates/deactivates a department.
const updateStatus = async (req, res) => {
    const { active } = req.body;
    if (typeof active !== 'boolean') throw createError('active must be a boolean', 400);

    const result = await query(
        'UPDATE departments SET active = $1 WHERE id = $2 RETURNING id, name, active',
        [active, req.params.id]
    );
    if (!result.rows.length) throw createError('Department not found', 404);

    await writeAudit(req, {
        action: active ? 'DEPARTMENT_ACTIVATED' : 'DEPARTMENT_DEACTIVATED',
        resource: 'departments',
        resourceId: req.params.id,
        oldValue: { active: !active },
        newValue: { active },
        details: { name: result.rows[0].name },
    });

    res.json({ success: true, id: result.rows[0].id, active: result.rows[0].active });
};

// DELETE /api/departments/:id — SUPER_ADMIN only.
// FK is ON DELETE SET NULL, so categories/admins/users become unassigned (global)
// rather than breaking. Guarded so a department with live content can't be
// removed silently.
const remove = async (req, res) => {
    const exists = await query(
        `SELECT d.id, d.name,
                (SELECT COUNT(*)::int FROM users u WHERE u.department_id = d.id) AS user_count,
                (SELECT COUNT(*)::int FROM courses co JOIN categories cat ON co.category_id = cat.id
                 WHERE cat.department_id = d.id) AS course_count
         FROM departments d WHERE d.id = $1`,
        [req.params.id]
    );
    if (!exists.rows.length) throw createError('Department not found', 404);
    const { name, user_count, course_count } = exists.rows[0];
    if (user_count > 0 || course_count > 0) {
        throw createError(
            `Cannot delete "${name}" — it still has ${user_count} user(s) and ${course_count} course(s). Move or remove them first.`,
            409
        );
    }

    const result = await query('DELETE FROM departments WHERE id = $1 RETURNING id, name', [req.params.id]);
    if (!result.rows.length) throw createError('Department not found', 404);

    await writeAudit(req, {
        action: 'DEPARTMENT_DELETED',
        resource: 'departments',
        resourceId: req.params.id,
        oldValue: { name: result.rows[0].name },
        details: { name: result.rows[0].name },
    });

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

    const exists = await query(
        `SELECT id, name, max_students, max_courses FROM departments WHERE id = $1`,
        [req.params.id]
    );
    if (!exists.rows.length) throw createError('Department not found', 404);

    await query(
        `UPDATE departments SET max_students = $1, max_courses = $2 WHERE id = $3`,
        [maxStudentsVal, maxCoursesVal, req.params.id]
    );

    await writeAudit(req, {
        action: 'DEPARTMENT_LIMITS_UPDATED',
        resource: 'departments',
        resourceId: req.params.id,
        oldValue: { maxStudents: exists.rows[0].max_students, maxCourses: exists.rows[0].max_courses },
        newValue: { maxStudents: maxStudentsVal, maxCourses: maxCoursesVal },
        details: { name: exists.rows[0].name },
    });

    res.json({ success: true, maxStudents: maxStudentsVal, maxCourses: maxCoursesVal });
};

module.exports = { list, publicList, create, update, updateStatus, remove, updateLimits };
