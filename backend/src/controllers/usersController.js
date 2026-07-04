const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapUser, mapInstructorRequest } = require('../utils/formatters');

const safeUserFields = `id, name, email, role, avatar, bio, active, subscription_plan, subscription_expiry, earnings, created_at`;

// GET /api/users
const getAll = async (req, res) => {
    const { limit = 20, offset = 0, search, role } = req.query;
    const { getPagination } = require('../utils/pagination');

    let conditions = [];
    let values = [];
    let i = 1;

    if (role) {
        conditions.push(`role = $${i++}`);
        values.push(role.toUpperCase());
    }
    if (search) {
        conditions.push(`(name ILIKE $${i} OR email ILIKE $${i})`);
        values.push(`%${search}%`);
        i++;
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
    const result = await query(
        `SELECT ir.*, u.name as user_name, u.email as user_email 
         FROM instructor_requests ir
         JOIN users u ON ir.user_id = u.id
         WHERE ir.status = 'PENDING'
         ORDER BY ir.created_at DESC`
    );
    res.json(result.rows.map(mapInstructorRequest));
};

// PUT /api/users/instructor-requests/:id/approve
const approveInstructorRequest = async (req, res) => {
    const { action } = req.body;
    const status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

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
    const { name, role, password: providedPassword, phone } = req.body;
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

    // Check if user exists
    const checkUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (checkUser.rows.length) throw createError('User already exists', 409);

    // Use provided password or generate temp one
    const tempPassword = providedPassword && providedPassword.length >= 8
        ? providedPassword
        : crypto.randomBytes(8).toString('hex');

    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const result = await query(
        `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING ${safeUserFields}`,
        [name, email, hashedPassword, role]
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

module.exports = {
    getAll, updateRole, toggleStatus, assignPlan, deleteUser,
    submitInstructorRequest, getInstructorRequests, approveInstructorRequest,
    getInstructorProfile, followInstructor, unfollowInstructor, inviteAdmin
};
