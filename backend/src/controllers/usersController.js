const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapUser, mapEnrollment, mapInstructorRequest } = require('../utils/formatters');
const { getDepartmentScope } = require('../utils/scope');
const { getDeptCapacity, notifyLimitReached } = require('../utils/limits');

const safeUserFields = `id, name, email, role, phone, avatar, bio, active, department_id, roll_no, created_at`;

const MAX_IMPORT_ROWS = 500;

// A scoped ADMIN may only view/act on non-admin (STUDENT/INSTRUCTOR) users in
// their own department. Returns the target row or throws 403/404. SUPER_ADMIN and
// unscoped admins are unrestricted.
const assertUserInScope = async (req, userId) => {
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
            conditions.push(`role = $${i++}`);
            values.push(wanted);
        }
    }
    if (search) {
        conditions.push(`(name ILIKE $${i} OR email ILIKE $${i})`);
        values.push(`%${search}%`);
        i++;
    }
    if (status === 'active' || status === 'suspended') {
        conditions.push(`active = $${i++}`);
        values.push(status === 'active');
    }
    if (from) { conditions.push(`created_at >= $${i++}`); values.push(from); }
    if (to) { conditions.push(`created_at <= $${i++}`); values.push(to); }

    if (scoped) {
        conditions.push(`department_id = $${i++} AND role IN ('STUDENT','INSTRUCTOR')`);
        values.push(departmentId);
    } else if (qDepartmentId) {
        // Unscoped (SUPER_ADMIN) may optionally filter to a specific department.
        conditions.push(`department_id = $${i++}`);
        values.push(qDepartmentId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*)::int as total FROM users ${where}`, values);
    const total = countRes.rows[0].total;

    const sql = `
        SELECT ${safeUserFields} 
        FROM users 
        ${where} 
        ORDER BY created_at DESC 
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

    // Authorization + department isolation. Throws 403/404 as appropriate.
    await assertUserInScope(req, req.params.id);

    const target = await query('SELECT id, email, name FROM users WHERE id = $1', [req.params.id]);
    if (!target.rows.length) throw createError('User not found', 404);

    const provided = req.body?.password;
    if (provided !== undefined && provided !== null && provided !== '' && provided.length < 8) {
        throw createError('Password must be at least 8 characters', 400);
    }
    const newPassword = provided && provided.length >= 8 ? provided : crypto.randomBytes(6).toString('hex');
    const hashed = await bcrypt.hash(newPassword, 12);

    await query(
        `UPDATE users SET password = $1, reset_otp = NULL, reset_otp_expiry = NULL, updated_at = NOW() WHERE id = $2`,
        [hashed, req.params.id]
    );

    await query(
        `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)`,
        [req.params.id, 'Your password was reset by an administrator. Please log in and change it.', 'system']
    ).catch(() => { });

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'USER_PASSWORD_RESET', 'users', req.params.id]
    ).catch(() => { });

    // Only echo the password when we generated it (the operator needs to relay it).
    res.json({ success: true, tempPassword: provided ? undefined : newPassword });
};

