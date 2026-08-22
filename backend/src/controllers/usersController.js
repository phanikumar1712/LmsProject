const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapUser, mapEnrollment, mapInstructorRequest } = require('../utils/formatters');
const { getDepartmentScope } = require('../utils/scope');
const { getDeptCapacity, notifyLimitReached } = require('../utils/limits');
const { PERMISSIONS, ALL_PERMISSIONS, permissionsForRole, applyOverrides, getEffectivePermissions } = require('../utils/permissions');
const { writeAudit } = require('../utils/audit');

const safeUserFields = `id, name, email, role, phone, avatar, bio, active, department_id, roll_no, username, last_login, designation, qualification, specialization, year, semester, section, batch, created_at`;
// Prefixed variant for queries that join the departments table (avoids ambiguous
// unqualified column references once `u` is aliased).
const safeUserFieldsPrefixed = `u.id, u.name, u.email, u.role, u.phone, u.avatar, u.bio, u.active, u.department_id, u.roll_no, u.username, u.last_login, u.designation, u.qualification, u.specialization, u.year, u.semester, u.section, u.batch, u.created_at`;

const MAX_IMPORT_ROWS = 500;

// A scoped ADMIN may only view/act on non-admin (STUDENT/INSTRUCTOR) users in
// their own department. Returns the target row or throws 403/404. SUPER_ADMIN and
// unscoped admins are unrestricted.
const assertUserInScope = async (req, userId) => {
    // Everyone may always view/act on their own account — e.g. a department-scoped
    // admin opening their own user-detail page to change their password. Department
    // isolation protects OTHER departments/admins, never yourself.
    if (userId === req.user.id) return null;
    const { scoped, departmentId } = getDepartmentScope(req);
    if (!scoped) return null;
    const r = await query('SELECT id, role, department_id FROM users WHERE id = $1', [userId]);
    if (!r.rows.length) throw createError('User not found', 404);
    const target = r.rows[0];
    if (['ADMIN', 'SUPER_ADMIN'].includes(target.role) || target.department_id !== departmentId) {
        throw createError('This user is outside your department', 403);
    }
    return target;
};

