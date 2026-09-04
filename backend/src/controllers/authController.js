const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapUser } = require('../utils/formatters');
const { sendOTPEmail } = require('../utils/mail');
const { getDeptCapacity, notifyLimitReached } = require('../utils/limits');
const { getEffectivePermissions } = require('../utils/permissions');
const { writeAudit } = require('../utils/audit');

// Attach the user's effective permission list to a mapped user payload (role
// matrix + per-user overrides). Every auth response carries it so the frontend
// can gate UI on granular permissions instead of bare roles. Extra fields the
// caller already attached (e.g. wishlist) are preserved.
const withPermissions = async (user) => {
    const { wishlist, ...rest } = user;
    const mapped = mapUser(rest);
    if (wishlist !== undefined) mapped.wishlist = wishlist;
    mapped.permissions = await getEffectivePermissions(user);
    return mapped;
};

// Constant-time comparison to prevent timing attacks on OTP verification
const timingSafeEqual = (a, b) => {
    if (!a || !b || a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

const generateToken = (userId, role) =>
    jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const getWishlistIds = async (userId) => {
    const res = await query('SELECT course_id FROM wishlist WHERE user_id = $1', [userId]);
    return res.rows.map(r => r.course_id);
};

const userFields = `id, name, email, role, phone, avatar, bio, active, current_streak, longest_streak, department_id, roll_no, username, last_login, designation, qualification, specialization, year, semester, section, batch, must_change_password, created_at`;
// Same list prefixed with the users alias for queries that LEFT JOIN departments.
const userFieldsU = userFields.split(',').map(f => `u.${f.trim()}`).join(', ');

// POST /api/auth/register
const register = async (req, res) => {
    const { name, email, password, role = 'STUDENT', departmentId, rollNo } = req.body;
    if (!name || !email || !password) throw createError('Name, email and password are required', 400);

    const allowedRoles = ['STUDENT', 'INSTRUCTOR'];
    const userRole = allowedRoles.includes(role?.toUpperCase()) ? role.toUpperCase() : 'STUDENT';

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) throw createError('Email already registered', 409);

    // Optional department/branch chosen at signup; validate it exists.
    let deptId = null;
    if (departmentId) {
        const dept = await query('SELECT id FROM departments WHERE id = $1', [departmentId]);
        if (!dept.rows.length) throw createError('Invalid department', 400);
        deptId = departmentId;
    }

    // Roll number: required for STUDENT, must be unique per department.
    const normRollNo = String(rollNo || '').trim() || null;
    if (userRole === 'STUDENT' && !normRollNo) {
        throw createError('Roll number is required for student registration', 400);
    }
    if (normRollNo) {
        // Enforce uniqueness per department (the DB index enforces this at write,
        // but we give a friendlier error upfront).
        const dupRoll = await query(
            `SELECT 1 FROM users WHERE roll_no = $1 AND (department_id = $2 OR (department_id IS NULL AND $2 IS NULL)) AND role = 'STUDENT'`,
            [normRollNo, deptId]
        );
        if (dupRoll.rows.length) throw createError('This roll number is already registered in your department', 409);
    }

    // Department student-limit enforcement: block student signups for a
    // department that has reached its max_students quota.
    if (userRole === 'STUDENT' && deptId) {
        const capacity = await getDeptCapacity(deptId);
        if (capacity.studentsAtLimit) {
            await notifyLimitReached(deptId, 'students');
            throw createError(
                `Student limit reached: this department has ${capacity.studentCount} students and the limit is ${capacity.maxStudents}. Please contact the department admin.`,
                409
            );
        }
    }

    const hashed = await bcrypt.hash(password, 12);

    const result = await query(
        `INSERT INTO users (name, email, password, role, department_id, roll_no) VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${userFields}`,
        [name, email.toLowerCase(), hashed, userRole, deptId, normRollNo]
    );
    const user = result.rows[0];
    user.wishlist = await getWishlistIds(user.id);
    const token = generateToken(user.id, user.role);

    // Audit log (actor, IP + device from the request)
    await writeAudit(req, { action: 'USER_REGISTERED', resource: 'users', resourceId: user.id });

    res.status(201).json({ user: await withPermissions(user), token });
};

// POST /api/auth/login
const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) throw createError('Email and password are required', 400);

    const result = await query(
        `SELECT u.password, ${userFieldsU} FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.email = $1`,
        [email.toLowerCase()]
    );
    if (!result.rows.length) throw createError('Invalid email or password', 401);

    const row = result.rows[0];
    if (!row.active) throw createError('Account has been suspended', 403);

    const valid = await bcrypt.compare(password, row.password);
    if (!valid) throw createError('Invalid email or password', 401);

    const token = generateToken(row.id, row.role);
    const { password: _, ...safeUser } = row;
    safeUser.wishlist = await getWishlistIds(row.id);

    // Record last login and reflect the fresh timestamp in the response.
    try {
        const lastLoginRes = await query(
            'UPDATE users SET last_login = NOW() WHERE id = $1 RETURNING last_login',
            [row.id]
        );
        if (lastLoginRes.rows.length) safeUser.last_login = lastLoginRes.rows[0].last_login;
    } catch { /* non-fatal */ }

    await writeAudit(req, { action: 'USER_LOGIN', resource: 'users', resourceId: row.id });

    res.json({ user: await withPermissions(safeUser), token });
};

