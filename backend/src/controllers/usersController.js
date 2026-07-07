const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapUser, mapInstructorRequest } = require('../utils/formatters');
const { getDepartmentScope } = require('../utils/scope');

const safeUserFields = `id, name, email, role, phone, avatar, bio, active, subscription_plan, subscription_expiry, earnings, department_id, created_at`;

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
    const { role } = req.body;
    const validRoles = ['STUDENT', 'INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'];
    if (!validRoles.includes(role)) throw createError('Invalid role', 400);

    if (['ADMIN', 'SUPER_ADMIN'].includes(role) && req.user.role !== 'SUPER_ADMIN') {
        throw createError('Only Super Admin can assign admin roles', 403);
    }

    // A department-scoped admin may only change roles of their own dept's non-admins.
    await assertUserInScope(req, req.params.id);

    const result = await query(
        `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING ${safeUserFields}`,
        [role, req.params.id]
    );
    if (!result.rows.length) throw createError('User not found', 404);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'USER_ROLE_CHANGED', 'users', req.params.id, JSON.stringify({ newRole: role })]
    ).catch(() => { });

    res.json(mapUser(result.rows[0]));
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

// PUT /api/users/:id/subscription
const assignPlan = async (req, res) => {
    const { plan } = req.body;
    const { normalizePlan, VALID_PLANS } = require('../utils/formatters');
    const normalized = normalizePlan(plan);
    if (!VALID_PLANS.includes(normalized)) throw createError('Invalid plan', 400);

    const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = await query(
        `UPDATE users SET subscription_plan = $1, subscription_expiry = $2, updated_at = NOW() WHERE id = $3 RETURNING ${safeUserFields}`,
        [normalized, expiry, req.params.id]
    );
    if (!result.rows.length) throw createError('User not found', 404);
    res.json(mapUser(result.rows[0]));
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
    if (req.params.id === req.user.id) throw createError('Cannot delete your own account', 400);
    await assertUserInScope(req, req.params.id);
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) throw createError('User not found', 404);
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
        c.id, c.title, c.thumbnail, c.price, c.discount_price,
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
    const { name, role, password: providedPassword, phone, departmentId } = req.body;
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

    // Validate the department assignment (SUPER_ADMINs are typically global, but
    // a department may still be assigned to either role if provided).
    let deptId = null;
    if (departmentId) {
        const dept = await query('SELECT id FROM departments WHERE id = $1', [departmentId]);
        if (!dept.rows.length) throw createError('Invalid department', 400);
        deptId = departmentId;
    }

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
        [name, email, hashedPassword, role, deptId, String(phone || '').trim()]
    );

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

// Shared: create one INSTRUCTOR with a generated (or provided) temp password.
// Returns { user, tempPassword }. Throws on duplicate email / missing fields.
const createInstructorRecord = async ({ name, email, phone, departmentId, password }) => {
    const bcrypt = require('bcryptjs');
    const crypto = require('crypto');
    if (!name || !email) throw createError('Name and email are required', 400);
    const normEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) throw createError('Invalid email', 400);

    const exists = await query('SELECT id FROM users WHERE email = $1', [normEmail]);
    if (exists.rows.length) throw createError('User already exists', 409);

    const tempPassword = password && password.length >= 8 ? password : crypto.randomBytes(6).toString('hex');
    const hashed = await bcrypt.hash(tempPassword, 12);
    const result = await query(
        `INSERT INTO users (name, email, password, role, department_id, phone) VALUES ($1,$2,$3,'INSTRUCTOR',$4,$5) RETURNING ${safeUserFields}`,
        [String(name).trim(), normEmail, hashed, departmentId || null, String(phone || '').trim()]
    );
    return { user: result.rows[0], tempPassword };
};

// Target department for admin-created instructors: a scoped admin's own dept;
// super-admin may pass a departmentId (else global/null).
const resolveTargetDepartment = (req) => {
    const { scoped, departmentId } = getDepartmentScope(req);
    return scoped ? departmentId : (req.body.departmentId || null);
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

    const departmentId = resolveTargetDepartment(req);
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
            const { user, tempPassword } = await createInstructorRecord({ name, email, phone, departmentId });
            await query(
                `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
                [req.user.id, 'INSTRUCTOR_IMPORTED', 'users', user.id]
            ).catch(() => { });
            results.push({ email: user.email, name: user.name, status: 'created', tempPassword });
        } catch (err) {
            results.push({ email: String(email || '').trim().toLowerCase(), name, status: 'error', error: err.message });
        }
    }

    const created = results.filter(r => r.status === 'created').length;
    res.status(201).json({ total: results.length, created, failed: results.length - created, results });
};

module.exports = {
    getAll, updateRole, toggleStatus, assignPlan, deleteUser,
    submitInstructorRequest, getInstructorRequests, approveInstructorRequest,
    getInstructorProfile, followInstructor, unfollowInstructor, inviteAdmin,
    createInstructor, importInstructors
};