// PUT /api/users/:id/toggle-status
const toggleStatus = async (req, res) => {
    await assertUserInScope(req, req.params.id);
    const result = await query(
        `UPDATE users SET active = NOT active, updated_at = NOW() WHERE id = $1 RETURNING ${safeUserFields}`,
        [req.params.id]
    );
    if (!result.rows.length) throw createError('User not found', 404);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, result.rows[0].active ? 'USER_ACTIVATED' : 'USER_SUSPENDED', 'users', req.params.id]
    ).catch(() => { });

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
         JOIN users u ON c.instructor_id = u.id
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
    const { name, role, password: providedPassword, phone, departmentId, departmentIds: providedDeptIds } = req.body;
    if (!name || !req.body.email) throw createError('Name and email are required', 400);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) throw createError('Invalid admin role', 400);

    // Normalize email the same way register/login do, so the created admin
    // can actually log in (login looks up by lowercased email).
    const email = req.body.email.trim().toLowerCase();

    const bcrypt = require('bcryptjs');
    const crypto = require('crypto');

    if (providedPassword && providedPassword.length < 8) {
        throw createError('Password must be at least 8 characters', 400);
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

    // Use provided password or generate temp one
    const tempPassword = providedPassword && providedPassword.length >= 8
        ? providedPassword
        : crypto.randomBytes(8).toString('hex');

    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const result = await query(
        `INSERT INTO users (name, email, password, role, department_id, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${safeUserFields}`,
        [name, email, hashedPassword, role, primaryDeptId, String(phone || '').trim()]
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

// Shared: create one user (INSTRUCTOR or STUDENT) with a generated (or provided) temp password.
// Returns { user, tempPassword }. Throws on duplicate email / missing fields.
const createUserRecord = async ({ name, email, phone, departmentId, rollNo, password, role = 'INSTRUCTOR' }) => {
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
                `Student limit reached for this department (${capacity.studentCount}/${capacity.maxStudents}). Ask the Super Admin to raise the limit.`,
                409
            );
        }
    }

    const tempPassword = password && password.length >= 8 ? password : crypto.randomBytes(6).toString('hex');
    const hashed = await bcrypt.hash(tempPassword, 12);
    const result = await query(
        `INSERT INTO users (name, email, password, role, department_id, phone, roll_no) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${safeUserFields}`,
        [String(name).trim(), normEmail, hashed, role, departmentId || null, String(phone || '').trim(), normRollNo]
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
    const { name, email, phone, password } = req.body;
    const departmentId = resolveTargetDepartment(req);
    const { user, tempPassword } = await createInstructorRecord({ name, email, phone, departmentId, password });

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

// POST /api/users/instructors/import — bulk create from CSV/XLSX.
// Columns (case-insensitive): name, email, phone (optional). Returns per-row results.
const importInstructors = async (req, res) => {
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

    const departmentId = resolveTargetDepartment(req);
    const departmentName = await resolveDepartmentName(departmentId);
    // Normalize header keys to lowercase for lookup.
    const pick = (row, key) => {
        const found = Object.keys(row).find(k => k.trim().toLowerCase() === key);
        return found ? row[found] : '';
    };

    const results = [];
    for (const row of rows) {
        const name = pick(row, 'name');
        const email = pick(row, 'email');
        const phone = pick(row, 'phone');
        try {
            const { user, tempPassword } = await createUserRecord({ name, email, phone, departmentId, role: 'INSTRUCTOR' });
            await query(
                `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)`,
                [user.id, 'Your instructor account has been created. Welcome to the platform!', 'system']
            ).catch(() => { });
            await query(
                `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
                [req.user.id, 'INSTRUCTOR_IMPORTED', 'users', user.id]
            ).catch(() => { });
            results.push({ email: user.email, name: user.name, departmentId, departmentName, status: 'created', tempPassword });
        } catch (err) {
            results.push({ email: String(email || '').trim().toLowerCase(), name, departmentId, departmentName, status: 'error', error: err.message });
        }
    }

    const created = results.filter(r => r.status === 'created').length;
    res.status(201).json({ total: results.length, created, failed: results.length - created, departmentId, departmentName, results });
};

// POST /api/users/students/import — bulk create students from CSV/XLSX.
// Columns (case-insensitive): name, email, roll_no (required), phone (optional).
// Returns per-row results.
const importStudents = async (req, res) => {
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

    const departmentId = resolveTargetDepartment(req);
    const departmentName = await resolveDepartmentName(departmentId);

    // Fail fast when the target department is already at its student limit —
    // avoids running the (up to 500-row) loop only to reject every row.
    let importCapacity = null;
    if (departmentId) {
        importCapacity = await getDeptCapacity(departmentId);
        if (importCapacity.studentsAtLimit) {
            await notifyLimitReached(departmentId, 'students', importCapacity);
            const results = rows.map(row => {
                const pickRow = (key) => {
                    const found = Object.keys(row).find(k => k.trim().toLowerCase() === key);
                    return found ? row[found] : '';
                };
                return {
                    email: String(pickRow('email') || '').trim().toLowerCase(),
                    name: pickRow('name'),
                    rollNo: pickRow('roll_no') || pickRow('roll no') || pickRow('rollnumber') || '',
                    departmentId,
                    departmentName,
                    status: 'error',
                    error: `Student limit reached for this department (${importCapacity.studentCount}/${importCapacity.maxStudents}). Ask the Super Admin to raise the limit.`,
                };
            });
            return res.status(201).json({ total: rows.length, created: 0, failed: rows.length, departmentId, departmentName, results });
        }
    }

    // Normalize header keys to lowercase for lookup.
    const pick = (row, key) => {
        const found = Object.keys(row).find(k => k.trim().toLowerCase() === key);
        return found ? row[found] : '';
    };

    const results = [];
    for (const row of rows) {
        const name = pick(row, 'name');
        const email = pick(row, 'email');
        const phone = pick(row, 'phone');
        const rollNo = pick(row, 'roll_no') || pick(row, 'roll no') || pick(row, 'rollnumber') || '';
        try {
            const { user, tempPassword } = await createUserRecord({ name, email, phone, rollNo, departmentId, role: 'STUDENT' });
            await query(
                `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)`,
                [user.id, 'Your student account has been created. Welcome to the platform!', 'system']
            ).catch(() => { });
            await query(
                `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
                [req.user.id, 'STUDENT_IMPORTED', 'users', user.id]
            ).catch(() => { });
            results.push({ email: user.email, name: user.name, rollNo: user.roll_no, departmentId, departmentName, status: 'created', tempPassword });
        } catch (err) {
            results.push({ email: String(email || '').trim().toLowerCase(), name, rollNo, departmentId, departmentName, status: 'error', error: err.message });
        }
    }

    const created = results.filter(r => r.status === 'created').length;
    res.status(201).json({ total: results.length, created, failed: results.length - created, departmentId, departmentName, results });
};

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
        JOIN users u ON c.instructor_id = u.id
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

module.exports = {
    getAll, getById, updateRole, resetUserPassword, toggleStatus, deleteUser,
    submitInstructorRequest, getInstructorRequests, approveInstructorRequest,
    getInstructorProfile, followInstructor, unfollowInstructor, inviteAdmin,
    createInstructor, importInstructors, importStudents,
    setAdminDepartments, getUserDepartments,
    downloadInstructorTemplate, downloadStudentTemplate
};