// GET /api/auth/me
const getMe = async (req, res) => {
    const result = await query(
        `SELECT ${userFieldsU}, d.name AS department_name FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.id = $1`,
        [req.user.id]
    );
    if (!result.rows.length) throw createError('User not found', 404);
    const user = result.rows[0];
    user.wishlist = await getWishlistIds(user.id);
    res.json(await withPermissions(user));
};

// PUT /api/auth/profile
const updateProfile = async (req, res) => {
    // Whitelist only self-service fields. Sensitive academic fields (department,
    // roll_no, year, semester, section, role) are NEVER accepted here — students
    // can't change them from their profile.
    const { name, bio, avatar, phone } = req.body;
    const updates = [];
    const values = [];
    let i = 1;

    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(String(name).slice(0, 255)); }
    if (bio !== undefined) { updates.push(`bio = $${i++}`); values.push(String(bio)); }
    if (avatar !== undefined) { updates.push(`avatar = $${i++}`); values.push(String(avatar)); }
    if (phone !== undefined) { updates.push(`phone = $${i++}`); values.push(String(phone).slice(0, 30)); }
    if (!updates.length) throw createError('No fields to update', 400);

    updates.push(`updated_at = NOW()`);
    values.push(req.user.id);

    await query(
        `UPDATE users SET ${updates.join(',')} WHERE id = $${i}`,
        values
    );
    const result = await query(
        `SELECT ${userFieldsU}, d.name AS department_name FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.id = $1`,
        [req.user.id]
    );
    const user = mapUser(result.rows[0]);
    user.wishlist = await getWishlistIds(user.id);
    res.json(user);
};

// PUT /api/auth/change-password
const changePassword = async (req, res) => {
    // Admin passwords are managed by the Super Admin — admins cannot self-service
    // their own password. Students, instructors, and super admins may.
    if (req.user.role === 'ADMIN') {
        throw createError('Admin passwords are managed by the Super Admin. Please contact them to reset your password.', 403);
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw createError('Both current and new password are required', 400);
    if (newPassword.length < 8) throw createError('Password must be at least 8 characters', 400);

    const result = await query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows.length) throw createError('User not found', 404);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password);
    if (!valid) throw createError('Current password is incorrect', 401);

    const hashed = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password = $1, must_change_password = false, updated_at = NOW() WHERE id = $2', [hashed, req.user.id]);
    await writeAudit(req, { action: 'PASSWORD_CHANGED', resource: 'users', resourceId: req.user.id });
    res.json({ success: true, message: 'Password updated successfully' });
};

// POST /api/auth/reset-password/request
const requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    if (!email) throw createError('Email is required', 400);

    const result = await query('SELECT id, role FROM users WHERE email = $1', [email.toLowerCase()]);
    // Return success for unknown emails AND for admin accounts — admins cannot
    // self-service reset (their passwords are managed by the Super Admin) and we
    // deliberately don't reveal whether an admin account exists.
    if (!result.rows.length || result.rows[0].role === 'ADMIN') {
        return res.json({ success: true, message: 'If registered, an OTP has been sent.' });
    }

    const userId = result.rows[0].id;
    // crypto.randomInt — never Math.random() for security-sensitive values
    // (a predictable OTP would allow password-reset account takeover).
    const otp = crypto.randomInt(100000, 1000000).toString(); // 6 digit OTP
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    await query(
        'UPDATE users SET reset_otp = $1, reset_otp_expiry = $2 WHERE id = $3',
        [otp, expiry, userId]
    );

    const mailRes = await sendOTPEmail(email.toLowerCase(), otp);

    if (!mailRes.success) {
        console.error('Failed to send OTP email:', mailRes.error);
        // We don't want to fail the request for the user, but maybe in development we'd like to know.
        // For production, fallback to dummy success or throw error depending on requirements.
        if (process.env.NODE_ENV === 'development') {
            const errMsg = typeof mailRes.error === 'object' ? JSON.stringify(mailRes.error) : mailRes.error;
            return res.json({ success: true, message: `(Dev) OTP generated: ${otp}. Email send failed: ${errMsg}` });
        }
    }

    res.json({ success: true, message: 'An OTP has been sent to your email.' });
};