// GET /api/users
const getAll = async (req, res) => {
    const { limit = 20, offset = 0, search, role, status, from, to, departmentId: qDepartmentId } = req.query;
    const { getPagination } = require('../utils/pagination');

    let conditions = [];
    let values = [];
    let i = 1;

    // Department isolation: a scoped ADMIN sees ONLY students & instructors in
    // their own department (never other admins or other departments).
    const { scoped, departmentId } = getDepartmentScope(req);

    if (role) {
        // A scoped admin may only ever see STUDENT/INSTRUCTOR — silently ignore a
        // role filter outside that set instead of producing a contradictory query.
        const wanted = role.toUpperCase();
        if (!scoped || ['STUDENT', 'INSTRUCTOR'].includes(wanted)) {
            conditions.push(`u.role = $${i++}`);
            values.push(wanted);
        }
    }
    if (search) {
        // Search matches name, email, and roll number (student ID).
        conditions.push(`(u.name ILIKE $${i} OR u.email ILIKE $${i} OR u.roll_no ILIKE $${i})`);
        values.push(`%${search}%`);
        i++;
    }
    if (status === 'active' || status === 'suspended') {
        conditions.push(`u.active = $${i++}`);
        values.push(status === 'active');
    }
    if (from) { conditions.push(`u.created_at >= $${i++}`); values.push(from); }
    if (to) { conditions.push(`u.created_at <= $${i++}`); values.push(to); }

    if (scoped) {
        conditions.push(`u.department_id = $${i++} AND u.role IN ('STUDENT','INSTRUCTOR')`);
        values.push(departmentId);
    } else if (qDepartmentId) {
        // Unscoped (SUPER_ADMIN) may optionally filter to a specific department.
        conditions.push(`u.department_id = $${i++}`);
        values.push(qDepartmentId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*)::int as total FROM users u ${where}`, values);
    const total = countRes.rows[0].total;

    const sql = `
        SELECT ${safeUserFieldsPrefixed}, d.name AS department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        ${where}
        ORDER BY u.created_at DESC
        LIMIT $${i++} OFFSET $${i++}
    `;
    const finalValues = [...values, parseInt(limit), parseInt(offset)];

    const result = await query(sql, finalValues);
    const pageNum = Math.floor(parseInt(offset) / parseInt(limit)) + 1;

    res.json({
        success: true,
        data: result.rows.map(mapUser),
        pagination: getPagination(total, pageNum, limit)
    });
};

// PUT /api/users/:id/role
const updateRole = async (req, res) => {
    const { role, reason, adminPassword } = req.body;
    const validRoles = ['STUDENT', 'INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'];
    if (!validRoles.includes(role)) throw createError('Invalid role', 400);

    if (['ADMIN', 'SUPER_ADMIN'].includes(role) && req.user.role !== 'SUPER_ADMIN') {
        throw createError('Only Super Admin can assign admin roles', 403);
    }

    // A department-scoped admin may only change roles of their own dept's non-admins.
    await assertUserInScope(req, req.params.id);

    // Require the acting admin's own password to authorize a role change.
    if (!adminPassword) throw createError('Your password is required to change roles', 400);
    const bcrypt = require('bcryptjs');
    const adminRow = await query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    if (!adminRow.rows.length) throw createError('Admin account not found', 404);
    const passwordOk = await bcrypt.compare(String(adminPassword), adminRow.rows[0].password);
    if (!passwordOk) throw createError('Incorrect password. Role change aborted.', 403);

    // Fetch the target user's current role before updating
    const targetRes = await query('SELECT name, role FROM users WHERE id = $1', [req.params.id]);
    if (!targetRes.rows.length) throw createError('User not found', 404);
    const oldRole = targetRes.rows[0].role;
    const targetName = targetRes.rows[0].name;

    // Prevent no-op changes
    if (oldRole === role) {
        throw createError('User already has this role', 400);
    }

    const result = await query(
        `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING ${safeUserFields}`,
        [role, req.params.id]
    );
    if (!result.rows.length) throw createError('User not found', 404);

    // Demoting an admin must clear their multi-department junction rows, so a
    // non-admin can never remain associated with more than one department.
    // Only fires when the OLD role was an admin (a promotion to a non-admin
    // role like STUDENT->INSTRUCTOR never had junction rows to clear).
    if (['ADMIN', 'SUPER_ADMIN'].includes(oldRole) && !['ADMIN', 'SUPER_ADMIN'].includes(role)) {
        await query('DELETE FROM admin_departments WHERE user_id = $1', [req.params.id]).catch(() => { });
    }

    // Rich audit log with actor name, target name, old/new roles, reason, and timestamp
    const auditDetails = {
        targetName,
        targetId: req.params.id,
        oldRole,
        newRole: role,
        changedBy: req.user.name,
        changedById: req.user.id,
        reason: reason || '',
        timestamp: new Date().toISOString(),
    };
    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'USER_ROLE_CHANGED', 'users', req.params.id, JSON.stringify(auditDetails)]
    ).catch(err => console.error('[Audit] Failed to log role change:', err.message));

    res.json(mapUser(result.rows[0]));
};

// Limits have moved to departments. See departmentsController.updateLimits.

// PUT /api/users/:id/reset-password — privileged reset by an admin/super-admin.
// Scoping via assertUserInScope: a SUPER_ADMIN (unscoped) may reset anyone incl.
// admins; a department-scoped ADMIN may only reset non-admin users in their own
// department (instructors/students). Generates a temp password unless one is
// provided, and returns it so the operator can hand it to the user.
const resetUserPassword = async (req, res) => {
    const bcrypt = require('bcryptjs');
    const crypto = require('crypto');

    // An ADMIN may never reset their OWN password here — that would bypass the
    // self-service block on /auth/change-password. Admin accounts are only
    // managed by the Super Admin (or a broader-scope admin).
    if (req.user.role === 'ADMIN' && req.params.id === req.user.id) {
        throw createError('Admin passwords are managed by the Super Admin. Please contact them to reset your password.', 403);
    }

    // Authorization + department isolation. Throws 403/404 as appropriate.
    await assertUserInScope(req, req.params.id);

    const target = await query('SELECT id, email, name, role FROM users WHERE id = $1', [req.params.id]);
    if (!target.rows.length) throw createError('User not found', 404);

    // Only the Super Admin may reset ADMIN accounts (department admins cannot
    // reset admins — including admins assigned to their own department).
    if (target.rows[0].role === 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
        throw createError('Only the Super Admin can reset admin passwords', 403);
    }

    const provided = req.body?.password;
    if (provided !== undefined && provided !== null && provided !== '' && provided.length < 8) {
        throw createError('Password must be at least 8 characters', 400);
    }
    const newPassword = provided && provided.length >= 8 ? provided : crypto.randomBytes(6).toString('hex');
    const hashed = await bcrypt.hash(newPassword, 12);

    // force:true marks the account so the user must change their password on
    // next login (must_change_password flag surfaced in auth responses).
    const force = req.body?.force === true;
    await query(
        `UPDATE users SET password = $1, must_change_password = $2, reset_otp = NULL, reset_otp_expiry = NULL, updated_at = NOW() WHERE id = $3`,
        [hashed, force, req.params.id]
    );

    await query(
        `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)`,
        [req.params.id, force
            ? 'Your password was reset by an administrator. You must set a new password on your next login.'
            : 'Your password was reset by an administrator. Please log in and change it.', 'system']
    ).catch(() => { });

    await writeAudit(req, {
        action: 'USER_PASSWORD_RESET',
        resource: 'users',
        resourceId: req.params.id,
        oldValue: { forceChange: false },
        newValue: { forceChange: force, resetBy: req.user.name, resetById: req.user.id },
        details: { targetEmail: target.rows[0].email, targetName: target.rows[0].name, targetRole: target.rows[0].role, forceChange: force },
    });

    // Only echo the password when we generated it (the operator needs to relay it).
    res.json({ success: true, mustChangePassword: force, tempPassword: provided ? undefined : newPassword });
};

// PUT /api/users/:id/toggle-status
// Audit trail records the OLD vs NEW active state plus the target's identity
// (e.g. "CSE Admin suspended student CSE102 — Active → Inactive").
const toggleStatus = async (req, res) => {
    await assertUserInScope(req, req.params.id);
    const target = await query('SELECT id, name, email, roll_no, active FROM users WHERE id = $1', [req.params.id]);
    if (!target.rows.length) throw createError('User not found', 404);
    const oldActive = target.rows[0].active;

    const result = await query(
        `UPDATE users SET active = NOT active, updated_at = NOW() WHERE id = $1 RETURNING ${safeUserFields}`,
        [req.params.id]
    );
    const newActive = result.rows[0].active;
    const newStatus = newActive ? 'Active' : 'Inactive';

    await writeAudit(req, {
        action: newActive ? 'USER_ACTIVATED' : 'USER_SUSPENDED',
        resource: 'users',
        resourceId: req.params.id,
        oldValue: { active: oldActive },
        newValue: { active: newActive },
        details: {
            targetName: target.rows[0].name,
            targetEmail: target.rows[0].email,
            studentId: target.rows[0].roll_no || undefined,
            status: newStatus,
        },
    });

    res.json(mapUser(result.rows[0]));
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
    if (req.params.id === req.user.id) throw createError('Cannot delete your own account', 400);
    await assertUserInScope(req, req.params.id);
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id, name, email', [req.params.id]);
    if (!result.rows.length) throw createError('User not found', 404);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'USER_DELETED', 'users', req.params.id,
         JSON.stringify({ deletedName: result.rows[0].name, deletedEmail: result.rows[0].email })]
    ).catch(err => console.error('[Audit] Failed to log user deletion:', err.message));

    res.json({ success: true });
};

// POST /api/users/students — create a single student manually (admin/super-admin).
// Mirrors createInstructor: scoped admins land in their own department, while a
// SUPER_ADMIN may pick any department via req.body.departmentId.
const createStudent = async (req, res) => {
    const { name, email, phone, password, rollNo, year, semester, section, batch } = req.body;
    const departmentId = resolveTargetDepartment(req);
    const { user, tempPassword } = await createUserRecord({
        name, email, phone, departmentId, rollNo, password, role: 'STUDENT',
        year, semester, section, batch
    });

    await query(
        `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)`,
        [user.id, `Welcome! Your student account was created. Login email: ${user.email}`, 'system']
    ).catch(() => { });
    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'STUDENT_CREATED', 'users', user.id, JSON.stringify({ name, email })]
    ).catch(() => { });

    res.status(201).json({ user: mapUser(user), tempPassword });
};

// PUT /api/users/:id — admin/super-admin edits a user's profile.
// Supports: name, email, phone, rollNo, departmentId, username, active (each
// optional — omitted fields keep their current value). Department isolation is
// enforced: a scoped admin can only edit their own department's
// students/instructors and cannot move them to another department.
const updateUser = async (req, res) => {
    await assertUserInScope(req, req.params.id);
    const { name, email, phone, rollNo, departmentId, username, active, designation, qualification, specialization, year, semester, section, batch } = req.body;

    const target = await query(
        `SELECT id, name, email, role, department_id, roll_no, username, designation, qualification, specialization, year, semester, section, batch FROM users WHERE id = $1`,
        [req.params.id]
    );
    if (!target.rows.length) throw createError('User not found', 404);
    const u = target.rows[0];

    // Only the Super Admin may edit ADMIN/SUPER_ADMIN accounts.
    if (['ADMIN', 'SUPER_ADMIN'].includes(u.role) && req.user.role !== 'SUPER_ADMIN') {
        throw createError('Only the Super Admin can edit admin accounts', 403);
    }

    const newName = name === undefined ? u.name : String(name).trim();
    const newEmail = email === undefined ? u.email : String(email).trim().toLowerCase();
    const newPhone = phone === undefined ? u.phone : String(phone).trim();
    const newRollNo = rollNo === undefined ? u.roll_no : (String(rollNo).trim() || null);
    const newDeptId = departmentId === undefined ? u.department_id : (departmentId || null);
    const newUsername = username === undefined ? u.username : (String(username).trim().toLowerCase() || null);
    const newActive = active === undefined ? null : !!active;
    const newDesignation = designation === undefined ? u.designation : (String(designation).trim() || null);
    const newQualification = qualification === undefined ? u.qualification : (String(qualification).trim() || null);
    const newSpecialization = specialization === undefined ? u.specialization : (String(specialization).trim() || null);
    const numOrNull = v => {
        const n = Number(v);
        return v === undefined || v === null || v === '' || Number.isNaN(n) ? null : Math.max(1, Math.floor(n));
    };
    const newYear = year === undefined ? u.year : numOrNull(year);
    const newSemester = semester === undefined ? u.semester : numOrNull(semester);
    const newSection = section === undefined ? u.section : (section == null ? null : (String(section).trim().toUpperCase() || null));
    const newBatch = batch === undefined ? u.batch : (batch == null ? null : (String(batch).trim() || null));

    if (!newName || !newEmail) throw createError('Name and email are required', 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) throw createError('Invalid email', 400);
    if (newUsername && !/^[a-z0-9._-]{3,}$/.test(newUsername)) {
        throw createError('Username must be 3+ chars of letters, numbers, dots, dashes, or underscores', 400);
    }

    // Scoped admins may not move users across departments.
    const { scoped, departmentId: scopeDeptId } = getDepartmentScope(req);
    if (scoped && newDeptId !== scopeDeptId) {
        throw createError('Scoped admins cannot change a user to a different department', 403);
    }

    if (newEmail !== u.email) {
        const dup = await query('SELECT id FROM users WHERE email = $1 AND id <> $2', [newEmail, req.params.id]);
        if (dup.rows.length) throw createError('Email already in use by another user', 409);
    }
    if (newUsername !== u.username) {
        const dup = await query(
            'SELECT id FROM users WHERE LOWER(username) = $1 AND id <> $2 AND username IS NOT NULL',
            [newUsername, req.params.id]
        );
        if (dup.rows.length) throw createError('Username already in use by another user', 409);
    }
    if (newRollNo && (newRollNo !== u.roll_no || newDeptId !== u.department_id)) {
        const dup = await query(
            `SELECT 1 FROM users WHERE roll_no = $1 AND department_id IS NOT DISTINCT FROM $2::uuid
             AND role = 'STUDENT' AND id <> $3`,
            [newRollNo, newDeptId || null, req.params.id]
        );
        if (dup.rows.length) throw createError('Roll number is already taken in this department', 409);
    }

    const result = await query(
        `UPDATE users SET name = $1, email = $2, phone = $3, roll_no = $4, department_id = $5,
                username = $6, active = COALESCE($7, active),
                designation = $8, qualification = $9, specialization = $10,
                year = $12, semester = $13, section = $14, batch = $15, updated_at = NOW()
         WHERE id = $11 RETURNING ${safeUserFields}`,
        [newName, newEmail, newPhone, newRollNo, newDeptId, newUsername, newActive,
         newDesignation, newQualification, newSpecialization, req.params.id,
         newYear, newSemester, newSection, newBatch]
    );

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'USER_UPDATED', 'users', req.params.id,
         JSON.stringify({ name: newName, email: newEmail, departmentId: newDeptId })]
    ).catch(() => { });

    res.json(mapUser(result.rows[0]));
};

// POST /api/users/bulk/status — batch activate/suspend users (students/instructors).
// A scoped ADMIN may only touch their own department's non-admin users; the
// super admin can update any accounts. Batched so N ids cost one statement.
const bulkToggleStatus = async (req, res) => {
    const { ids, active } = req.body;
    if (!Array.isArray(ids) || !ids.length) throw createError('ids must be a non-empty array', 400);
    if (typeof active !== 'boolean') throw createError('active must be a boolean', 400);

    const safe = [...new Set(ids.map(String))];
    const { scoped, departmentId } = getDepartmentScope(req);
    const result = scoped
        ? await query(
            `UPDATE users SET active = $2, updated_at = NOW()
             WHERE id = ANY($1::uuid[]) AND department_id = $3 AND role IN ('STUDENT','INSTRUCTOR')
             RETURNING id`,
            [safe, active, departmentId])
        : await query(
            `UPDATE users SET active = $2, updated_at = NOW()
             WHERE id = ANY($1::uuid[]) RETURNING id`,
            [safe, active]);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details)
         SELECT $1, $2, 'users', t.id, $4
         FROM unnest($3::uuid[]) AS t(id)`,
        [req.user.id, active ? 'USERS_ACTIVATED' : 'USERS_SUSPENDED', result.rows.map(r => r.id), JSON.stringify({ count: result.rowCount }) ]
    ).catch(() => { });

    res.json({ success: true, updated: result.rowCount });
};

