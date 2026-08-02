const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapUser } = require('../utils/formatters');
const { sendOTPEmail } = require('../utils/mail');
const { getDeptCapacity, notifyLimitReached } = require('../utils/limits');

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

const userFields = `id, name, email, role, phone, avatar, bio, active, current_streak, longest_streak, department_id, roll_no, created_at`;

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
                `Student limit reached for this department (${capacity.studentCount}/${capacity.maxStudents}). Please contact the department admin.`,
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

    // Audit log
    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, ip_address) VALUES ($1,$2,$3,$4,$5)`,
        [user.id, 'USER_REGISTERED', 'users', user.id, req.ip]
    ).catch(() => { });

    res.status(201).json({ user: mapUser(user), token });
};

// POST /api/auth/login
const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) throw createError('Email and password are required', 400);

    const result = await query(
        `SELECT password, ${userFields} FROM users WHERE email = $1`,
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

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, ip_address) VALUES ($1,$2,$3,$4,$5)`,
        [row.id, 'USER_LOGIN', 'users', row.id, req.ip]
    ).catch(() => { });

    res.json({ user: mapUser(safeUser), token });
};

// GET /api/auth/me
const getMe = async (req, res) => {
    const result = await query(`SELECT ${userFields} FROM users WHERE id = $1`, [req.user.id]);
    if (!result.rows.length) throw createError('User not found', 404);
    const user = result.rows[0];
    user.wishlist = await getWishlistIds(user.id);
    res.json(mapUser(user));
};

// PUT /api/auth/profile
const updateProfile = async (req, res) => {
    const { name, bio, avatar } = req.body;
    const updates = [];
    const values = [];
    let i = 1;

    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
    if (bio !== undefined) { updates.push(`bio = $${i++}`); values.push(bio); }
    if (avatar !== undefined) { updates.push(`avatar = $${i++}`); values.push(avatar); }
    if (!updates.length) throw createError('No fields to update', 400);

    updates.push(`updated_at = NOW()`);
    values.push(req.user.id);

    const result = await query(
        `UPDATE users SET ${updates.join(',')} WHERE id = $${i} RETURNING ${userFields}`,
        values
    );
    const user = mapUser(result.rows[0]);
    user.wishlist = await getWishlistIds(user.id);
    res.json(user);
};

// PUT /api/auth/change-password
const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw createError('Both current and new password are required', 400);
    if (newPassword.length < 8) throw createError('Password must be at least 8 characters', 400);

    const result = await query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password);
    if (!valid) throw createError('Current password is incorrect', 401);

    const hashed = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashed, req.user.id]);
    res.json({ success: true, message: 'Password updated successfully' });
};

// POST /api/auth/reset-password/request
const requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    if (!email) throw createError('Email is required', 400);

    const result = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (!result.rows.length) {
        // We still return success to prevent email enumeration, but we don't send anything.
        return res.json({ success: true, message: 'If registered, an OTP has been sent.' });
    }

    const userId = result.rows[0].id;
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP
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
        'SELECT reset_otp, reset_otp_expiry FROM users WHERE email = $1',
        [email.toLowerCase()]
    );

    if (!result.rows.length) {
        throw createError('User not found', 404);
    }

    const user = result.rows[0];

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
        'SELECT id, reset_otp, reset_otp_expiry FROM users WHERE email = $1',
        [email.toLowerCase()]
    );

    if (!result.rows.length) {
        // Return generic success to prevent enumeration
        return res.json({ success: true, message: 'Password has been reset successfully.' });
    }

    const user = result.rows[0];

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

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [user.id, 'PASSWORD_RESET', 'users', user.id]
    ).catch(err => {
        console.error('[Audit] Failed to log password reset:', err.message);
    });

    res.json({ success: true, message: 'Password has been reset successfully.' });
};

// POST /api/auth/demo
const demoLogin = async (req, res) => {
    const { role = 'STUDENT' } = req.body;
    // Seeded department accounts (the legacy student@demo.com / instructor@demo.com /
    // admin@demo.com accounts were removed from the seed data — they no longer exist).
    const demoEmails = {
        STUDENT: 'cse.student1@demo.com',
        INSTRUCTOR: 'cse.instructor@demo.com',
        ADMIN: 'cse.admin@demo.com',
        SUPER_ADMIN: 'superadmin@lms.com',
    };
    const email = demoEmails[role.toUpperCase()];
    if (!email) throw createError('Invalid demo role', 400);

    const result = await query(`SELECT ${userFields} FROM users WHERE email = $1`, [email]);
    if (!result.rows.length) throw createError('Demo user not found', 404);

    const user = result.rows[0];
    if (!user.active) throw createError('Account has been suspended', 403);

    const token = generateToken(user.id, user.role);
    const safeUser = mapUser(user);
    safeUser.wishlist = await getWishlistIds(user.id);
    res.json({ user: safeUser, token });
};

module.exports = { register, login, getMe, updateProfile, changePassword, requestPasswordReset, verifyOTP, resetPasswordByEmail, demoLogin };
