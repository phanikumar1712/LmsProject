const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapUser } = require('../utils/formatters');

const generateToken = (userId, role) =>
    jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const getWishlistIds = async (userId) => {
    const res = await query('SELECT course_id FROM wishlist WHERE user_id = $1', [userId]);
    return res.rows.map(r => r.course_id);
};

const userFields = `id, name, email, role, avatar, bio, active, subscription_plan, subscription_expiry, earnings, created_at`;

// POST /api/auth/register
const register = async (req, res) => {
    const { name, email, password, role = 'STUDENT' } = req.body;
    if (!name || !email || !password) throw createError('Name, email and password are required', 400);

    const allowedRoles = ['STUDENT', 'INSTRUCTOR'];
    const userRole = allowedRoles.includes(role?.toUpperCase()) ? role.toUpperCase() : 'STUDENT';

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) throw createError('Email already registered', 409);

    const hashed = await bcrypt.hash(password, 12);

    const result = await query(
        `INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING ${userFields}`,
        [name, email.toLowerCase(), hashed, userRole]
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
    res.json(user);
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

    // In a real app, we'd verify email exists, generate a random OTP, save to DB/Redis, and email it.
    // For this demo platform, we just simulate success so the frontend moves to the OTP step.
    res.json({ success: true, message: 'If registered, an OTP has been sent. (Demo: use 123456)' });
};

// POST /api/auth/reset-password
const resetPasswordByEmail = async (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) throw createError('Email, OTP, and new password are required', 400);
    if (newPassword.length < 8) throw createError('Password must be at least 8 characters', 400);

    // Demo hardcoded OTP verification
    if (otp !== '123456') {
        throw createError('Invalid OTP', 400);
    }

    const result = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (!result.rows.length) {
        return res.json({ success: true, message: 'Password has been reset successfully.' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashed, result.rows[0].id]);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [result.rows[0].id, 'PASSWORD_RESET', 'users', result.rows[0].id]
    ).catch(() => { });

    res.json({ success: true, message: 'Password has been reset successfully.' });
};

// POST /api/auth/demo
const demoLogin = async (req, res) => {
    const { role = 'STUDENT' } = req.body;
    const demoEmails = {
        STUDENT: 'student@demo.com',
        INSTRUCTOR: 'instructor@demo.com',
        ADMIN: 'admin@demo.com',
        SUPER_ADMIN: 'superadmin@lms.com',
    };
    const email = demoEmails[role.toUpperCase()];
    if (!email) throw createError('Invalid demo role', 400);

    const result = await query(`SELECT ${userFields} FROM users WHERE email = $1`, [email]);
    if (!result.rows.length) throw createError('Demo user not found', 404);

    const user = result.rows[0];
    const token = generateToken(user.id, user.role);
    const safeUser = mapUser(user);
    safeUser.wishlist = await getWishlistIds(user.id);
    res.json({ user: safeUser, token });
};

module.exports = { register, login, getMe, updateProfile, changePassword, requestPasswordReset, resetPasswordByEmail, demoLogin };