// POST /api/users/bulk/delete — batch delete users. Never allows deleting your own
// account. Scoped admins may only delete their own department's non-admin users.
const bulkDeleteUsers = async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) throw createError('ids must be a non-empty array', 400);

    const safe = [...new Set(ids.map(String))];
    if (safe.includes(String(req.user.id))) throw createError('You cannot delete your own account', 400);

    const { scoped, departmentId } = getDepartmentScope(req);
    const result = scoped
        ? await query(
            `DELETE FROM users WHERE id = ANY($1::uuid[]) AND department_id = $2 AND role IN ('STUDENT','INSTRUCTOR')
             RETURNING id, name`,
            [safe, departmentId])
        : await query(
            `DELETE FROM users WHERE id = ANY($1::uuid[]) RETURNING id, name`,
            [safe]);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details)
         SELECT $1, 'USERS_DELETED', 'users', t.id, $3
         FROM unnest($2::uuid[]) AS t(id)`,
        [req.user.id, result.rows.map(r => r.id), JSON.stringify({ count: result.rowCount })]
    ).catch(() => { });

    res.json({ success: true, deleted: result.rowCount });
};

// POST /api/users/bulk/assign — batch-assign cohort fields (year/semester/section/batch)
// to a set of students. Only the fields provided are changed. Scoped admins are
// limited to their own department's STUDENT accounts (backend-enforced).
const bulkAssignCohort = async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) throw createError('ids must be a non-empty array', 400);

    const fields = {};
    if (req.body.year !== undefined) fields.year = req.body.year;
    if (req.body.semester !== undefined) fields.semester = req.body.semester;
    if (req.body.section !== undefined) fields.section = req.body.section;
    if (req.body.batch !== undefined) fields.batch = req.body.batch;
    if (!Object.keys(fields).length) throw createError('Provide at least one of year, semester, section, or batch', 400);

    const safe = [...new Set(ids.map(String))];
    const { scoped, departmentId } = getDepartmentScope(req);

    // Build the SET clause + params, then the scoped WHERE clause. Placeholders
    // are numbered as we go so no unused params leak into the query (an unused
    // NULL $n with no column to infer its type makes Postgres throw).
    const sets = [];
    const params = [];
    let i = 1;
    for (const [col, val] of Object.entries(fields)) {
        if (col === 'year' || col === 'semester') {
            const n = Number(val);
            const numVal = val === null || val === '' || Number.isNaN(n) ? null : Math.max(1, Math.floor(n));
            sets.push(`${col} = $${i++}`);
            params.push(numVal);
        } else {
            const s = val == null ? null : String(val).trim();
            const norm = col === 'section' ? (s ? s.toUpperCase() : null) : (s || null);
            sets.push(`${col} = $${i++}`);
            params.push(norm);
        }
    }
    sets.push("updated_at = NOW()");

    const where = [`id = ANY($${i++}::uuid[])`, `role = 'STUDENT'`];
    const whereParams = [safe];
    if (scoped) {
        where.push(`department_id = $${i++}`);
        whereParams.push(departmentId);
    }

    const result = await query(
        `UPDATE users SET ${sets.join(', ')}
         WHERE ${where.join(' AND ')}
         RETURNING id`,
        [...params, ...whereParams]);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details)
         SELECT $1, 'STUDENTS_ASSIGNED', 'users', t.id, $3
         FROM unnest($2::uuid[]) AS t(id)`,
        [req.user.id, result.rows.map(r => r.id), JSON.stringify({ count: result.rowCount, fields })]
    ).catch(() => { });

    res.json({ success: true, updated: result.rowCount });
};