// POST /api/auth/verify-otp
const verifyOTP = async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) throw createError('Email and OTP are required', 400);

    const result = await query(
        'SELECT reset_otp, reset_otp_expiry, role FROM users WHERE email = $1',
        [email.toLowerCase()]
    );

    if (!result.rows.length) {
        throw createError('User not found', 404);
    }

    const user = result.rows[0];

    // Admins never receive OTPs (see requestPasswordReset) — reject even if a
    // stale OTP exists.
    if (user.role === 'ADMIN') {
        throw createError('Invalid OTP', 400);
    }

    if (!user.reset_otp || !timingSafeEqual(user.reset_otp, otp)) {
        throw createError('Invalid OTP', 400);
    }

    if (new Date() > new Date(user.reset_otp_expiry)) {
        throw createError('OTP has expired', 400);
    }

    // Don't clear the OTP here — this endpoint only gates the UI to the
    // password-entry step. resetPasswordByEmail re-validates the same OTP and
    // is the single consumer that clears it once the password is updated.
    res.json({ success: true, message: 'OTP verified successfully.' });
};

// POST /api/auth/reset-password
const resetPasswordByEmail = async (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) throw createError('Email, OTP, and new password are required', 400);
    if (newPassword.length < 8) throw createError('Password must be at least 8 characters', 400);

    const result = await query(
        'SELECT id, reset_otp, reset_otp_expiry, role FROM users WHERE email = $1',
        [email.toLowerCase()]
    );

    if (!result.rows.length) {
        // Return generic success to prevent enumeration
        return res.json({ success: true, message: 'Password has been reset successfully.' });
    }

    const user = result.rows[0];

    // Admins cannot self-service reset — their passwords are managed by the
    // Super Admin. Reject with the generic error to avoid leaking account state.
    if (user.role === 'ADMIN') {
        throw createError('Invalid OTP', 400);
    }

    if (!user.reset_otp || !timingSafeEqual(user.reset_otp, otp)) {
        throw createError('Invalid OTP', 400);
    }

    if (new Date() > new Date(user.reset_otp_expiry)) {
        throw createError('OTP has expired', 400);
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    // Update password and clear OTP
    await query(
        'UPDATE users SET password = $1, reset_otp = NULL, reset_otp_expiry = NULL, updated_at = NOW() WHERE id = $2',
        [hashed, user.id]
    );

    await writeAudit(req, { action: 'PASSWORD_RESET', resource: 'users', resourceId: user.id });

    res.json({ success: true, message: 'Password has been reset successfully.' });
};

// POST /api/auth/demo
const demoLogin = async (req, res) => {
    // Demo login is a development/testing convenience. It is disabled entirely
    // in production — real users must authenticate with their own credentials.
    if (process.env.NODE_ENV === 'production') {
        throw createError('Demo login is disabled in production', 403);
    }

    const { role = 'STUDENT' } = req.body;
    // Seeded department accounts (dev/test only). Only NON-privileged demo roles
    // are exposed — admins and super admins must always authenticate normally.
    const demoEmails = {
        STUDENT: 'cse.student1@lms.com',
        INSTRUCTOR: 'cse.instructor@lms.com',
    };
    const email = demoEmails[String(role).toUpperCase()];
    if (!email) throw createError('Invalid demo role', 400);

    const result = await query(
        `SELECT ${userFieldsU}, d.name AS department_name FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.email = $1`,
        [email]
    );
    if (!result.rows.length) throw createError('Demo user not found', 404);

    const user = result.rows[0];
    if (!user.active) throw createError('Account has been suspended', 403);

    const token = generateToken(user.id, user.role);
    res.json({ user: await withPermissions(user), token });
};

module.exports = { register, login, getMe, updateProfile, changePassword, requestPasswordReset, verifyOTP, resetPasswordByEmail, demoLogin };
