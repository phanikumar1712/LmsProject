const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const crypto = require('crypto');

// Generate a unique certificate ID: CERT-{year}-{random hex}
const generateCertId = () => {
    const year = new Date().getFullYear();
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `CERT-${year}-${rand}`;
};

// Ensure a student has a certificate for a completed course. Creates one if
// missing and returns it (idempotent — safe to call from the enrollment
// progress update every time a lesson is marked complete).
const ensureCertificate = async (studentId, courseId) => {
    const existing = await query(
        'SELECT * FROM certificates WHERE student_id = $1 AND course_id = $2',
        [studentId, courseId]
    );
    if (existing.rows.length) return existing.rows[0];

    // Verify enrollment + completion
    const enrollment = await query(
        `SELECT e.progress, e.completed_at FROM enrollments e
         WHERE e.student_id = $1 AND e.course_id = $2`,
        [studentId, courseId]
    );
    if (!enrollment.rows.length) throw createError('Not enrolled in this course', 403);
    if (enrollment.rows[0].progress < 100) throw createError('Course not yet completed', 400);

    // Get course and instructor info
    const course = await query(
        `SELECT c.title, u.name as instructor_name FROM courses c
         LEFT JOIN users u ON c.instructor_id = u.id WHERE c.id = $1`,
        [courseId]
    );
    if (!course.rows.length) throw createError('Course not found', 404);
    // Course must have certificate enabled (defaults to true in schema)

    const user = await query(
        `SELECT u.name, d.name as department_name FROM users u
         LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = $1`,
        [studentId]
    );

    const certId = generateCertId();
    const result = await query(
        `INSERT INTO certificates (student_id, course_id, cert_id, student_name, course_title, instructor_name, department_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [studentId, courseId, certId, user.rows[0].name, course.rows[0].title, course.rows[0].instructor_name, user.rows[0].department_name || '']
    );

    // Notify student
    await query(
        `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4)`,
        [studentId, `🎓 Certificate earned for "${course.rows[0].title}"!`, 'certificate', `/verify/${certId}`]
    ).catch(() => {});

    return result.rows[0];
};

// POST /api/certificates/generate — called when a student completes a course
const generate = async (req, res) => {
    const { courseId } = req.body;
    if (!courseId) throw createError('courseId is required', 400);
    const cert = await ensureCertificate(req.user.id, courseId);
    res.status(201).json(cert);
};

// GET /api/certificates/verify/:certId — public verification page
const verify = async (req, res) => {
    const { certId } = req.params;
    const result = await query(
        `SELECT c.*, u.avatar as student_avatar FROM certificates c
         LEFT JOIN users u ON c.student_id = u.id
         WHERE c.cert_id = $1`,
        [certId]
    );
    if (!result.rows.length) throw createError('Certificate not found', 404);
    res.json(result.rows[0]);
};

// GET /api/certificates/my — student's certificates
const getMy = async (req, res) => {
    const result = await query(
        `SELECT c.* FROM certificates c WHERE c.student_id = $1 ORDER BY c.issue_date DESC`,
        [req.user.id]
    );
    res.json(result.rows);
};

// GET /api/certificates/user/:userId — admin/super-admin views a student's certificates.
// Department-scoped admins may only view students in their own department.
const getByUser = async (req, res) => {
    const { userId } = req.params;
    const { getDepartmentScope } = require('../utils/scope');
    const { scoped, departmentId } = getDepartmentScope(req);

    if (scoped) {
        const check = await query(
            `SELECT 1 FROM users WHERE id = $1 AND department_id = $2 AND role = 'STUDENT'`,
            [userId, departmentId]
        );
        if (!check.rows.length) throw createError('This student is outside your department', 403);
    }

    const result = await query(
        `SELECT id, cert_id, course_id, course_title, instructor_name, issue_date
         FROM certificates WHERE student_id = $1 ORDER BY issue_date DESC`,
        [userId]
    );
    res.json(result.rows);
};

module.exports = { generate, ensureCertificate, verify, getMy, getByUser };