// POST /api/users/instructor-request
const submitInstructorRequest = async (req, res) => {
    const { bio, expertise, experience, sampleTopic, linkedin, youtube } = req.body;
    const result = await query(
        `INSERT INTO instructor_requests (user_id, bio, expertise, experience, sample_topic, linkedin, youtube)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [req.user.id, bio, expertise, experience, sampleTopic, linkedin, youtube]
    );
    res.json(mapInstructorRequest(result.rows[0]));
};

// GET /api/users/instructor-requests
const getInstructorRequests = async (req, res) => {
    // A scoped ADMIN only sees requests from applicants in their department.
    const { scoped, departmentId } = getDepartmentScope(req);
    const deptFilter = scoped ? 'AND u.department_id = $1' : '';
    const values = scoped ? [departmentId] : [];
    const result = await query(
        `SELECT ir.*, u.name as user_name, u.email as user_email
         FROM instructor_requests ir
         JOIN users u ON ir.user_id = u.id
         WHERE ir.status = 'PENDING' ${deptFilter}
         ORDER BY ir.created_at DESC`,
        values
    );
    res.json(result.rows.map(mapInstructorRequest));
};

// PUT /api/users/instructor-requests/:id/approve
const approveInstructorRequest = async (req, res) => {
    const { action } = req.body;
    const status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    // Verify the applicant is within a scoped admin's department before mutating.
    const applicant = await query('SELECT user_id FROM instructor_requests WHERE id = $1', [req.params.id]);
    if (!applicant.rows.length) throw createError('Request not found', 404);
    await assertUserInScope(req, applicant.rows[0].user_id);

    const requestRes = await query(
        `UPDATE instructor_requests SET status = $1 WHERE id = $2 RETURNING user_id`,
        [status, req.params.id]
    );

    if (!requestRes.rows.length) throw createError('Request not found', 404);

    if (status === 'APPROVED') {
        const userId = requestRes.rows[0].user_id;
        await query(`UPDATE users SET role = 'INSTRUCTOR', updated_at = NOW() WHERE id = $1`, [userId]);

        await query(
            `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4)`,
            [userId, 'Congratulations! Your instructor application has been approved.', 'approval', '/instructor']
        );
    }

    res.json({ success: true });
};

// GET /api/users/instructor/:id (Public)
const getInstructorProfile = async (req, res) => {
    const instructorId = req.params.id;
    const currentUserId = req.user?.id;

    const userRes = await query(
        `SELECT id, name, avatar, bio, created_at as "joinedAt" 
         FROM users 
         WHERE id = $1 AND role = 'INSTRUCTOR'`,
        [instructorId]
    );

    if (!userRes.rows.length) throw createError('Instructor not found', 404);

    const instructor = userRes.rows[0];

    // Get follower count
    const followersRes = await query('SELECT COUNT(*)::int as total FROM follows WHERE following_id = $1', [instructorId]);
    instructor.followerCount = followersRes.rows[0].total;

    // Check if current user is following
    instructor.isFollowing = false;
    if (currentUserId) {
        const followCheck = await query('SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2', [currentUserId, instructorId]);
        instructor.isFollowing = followCheck.rows.length > 0;
    }

    // Get instructor's courses
    const { mapCourse } = require('../utils/formatters');
    const instructorCoursesFields = `
        c.id, c.title, c.thumbnail,
        c.level, c.rating, c.review_count, c.enrollment_count, c.duration,
        u.name as "instructorName", u.avatar as "instructorAvatar"
    `;

    const coursesRes = await query(
        `SELECT ${instructorCoursesFields}
         FROM courses c
         LEFT JOIN users u ON c.instructor_id = u.id
         WHERE c.instructor_id = $1 AND c.status = 'PUBLISHED'
         ORDER BY c.created_at DESC`,
        [instructorId]
    );

    res.json({
        instructor,
        courses: coursesRes.rows.map(mapCourse)
    });
};

// POST /api/users/instructor/:id/follow
const followInstructor = async (req, res) => {
    const instructorId = req.params.id;
    const followerId = req.user.id;

    if (instructorId === followerId) throw createError('You cannot follow yourself', 400);

    // Check if already following
    const check = await query('SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2', [followerId, instructorId]);
    if (check.rows.length > 0) return res.json({ success: true, message: 'Already following' });

    await query('INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)', [followerId, instructorId]);

    // Optional: Create notification for instructor
    await query(
        'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
        [instructorId, `${req.user.name} started following you!`, 'system']
    );

    res.json({ success: true });
};

// POST /api/users/instructor/:id/unfollow
const unfollowInstructor = async (req, res) => {
    const instructorId = req.params.id;
    const followerId = req.user.id;

    await query('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [followerId, instructorId]);
    res.json({ success: true });
};

// POST /api/users/invite-admin
const inviteAdmin = async (req, res) => {
    const { name, role, password: providedPassword, phone, departmentId, departmentIds: providedDeptIds, username, active } = req.body;
    if (!name || !req.body.email) throw createError('Name and email are required', 400);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) throw createError('Invalid admin role', 400);

    // Normalize email the same way register/login do, so the created admin
    // can actually log in (login looks up by lowercased email).
    const email = req.body.email.trim().toLowerCase();
    // Optional username: lowercased, null when blank, unique case-insensitively.
    const normUsername = (username !== undefined && username !== null && String(username).trim())
        ? String(username).trim().toLowerCase()
        : null;

    const bcrypt = require('bcryptjs');
    const crypto = require('crypto');

    if (providedPassword && providedPassword.length < 8) {
        throw createError('Password must be at least 8 characters', 400);
    }
    if (normUsername && !/^[a-z0-9._-]{3,}$/.test(normUsername)) {
        throw createError('Username must be 3+ chars of letters, numbers, dots, dashes, or underscores', 400);
    }

    // Determine final set of department IDs (merge departmentId + departmentIds array)
    const finalDeptIds = [];
    const seenIds = new Set();
    const addDeptId = (id) => {
        if (id && !seenIds.has(id)) {
            seenIds.add(id);
            finalDeptIds.push(id);
        }
    };
    if (departmentId) addDeptId(departmentId);
    if (Array.isArray(providedDeptIds)) {
        providedDeptIds.forEach(id => addDeptId(id));
    }

    // Validate all department IDs exist
    if (finalDeptIds.length > 0) {
        const valid = await query('SELECT id FROM departments WHERE id = ANY($1::uuid[])', [finalDeptIds]);
        if (valid.rows.length !== finalDeptIds.length) {
            throw createError('One or more department IDs are invalid', 400);
        }
    }

    // Primary department (first in the list, or null)
    const primaryDeptId = finalDeptIds.length > 0 ? finalDeptIds[0] : null;

    // Check if user exists
    const checkUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (checkUser.rows.length) throw createError('User already exists', 409);
    if (normUsername) {
        const userTaken = await query('SELECT id FROM users WHERE LOWER(username) = $1', [normUsername]);
        if (userTaken.rows.length) throw createError('Username already in use', 409);
    }

    // Use provided password or generate temp one
    const tempPassword = providedPassword && providedPassword.length >= 8
        ? providedPassword
        : crypto.randomBytes(8).toString('hex');

    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const result = await query(
        `INSERT INTO users (name, email, password, role, department_id, phone, username, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${safeUserFields}`,
        [name, email, hashedPassword, role, primaryDeptId, String(phone || '').trim(), normUsername, active === false ? false : true]
    );

    // Insert multi-department assignments
    if (finalDeptIds.length > 1) {
        const extraDepts = finalDeptIds.slice(1); // Skip the first — it's the primary
        if (extraDepts.length > 0) {
            const vals = extraDepts.map((_, i) => `($1, $${i + 2})`).join(', ');
            await query(
                `INSERT INTO admin_departments (user_id, department_id) VALUES ${vals}`,
                [result.rows[0].id, ...extraDepts]
            );
        }
    }

    await query(
        `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)`,
        [result.rows[0].id, `Welcome to the platform! Your login email: ${email}`, 'system']
    );

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'ADMIN_CREATED', 'users', result.rows[0].id]
    ).catch(() => { });

    res.status(201).json(mapUser(result.rows[0]));
};

// Parse a CSV/XLSX buffer into row objects (shared by import + preview).
const parseSheetFile = (req) => {
    if (!req.file || !req.file.buffer) throw createError('No file uploaded', 400);
    const xlsx = require('xlsx');
    let rows;
    try {
        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    } catch {
        throw createError('Could not parse file. Upload a valid CSV or Excel file.', 400);
    }
    if (!rows.length) throw createError('The file has no rows', 400);
    if (rows.length > MAX_IMPORT_ROWS) throw createError(`File exceeds maximum of ${MAX_IMPORT_ROWS} rows`, 400);
    return rows;
};

// Case-insensitive column picker (headers may be "Name", "NAME", "name", ...).
const pickCell = (row, key) => {
    const found = Object.keys(row).find(k => k.trim().toLowerCase() === key);
    return found ? row[found] : '';
};

// Resolve each row's target department. A "Department" column (matched by name,
// case-insensitive) is honored for SUPER_ADMINs (multi-department files); rows
// without the column fall back to the admin's configured target. Scoped admins
// are locked to their own department and get an error if the column names a
// different one. Unknown names are per-row errors, never a silent import.
const resolveRowDepartments = async (req, rows) => {
    const { scoped, departmentId } = getDepartmentScope(req);
    const fallbackId = departmentId ?? resolveTargetDepartment(req);
    const fallbackName = await resolveDepartmentName(fallbackId);

    const names = [...new Set(
        rows.map(r => String(pickCell(r, 'department') || '').trim().toLowerCase()).filter(Boolean)
    )];
    const deptMap = new Map(); // lower(name) → { id, name }
    if (names.length) {
        const res = await query('SELECT id, name FROM departments WHERE LOWER(name) = ANY($1::text[])', [names]);
        res.rows.forEach(d => deptMap.set(d.name.toLowerCase(), d));
    }

    return rows.map(row => {
        const col = String(pickCell(row, 'department') || '').trim();
        if (!col) return { departmentId: fallbackId, departmentName: fallbackName, error: null };
        const found = deptMap.get(col.toLowerCase());
        if (!found) return { departmentId: fallbackId, departmentName: fallbackName, error: `Unknown department: ${col}` };
        if (scoped && fallbackId && found.id !== fallbackId) {
            return { departmentId: fallbackId, departmentName: fallbackName, error: `Department mismatch: you can only import into ${fallbackName || 'your department'}` };
        }
        return { departmentId: found.id, departmentName: found.name, error: null };
    });
};

// Batched bulk user creation for imports. Replaces the per-row createUserRecord
// loop (which issued ~4-6 queries per row — email check, roll check, capacity,
// INSERT, notification, audit — i.e. up to ~3,000 queries for a 500-row file)
// with a constant ~5 queries: two pre-fetch SELECTs, one bulk INSERT with
// ON CONFLICT (email) DO NOTHING, one batched notification insert, and one
// batched audit insert. Per-row outcome semantics (messages + statuses) are
// preserved; results come back in the original row order. With `preview: true`
// the exact same validation/classification runs but nothing is hashed or
// written — valid rows are marked status 'ok' so the UI can show exactly what
// the real import will do.
const bulkCreateUsers = async ({ rows, role, departmentId, actorId, preview = false }) => {
    const bcrypt = require('bcryptjs');
    const crypto = require('crypto');
    const isStudent = role === 'STUDENT';
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // 1) Normalize + format-validate each row (no DB involved).
    const numOrNull = v => {
        const n = Number(v);
        return v === undefined || v === null || v === '' || Number.isNaN(n) ? null : Math.max(1, Math.floor(n));
    };
    const normalized = rows.map((row, index) => {
        const name = String(row.name || '').trim();
        const email = String(row.email || '').trim().toLowerCase();
        const phone = String(row.phone || '').trim();
        const rollNo = isStudent ? String(row.rollNo || '').trim() || null : null;
        const year = isStudent ? numOrNull(row.year) : null;
        const semester = isStudent ? numOrNull(row.semester) : null;
        const section = isStudent ? (String(row.section || '').trim().toUpperCase() || null) : null;
        const batch = isStudent ? (String(row.batch || '').trim() || null) : null;
        let error = null;
        if (!name || !email) error = 'Name and email are required';
        else if (!EMAIL_RE.test(email)) error = 'Invalid email';
        else if (isStudent && !rollNo) error = 'Roll number is required for student accounts';
        return { index, name, email, phone, rollNo, year, semester, section, batch, error };
    });

    // 2) Pre-fetch existing emails + roll numbers (2 queries total, was N each).
    const emails = [...new Set(normalized.filter(r => !r.error).map(r => r.email))];
    const existingEmails = new Set();
    if (emails.length) {
        const res = await query('SELECT email FROM users WHERE email = ANY($1::text[])', [emails]);
        res.rows.forEach(r => existingEmails.add(r.email));
    }
    const rolls = isStudent
        ? [...new Set(normalized.filter(r => !r.error && r.rollNo).map(r => r.rollNo))]
        : [];
    const existingRolls = new Set();
    if (rolls.length) {
        const res = await query(
            `SELECT roll_no FROM users WHERE roll_no = ANY($1) AND role = 'STUDENT'
             AND department_id IS NOT DISTINCT FROM $2::uuid`,
            [rolls, departmentId || null]
        );
        res.rows.forEach(r => existingRolls.add(r.roll_no));
    }

    // 3) Classify duplicates (file-internal + DB) and hash temp passwords.
    const seenEmails = new Set();
    const seenRolls = new Set();
    const toInsert = []; // { index, name, email, phone, rollNo, hashed, tempPassword }
    const results = new Array(rows.length).fill(null);
    const markError = (r, error) => {
        results[r.index] = { status: 'error', error, email: r.email, name: r.name, rollNo: r.rollNo };
    };

    for (const r of normalized) {
        if (r.error) { markError(r, r.error); continue; }
        if (seenEmails.has(r.email) || existingEmails.has(r.email)) {
            markError(r, 'User already exists');
            continue;
        }
        if (isStudent && r.rollNo && (seenRolls.has(r.rollNo) || existingRolls.has(r.rollNo))) {
            markError(r, 'Roll number is already taken in this department');
            continue;
        }
        seenEmails.add(r.email);
        if (r.rollNo) seenRolls.add(r.rollNo);
        if (preview) {
            results[r.index] = { status: 'ok', email: r.email, name: r.name, rollNo: r.rollNo };
            continue;
        }
        const tempPassword = crypto.randomBytes(6).toString('hex');
        toInsert.push({
            index: r.index, name: r.name, email: r.email, phone: r.phone, rollNo: r.rollNo,
            year: r.year, semester: r.semester, section: r.section, batch: r.batch,
            hashed: await bcrypt.hash(tempPassword, 12), tempPassword,
        });
    }

    // Preview stops here — the classification above is identical to the real
    // import, so what the user approves is exactly what will be created.
    if (preview) return results;

    // 4) One bulk INSERT; ON CONFLICT (email) DO NOTHING guards email races.
    const createdByEmail = new Map();
    if (toInsert.length) {
        const names = [], emailsArr = [], hashes = [], phones = [], rollNos = [], years = [], semesters = [], sections = [], batches = [];
        for (const u of toInsert) {
            names.push(u.name); emailsArr.push(u.email); hashes.push(u.hashed);
            phones.push(u.phone); rollNos.push(u.rollNo);
            years.push(u.year); semesters.push(u.semester); sections.push(u.section); batches.push(u.batch);
        }
        const bulkSql = `
            INSERT INTO users (name, email, password, role, department_id, phone, roll_no, year, semester, section, batch)
            SELECT t.name, t.email, t.password, $1::user_role, $2::uuid, t.phone, t.roll_no, t.year, t.semester, t.section, t.batch
            FROM unnest($3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::int[], $9::int[], $10::text[], $11::text[])
                 AS t(name, email, password, phone, roll_no, year, semester, section, batch)
            ON CONFLICT (email) DO NOTHING
            RETURNING id, email
        `;
        const bulkParams = [role, departmentId || null, names, emailsArr, hashes, phones, rollNos, years, semesters, sections, batches];
        let insertedRows = [];
        try {
            const res = await query(bulkSql, bulkParams);
            insertedRows = res.rows;
        } catch (bulkErr) {
            // ON CONFLICT (email) only guards email races, so the only 23505 the
            // bulk statement can raise is a roll_no race against the partial
            // unique index (idx_users_roll_no_dept). Fall back to per-row inserts
            // in that case — one conflicting row must never sink the entire
            // import (preserves the old per-row behavior). Any other failure is
            // systemic; rethrow it instead of pointlessly retrying every row.
            if (bulkErr.code !== '23505') throw bulkErr;
            for (const u of toInsert) {
                try {
                    const one = await query(
                        `INSERT INTO users (name, email, password, role, department_id, phone, roll_no, year, semester, section, batch)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                         ON CONFLICT (email) DO NOTHING
                         RETURNING id, email`,
                        [u.name, u.email, u.hashed, role, departmentId || null, u.phone, u.rollNo, u.year, u.semester, u.section, u.batch]
                    );
                    if (one.rows.length) insertedRows.push(one.rows[0]);
                    else results[u.index] = { status: 'error', error: 'User already exists', email: u.email, name: u.name, rollNo: u.rollNo };
                } catch (rowErr) {
                    // Roll-no (or other constraint) race on this row only.
                    results[u.index] = {
                        status: 'error',
                        error: rowErr.code === '23505' ? 'Roll number is already taken in this department' : rowErr.message,
                        email: u.email, name: u.name, rollNo: u.rollNo,
                    };
                }
            }
        }
        insertedRows.forEach(r => createdByEmail.set(r.email, r.id));
    }

    // 5) Batched notifications + audit logs for the created users.
    const createdUsers = toInsert.filter(u => createdByEmail.has(u.email));
    if (createdUsers.length) {
        const ids = createdUsers.map(u => createdByEmail.get(u.email));
        const welcome = isStudent
            ? 'Your student account has been created. Welcome to the platform!'
            : 'Your instructor account has been created. Welcome to the platform!';
        await query(
            `INSERT INTO notifications (user_id, message, type)
             SELECT t.id, $1, 'system' FROM unnest($2::uuid[]) AS t(id)`,
            [welcome, ids]
        ).catch(() => { });
        await query(
            `INSERT INTO audit_logs (user_id, action, resource, resource_id)
             SELECT $1, $2, 'users', t.id FROM unnest($3::uuid[]) AS t(id)`,
            [actorId, isStudent ? 'STUDENT_IMPORTED' : 'INSTRUCTOR_IMPORTED', ids]
        ).catch(() => { });
    }

    // 6) Assemble results in original row order (rows already classified by the
    // per-row fallback in step 4 are left untouched).
    for (const u of toInsert) {
        if (results[u.index]) continue;
        const id = createdByEmail.get(u.email);
        results[u.index] = id
            ? { status: 'created', email: u.email, name: u.name, rollNo: u.rollNo, tempPassword: u.tempPassword }
            : { status: 'error', error: 'User already exists', email: u.email, name: u.name, rollNo: u.rollNo };
    }
    return results;
};

// Shared: create one user (INSTRUCTOR or STUDENT) with a generated (or provided) temp password.
// Returns { user, tempPassword }. Throws on duplicate email / missing fields.
const createUserRecord = async ({ name, email, phone, departmentId, rollNo, password, role = 'INSTRUCTOR', designation, qualification, specialization, year, semester, section, batch }) => {
    const bcrypt = require('bcryptjs');
    const crypto = require('crypto');
    if (!name || !email) throw createError('Name and email are required', 400);
    const normEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) throw createError('Invalid email', 400);

    const exists = await query('SELECT id FROM users WHERE email = $1', [normEmail]);
    if (exists.rows.length) throw createError('User already exists', 409);

    // Roll number: required for STUDENT, must be unique per department.
    const normRollNo = String(rollNo || '').trim() || null;
    if (role === 'STUDENT' && !normRollNo) {
        throw createError('Roll number is required for student accounts', 400);
    }
    if (normRollNo) {
        // Friendly check before DB unique index throws a terse constraint violation.
        // department_id is a uuid column — use IS NOT DISTINCT FROM with a uuid-typed
        // param so NULLs compare equal (same department intent) without a uuid = text
        // type error. A roll number may repeat across different departments.
        const dupRoll = await query(
            `SELECT 1 FROM users WHERE roll_no = $1 AND department_id IS NOT DISTINCT FROM $2::uuid AND role = 'STUDENT'`,
            [normRollNo, departmentId || null]
        );
        if (dupRoll.rows.length) throw createError('Roll number is already taken in this department', 409);
    }

    // Department student-limit enforcement: adding a STUDENT to a department
    // that has reached its max_students quota is blocked, and the dept admins +
    // super admins are notified for a limit-review discussion.
    if (role === 'STUDENT' && departmentId) {
        const capacity = await getDeptCapacity(departmentId);
        if (capacity.studentsAtLimit) {
            await notifyLimitReached(departmentId, 'students', capacity);
            throw createError(
                `Student limit reached: this department has ${capacity.studentCount} students and the limit is ${capacity.maxStudents}. You can't add more students until a Super Admin raises the limit.`,
                409
            );
        }
    }

    const tempPassword = password && password.length >= 8 ? password : crypto.randomBytes(6).toString('hex');
    const hashed = await bcrypt.hash(tempPassword, 12);
    const numOrNull = v => {
        const n = Number(v);
        return v === undefined || v === null || v === '' || Number.isNaN(n) ? null : Math.max(1, Math.floor(n));
    };
    const result = await query(
        `INSERT INTO users (name, email, password, role, department_id, phone, roll_no, designation, qualification, specialization, year, semester, section, batch)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING ${safeUserFields}`,
        [String(name).trim(), normEmail, hashed, role, departmentId || null, String(phone || '').trim(), normRollNo,
         String(designation || '').trim() || null, String(qualification || '').trim() || null, String(specialization || '').trim() || null,
         numOrNull(year), numOrNull(semester), String(section || '').trim().toUpperCase() || null, String(batch || '').trim() || null]
    );
    return { user: result.rows[0], tempPassword };
};

// PUT /api/users/:id/departments — SUPER_ADMIN batch-assigns departments to an
// admin user. Replaces all assignments atomically. Expects { departmentIds: [...] }.
// The primary department (users.department_id) is updated to match the first ID
// in the array (or NULL if the array is empty).
const setAdminDepartments = async (req, res) => {
    const { departmentIds } = req.body;
    if (!Array.isArray(departmentIds)) {
        throw createError('departmentIds must be an array', 400);
    }

    // Verify the target user is an admin
    const target = await query('SELECT id, role, department_id FROM users WHERE id = $1', [req.params.id]);
    if (!target.rows.length) throw createError('User not found', 404);
    if (target.rows[0].role === 'SUPER_ADMIN') {
        throw createError('Super Admins cannot be department-bound', 400);
    }
    if (target.rows[0].role !== 'ADMIN') {
        throw createError('Only admin users can be assigned to departments', 400);
    }

    // Validate all department IDs exist
    if (departmentIds.length > 0) {
        const valid = await query('SELECT id FROM departments WHERE id = ANY($1::uuid[])', [departmentIds]);
        if (valid.rows.length !== departmentIds.length) {
            throw createError('One or more department IDs are invalid', 400);
        }
    }

    const client = await query.pool.connect();
    try {
        await client.query('BEGIN');

        // Remove all existing extra assignments
        await client.query('DELETE FROM admin_departments WHERE user_id = $1', [req.params.id]);

        // Insert new assignments
        if (departmentIds.length > 0) {
            const values = departmentIds.map((_, i) => `($1, $${i + 2})`).join(', ');
            await client.query(
                `INSERT INTO admin_departments (user_id, department_id) VALUES ${values}`,
                [req.params.id, ...departmentIds]
            );
        }

        // Update the primary department (first in the list, or NULL if none)
        const primaryDept = departmentIds.length > 0 ? departmentIds[0] : null;
        await client.query(
            'UPDATE users SET department_id = $1, updated_at = NOW() WHERE id = $2',
            [primaryDept, req.params.id]
        );

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'ADMIN_DEPARTMENTS_UPDATED', 'users', req.params.id, JSON.stringify({ departmentIds })]
    ).catch(() => { });

    res.json({ success: true, departmentIds });
};

// GET /api/users/:id/departments — get all departments assigned to a user
// (from the admin_departments junction table).
const getUserDepartments = async (req, res) => {
    const target = await query('SELECT id, role FROM users WHERE id = $1', [req.params.id]);
    if (!target.rows.length) throw createError('User not found', 404);

    const extra = await query(`
        SELECT d.id, d.name, d.icon FROM admin_departments ad
        JOIN departments d ON ad.department_id = d.id
        WHERE ad.user_id = $1
        ORDER BY d.name ASC
    `, [req.params.id]);

    res.json(extra.rows);
};

// Alias for backward compatibility
const createInstructorRecord = (opts) => createUserRecord({ ...opts, role: 'INSTRUCTOR' });

// Target department for admin-created instructors: a scoped admin's own dept;
// super-admin may pass a departmentId (else global/null).
const resolveTargetDepartment = (req) => {
    const { scoped, departmentId } = getDepartmentScope(req);
    return scoped ? departmentId : (req.body.departmentId || null);
};

// Resolve a department's display name (used to show the target department on
// bulk-import result pages). Returns null when there is no department.
const resolveDepartmentName = async (departmentId) => {
    if (!departmentId) return null;
    const r = await query('SELECT name FROM departments WHERE id = $1', [departmentId]);
    return r.rows.length ? r.rows[0].name : null;
};

// POST /api/users/instructors — create a single instructor manually.
const createInstructor = async (req, res) => {
    const { name, email, phone, password, designation, qualification, specialization } = req.body;
    const departmentId = resolveTargetDepartment(req);
    const { user, tempPassword } = await createInstructorRecord({ name, email, phone, departmentId, password, designation, qualification, specialization });

    await query(
        `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)`,
        [user.id, `Welcome! Your instructor account was created. Login email: ${user.email}`, 'system']
    ).catch(() => { });
    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'INSTRUCTOR_CREATED', 'users', user.id]
    ).catch(() => { });

    res.status(201).json({ user: mapUser(user), tempPassword });
};

// GET /api/users/instructors/template — download an Excel template for importing instructors.
const downloadInstructorTemplate = async (req, res) => {
    const xlsx = require('xlsx');
    const wb = xlsx.utils.book_new();
    const data = [
        { name: 'John Doe', email: 'john.doe@example.com', phone: '9876543210' },
    ];
    const ws = xlsx.utils.json_to_sheet(data);
    // Set column widths
    ws['!cols'] = [{ wch: 30 }, { wch: 35 }, { wch: 18 }];
    xlsx.utils.book_append_sheet(wb, ws, 'Instructors');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="Instructor_Import_Template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
};

// GET /api/users/students/template — download an Excel template for importing students.
const downloadStudentTemplate = async (req, res) => {
    const xlsx = require('xlsx');
    const wb = xlsx.utils.book_new();
    const data = [
        { name: 'Jane Doe', email: 'jane.doe@example.com', roll_no: 'CS22001', phone: '9876543210' },
    ];
    const ws = xlsx.utils.json_to_sheet(data);
    // Set column widths
    ws['!cols'] = [{ wch: 30 }, { wch: 35 }, { wch: 16 }, { wch: 18 }];
    xlsx.utils.book_append_sheet(wb, ws, 'Students');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="Student_Import_Template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
};

// Shared runner for instructor/student imports AND previews. When `preview` is
// true no rows are created — the response is the exact per-row validation the
// confirm import will perform, so the UI can show errors before anyone commits.
// Supports an optional "Department" column (by name) so a SUPER_ADMIN can import
// multiple departments in one file; scoped admins stay locked to their own dept.
const runUserImport = async (req, res, { role, preview = false }) => {
    const rows = parseSheetFile(req);
    const isStudent = role === 'STUDENT';
    const deptRows = await resolveRowDepartments(req, rows);

    // Group rows by resolved department so each group uses the batched insert
    // with a single department id (keeps multi-department files efficient).
    const groups = new Map();
    rows.forEach((row, i) => {
        const key = String(deptRows[i].departmentId ?? '');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ row, index: i, dept: deptRows[i] });
    });

    const results = new Array(rows.length).fill(null);
    let firstDeptId = null;
    let firstDeptName = null;

    for (const group of groups.values()) {
        const { departmentId, departmentName } = group[0].dept;
        firstDeptId = firstDeptId ?? departmentId;
        firstDeptName = firstDeptName ?? departmentName;

        // Per-row department resolution errors (unknown / out-of-scope names).
        const deptErrorRows = group.filter(g => g.dept.error);
        deptErrorRows.forEach(g => {
            results[g.index] = {
                email: String(pickCell(g.row, 'email') || '').trim().toLowerCase(),
                name: pickCell(g.row, 'name'),
                rollNo: isStudent ? (pickCell(g.row, 'student id') || pickCell(g.row, 'roll_no') || pickCell(g.row, 'roll no') || pickCell(g.row, 'rollnumber') || '') : undefined,
                departmentId,
                departmentName,
                status: 'error',
                error: g.dept.error,
            };
        });
        const validGroup = group.filter(g => !g.dept.error);
        if (!validGroup.length) continue;

        // Student imports fail fast at the department's student limit.
        if (isStudent && departmentId) {
            const capacity = await getDeptCapacity(departmentId);
            if (capacity.studentsAtLimit) {
                await notifyLimitReached(departmentId, 'students', capacity);
                validGroup.forEach(g => {
                    results[g.index] = {
                        email: String(pickCell(g.row, 'email') || '').trim().toLowerCase(),
                        name: pickCell(g.row, 'name'),
                        rollNo: pickCell(g.row, 'student id') || pickCell(g.row, 'roll_no') || pickCell(g.row, 'roll no') || pickCell(g.row, 'rollnumber') || '',
                        departmentId,
                        departmentName,
                        status: 'error',
                        error: `Student limit reached: this department has ${capacity.studentCount} students and the limit is ${capacity.maxStudents}. You can't add more students until a Super Admin raises the limit.`,
                    };
                });
                continue;
            }
        }

        const bulkResults = await bulkCreateUsers({
            rows: validGroup.map(g => {
                const row = g.row;
                const base = {
                    name: pickCell(row, 'name'),
                    email: pickCell(row, 'email'),
                    phone: pickCell(row, 'phone'),
                };
                if (isStudent) {
                    base.rollNo = pickCell(row, 'student id') || pickCell(row, 'roll_no') || pickCell(row, 'roll no') || pickCell(row, 'rollnumber') || '';
                    base.year = pickCell(row, 'year');
                    base.semester = pickCell(row, 'semester');
                    base.section = pickCell(row, 'section');
                    base.batch = pickCell(row, 'batch');
                }
                return base;
            }),
            role,
            departmentId,
            actorId: req.user.id,
            preview,
        });
        bulkResults.forEach((r, i) => {
            results[validGroup[i].index] = { ...r, departmentId, departmentName };
        });
    }

    const created = results.filter(r => r.status === 'created').length;
    const failed = results.filter(r => r.status === 'error').length;
    const ok = results.filter(r => r.status === 'ok').length;
    res.status(201).json({
        total: results.length,
        created,
        failed,
        ok,
        preview,
        departmentId: firstDeptId,
        departmentName: firstDeptName,
        results,
    });
};

// POST /api/users/instructors/import — bulk create from CSV/XLSX.
const importInstructors = async (req, res) => runUserImport(req, res, { role: 'INSTRUCTOR' });

// POST /api/users/instructors/preview — validate without creating.
const previewInstructors = async (req, res) => runUserImport(req, res, { role: 'INSTRUCTOR', preview: true });

// POST /api/users/students/import — bulk create students from CSV/XLSX.
const importStudents = async (req, res) => runUserImport(req, res, { role: 'STUDENT' });

// POST /api/users/students/preview — validate without creating.
const previewStudents = async (req, res) => runUserImport(req, res, { role: 'STUDENT', preview: true });

// GET /api/users/:id — full user detail for Admin/Super Admin/Instructor
const getById = async (req, res) => {
    const { id } = req.params;

    // Department isolation check (for admins)
    await assertUserInScope(req, id);

    // Instructors may only view students enrolled in their courses
    if (req.user.role === 'INSTRUCTOR') {
        const check = await query(`
            SELECT 1 FROM enrollments e
            JOIN courses c ON e.course_id = c.id
            WHERE e.student_id = $1 AND c.instructor_id = $2
            LIMIT 1
        `, [id, req.user.id]);
        if (!check.rows.length && id !== req.user.id) {
            throw createError('You can only view students enrolled in your courses', 403);
        }
    }

    // Get user record
    const userRes = await query(`SELECT ${safeUserFields} FROM users WHERE id = $1`, [id]);
    if (!userRes.rows.length) throw createError('User not found', 404);
    const user = mapUser(userRes.rows[0]);

    // Get department name
    if (user.departmentId) {
        const deptRes = await query('SELECT name FROM departments WHERE id = $1', [user.departmentId]);
        user.departmentName = deptRes.rows.length ? deptRes.rows[0].name : null;
    }

    // Get enrollments with progress
    const enrollmentsRes = await query(`
        SELECT e.*, c.title, c.thumbnail, c.level, c.duration,
               u.name as "instructorName", u.avatar as "instructorAvatar"
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        LEFT JOIN users u ON c.instructor_id = u.id
        WHERE e.student_id = $1
        ORDER BY e.last_accessed DESC NULLS LAST
    `, [id]);
    user.enrollments = enrollmentsRes.rows.map(mapEnrollment);

    // Get quiz attempts stats
    const quizStatsRes = await query(`
        SELECT COUNT(*)::int as "totalAttempts",
               COUNT(*) FILTER (WHERE passed = true)::int as "passedAttempts",
               COALESCE(AVG(score), 0)::numeric(5,1) as "avgScore"
        FROM quiz_attempts WHERE student_id = $1
    `, [id]);
    user.quizStats = quizStatsRes.rows[0] || { totalAttempts: 0, passedAttempts: 0, avgScore: 0 };

    // Get certificates
    const certRes = await query(`
        SELECT id, cert_id, course_title, issue_date
        FROM certificates WHERE student_id = $1
        ORDER BY issue_date DESC
    `, [id]);
    user.certificates = certRes.rows;

    // Get reviews given
    const reviewRes = await query(`
        SELECT r.id, r.stars, r.comment, r.created_at,
               c.id as "course_id", c.title as "course_title"
        FROM ratings r
        JOIN courses c ON r.course_id = c.id
        WHERE r.student_id = $1
        ORDER BY r.created_at DESC
    `, [id]);
    user.reviews = reviewRes.rows.map(r => ({
        id: r.id,
        stars: r.stars,
        comment: r.comment,
        createdAt: r.created_at,
        course: { id: r.course_id, title: r.course_title }
    }));

    // Get streak data
    const streakRes = await query(`
        SELECT current_streak, longest_streak
        FROM users WHERE id = $1
    `, [id]);
    user.currentStreak = streakRes.rows[0]?.current_streak || 0;
    user.longestStreak = streakRes.rows[0]?.longest_streak || 0;

    // Get follower count (if instructor)
    if (user.role === 'INSTRUCTOR') {
        const followersRes = await query('SELECT COUNT(*)::int as total FROM follows WHERE following_id = $1', [id]);
        user.followerCount = followersRes.rows[0].total;
    }

    // Get total courses created (if instructor)
    if (['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        const coursesRes = await query('SELECT COUNT(*)::int as total FROM courses WHERE instructor_id = $1', [id]);
        user.coursesCreated = coursesRes.rows[0].total;
    }

    res.json({ success: true, data: user });
};

// ── GRANULAR PERMISSION MANAGEMENT (SUPER ADMIN) ────────────────────────────

// GET /api/users/:id/permissions — effective permission list for a user:
// role-matrix defaults + per-user overrides. Lets the Super Admin see exactly
// what a user can do before deciding what to grant/revoke.
const getUserPermissions = async (req, res) => {
    const target = await query('SELECT id, name, email, role FROM users WHERE id = $1', [req.params.id]);
    if (!target.rows.length) throw createError('User not found', 404);
    const u = target.rows[0];

    const overrideRes = await query('SELECT permission, granted FROM user_permissions WHERE user_id = $1', [u.id]);
    const overrides = new Map(overrideRes.rows.map(r => [r.permission, r.granted]));

    const base = u.role === 'SUPER_ADMIN' ? [...ALL_PERMISSIONS] : permissionsForRole(u.role);
    const effective = applyOverrides(base, overrides).permissions;

    res.json({
        user: { id: u.id, name: u.name, email: u.email, role: u.role },
        rolePermissions: base,
        overrides: Object.fromEntries(overrides),
        effective,
    });
};

// PUT /api/users/:id/permissions — replace a user's permission overrides.
// Body: { permissions: { 'grade.update': true, 'course.delete': false } }
//   true  → grant a permission the role doesn't have by default
//   false → revoke a permission the role has by default
// Pass an empty object {} to clear all overrides. SUPER_ADMIN users always hold
// every permission and cannot be overridden (can't be locked out).
const updateUserPermissions = async (req, res) => {
    const { permissions } = req.body;
    if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
        throw createError('permissions must be an object like { "grade.update": true }', 400);
    }

    const target = await query('SELECT id, name, email, role FROM users WHERE id = $1', [req.params.id]);
    if (!target.rows.length) throw createError('User not found', 404);
    const u = target.rows[0];
    if (u.role === 'SUPER_ADMIN') {
        throw createError('Super Admin already holds every permission', 400);
    }
    if (u.id === req.user.id) {
        throw createError('You cannot change your own permissions', 400);
    }

    // Validate keys against the registry; unknown keys are silently dropped.
    const entries = Object.entries(permissions).filter(([p, v]) => PERMISSIONS[p] && typeof v === 'boolean');
    const prevOverrides = await query('SELECT permission, granted FROM user_permissions WHERE user_id = $1', [u.id]);
    const prevMap = Object.fromEntries(prevOverrides.rows.map(r => [r.permission, r.granted]));

    for (const [perm, granted] of entries) {
        await query(
            `INSERT INTO user_permissions (user_id, permission, granted, granted_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, permission)
             DO UPDATE SET granted = EXCLUDED.granted, granted_by = EXCLUDED.granted_by, created_at = NOW()`,
            [u.id, perm, granted, req.user.id]
        );
    }

    const finalRes = await query('SELECT permission, granted FROM user_permissions WHERE user_id = $1', [u.id]);
    const finalOverrides = new Map(finalRes.rows.map(r => [r.permission, r.granted]));
    const effective = applyOverrides(permissionsForRole(u.role), finalOverrides).permissions;

    await writeAudit(req, {
        action: 'PERMISSIONS_UPDATED',
        resource: 'users',
        resourceId: u.id,
        oldValue: { overrides: prevMap },
        newValue: { overrides: Object.fromEntries(entries) },
        details: { targetName: u.name, targetEmail: u.email, targetRole: u.role },
    });

    res.json({ success: true, overrides: Object.fromEntries(finalOverrides), effective });
};

module.exports = {
    getAll, getById, updateRole, resetUserPassword, toggleStatus, deleteUser,
    createStudent, updateUser, bulkToggleStatus, bulkDeleteUsers, bulkAssignCohort,
    submitInstructorRequest, getInstructorRequests, approveInstructorRequest,
    getInstructorProfile, followInstructor, unfollowInstructor, inviteAdmin,
    createInstructor, importInstructors, previewInstructors, importStudents, previewStudents,
    setAdminDepartments, getUserDepartments,
    downloadInstructorTemplate, downloadStudentTemplate,
    getUserPermissions, updateUserPermissions,
};
