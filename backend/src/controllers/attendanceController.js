const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { getDepartmentScope } = require('../utils/scope');

// ── LIVE SESSIONS CRUD ────────────────────────────────────────────────────────

// POST /api/attendance/sessions
const createSession = async (req, res) => {
    const { courseId, title, sessionDate, startTime, endTime, meetingLink, academicSessionId } = req.body;
    if (!courseId || !title || !sessionDate) {
        throw createError('courseId, title, and sessionDate are required', 400);
    }

    // Verify course ownership (instructor) or scope (admin)
    const course = await query('SELECT instructor_id FROM courses WHERE id = $1', [courseId]);
    if (!course.rows.length) throw createError('Course not found', 404);

    if (req.user.role === 'INSTRUCTOR' && course.rows[0].instructor_id !== req.user.id) {
        throw createError('Not authorized to manage sessions for this course', 403);
    }
    if (req.user.role === 'ADMIN') {
        const { scoped, departmentId } = getDepartmentScope(req);
        if (scoped) {
            const catCheck = await query(
                `SELECT cat.department_id FROM courses c
                 LEFT JOIN categories cat ON c.category_id = cat.id
                 WHERE c.id = $1`,
                [courseId]
            );
            if (catCheck.rows.length && catCheck.rows[0].department_id !== departmentId) {
                throw createError('Course is outside your department', 403);
            }
        }
    }

    const result = await query(
        `INSERT INTO live_sessions (course_id, instructor_id, title, session_date, start_time, end_time, meeting_link, academic_session_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [courseId, req.user.id, title, sessionDate, startTime || null, endTime || null, meetingLink || null, academicSessionId || null]
    );

    res.status(201).json(result.rows[0]);
};

// GET /api/attendance/sessions?courseId=xxx
const getSessions = async (req, res) => {
    const { courseId, from, to } = req.query;
    let sql = `SELECT ls.*, u.name as instructor_name, u.avatar as instructor_avatar
               FROM live_sessions ls
               JOIN users u ON ls.instructor_id = u.id`;
    const conditions = [];
    const values = [];
    let i = 1;

    // Department scope for admins
    if (req.user.role === 'ADMIN') {
        const { scoped, departmentId } = getDepartmentScope(req);
        if (scoped) {
            conditions.push(`ls.course_id IN (
                SELECT c.id FROM courses c
                LEFT JOIN categories cat ON c.category_id = cat.id
                WHERE cat.department_id = $${i++}
            )`);
            values.push(departmentId);
        }
    }

    if (courseId) { conditions.push(`ls.course_id = $${i++}`); values.push(courseId); }
    if (from) { conditions.push(`ls.session_date >= $${i++}`); values.push(from); }
    if (to) { conditions.push(`ls.session_date <= $${i++}`); values.push(to); }

    if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
    sql += ' ORDER BY ls.session_date DESC, ls.start_time ASC NULLS LAST';

    const result = await query(sql, values);
    res.json(result.rows);
};

// PUT /api/attendance/sessions/:id
const updateSession = async (req, res) => {
    const { id } = req.params;
    const fields = ['title', 'session_date', 'start_time', 'end_time', 'meeting_link', 'academic_session_id'];
    const updates = [];
    const values = [];
    let i = 1;

    fields.forEach(f => {
        if (req.body[f] !== undefined) {
            updates.push(`${f} = $${i++}`);
            values.push(req.body[f]);
        }
    });

    if (!updates.length) throw createError('No fields to update', 400);
    values.push(id);

    const result = await query(
        `UPDATE live_sessions SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
        values
    );
    if (!result.rows.length) throw createError('Session not found', 404);
    res.json(result.rows[0]);
};

// DELETE /api/attendance/sessions/:id
const deleteSession = async (req, res) => {
    const { id } = req.params;
    const session = await query('DELETE FROM live_sessions WHERE id = $1 RETURNING id, title, course_id', [id]);
    if (!session.rows.length) throw createError('Session not found', 404);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'SESSION_DELETED', 'live_sessions', id,
         JSON.stringify({ title: session.rows[0].title, courseId: session.rows[0].course_id })]
    ).catch(() => {});

    res.json({ success: true });
};

// ── ATTENDANCE MARKING ────────────────────────────────────────────────────────

// POST /api/attendance/sessions/:sessionId/mark — Mark attendance for multiple students
const markAttendance = async (req, res) => {
    const { sessionId } = req.params;
    const { records } = req.body; // [{ studentId, status }]

    if (!records || !Array.isArray(records) || !records.length) {
        throw createError('records array is required', 400);
    }

    // Verify session exists
    const session = await query('SELECT * FROM live_sessions WHERE id = $1', [sessionId]);
    if (!session.rows.length) throw createError('Session not found', 404);

    const validStatuses = ['present', 'absent', 'late', 'excused'];
    const client = await query.pool.connect();
    try {
        await client.query('BEGIN');
        const results = [];

        for (const record of records) {
            const status = (record.status || 'absent').toLowerCase();
            if (!validStatuses.includes(status)) {
                results.push({ studentId: record.studentId, status: 'skipped', reason: `Invalid status: ${record.status}` });
                continue;
            }

            await client.query(
                `INSERT INTO attendance (session_id, student_id, status, marked_by)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (session_id, student_id)
                 DO UPDATE SET status = $3, marked_by = $4, marked_at = NOW()
                 RETURNING *`,
                [sessionId, record.studentId, status, req.user.id]
            );
            results.push({ studentId: record.studentId, status });
        }

        await client.query('COMMIT');
        res.json({ success: true, count: results.length, results });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// POST /api/attendance/sessions/:sessionId/mark-single — Mark attendance for one student
const markSingleAttendance = async (req, res) => {
    const { sessionId } = req.params;
    const { studentId, status } = req.body;

    if (!studentId || !status) throw createError('studentId and status are required', 400);

    const validStatuses = ['present', 'absent', 'late', 'excused'];
    if (!validStatuses.includes(status.toLowerCase())) {
        throw createError('Invalid status', 400);
    }

    const result = await query(
        `INSERT INTO attendance (session_id, student_id, status, marked_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_id, student_id)
         DO UPDATE SET status = $3, marked_by = $4, marked_at = NOW()
         RETURNING *`,
        [sessionId, studentId, status, req.user.id]
    );

    res.json(result.rows[0]);
};

// GET /api/attendance/sessions/:sessionId — Get attendance for a session
const getAttendance = async (req, res) => {
    const { sessionId } = req.params;

    const session = await query(
        `SELECT ls.*, u.name as instructor_name
         FROM live_sessions ls
         JOIN users u ON ls.instructor_id = u.id
         WHERE ls.id = $1`,
        [sessionId]
    );
    if (!session.rows.length) throw createError('Session not found', 404);

    // Get enrolled students
    const students = await query(
        `SELECT u.id, u.name, u.email, u.avatar, u.roll_no
         FROM enrollments e
         JOIN users u ON e.student_id = u.id
         WHERE e.course_id = $1 AND u.active = true
         ORDER BY u.name ASC`,
        [session.rows[0].course_id]
    );

    // Get existing attendance records
    const attendance = await query(
        `SELECT a.* FROM attendance a WHERE a.session_id = $1`,
        [sessionId]
    );
    const attendanceMap = {};
    attendance.rows.forEach(a => { attendanceMap[a.student_id] = a; });

    // Merge
    const records = students.rows.map(student => ({
        studentId: student.id,
        name: student.name,
        email: student.email,
        avatar: student.avatar,
        rollNo: student.roll_no,
        status: attendanceMap[student.id]?.status || 'unmarked',
        markedBy: attendanceMap[student.id]?.marked_by || null,
        markedAt: attendanceMap[student.id]?.marked_at || null,
    }));

    res.json({
        session: session.rows[0],
        records,
    });
};

// GET /api/attendance/course/:courseId/stats — Attendance stats for a course
const getCourseAttendanceStats = async (req, res) => {
    const { courseId } = req.params;

    const stats = await query(
        `SELECT
            COUNT(DISTINCT ls.id) as total_sessions,
            COUNT(a.id) FILTER (WHERE a.status = 'present') as total_present,
            COUNT(a.id) FILTER (WHERE a.status = 'absent') as total_absent,
            COUNT(a.id) FILTER (WHERE a.status = 'late') as total_late,
            COUNT(a.id) FILTER (WHERE a.status = 'excused') as total_excused
         FROM live_sessions ls
         LEFT JOIN attendance a ON a.session_id = ls.id
         WHERE ls.course_id = $1`,
        [courseId]
    );

    // Per-student stats
    const perStudent = await query(
        `SELECT
            u.id, u.name, u.roll_no,
            COUNT(a.id) FILTER (WHERE a.status = 'present') as present_count,
            COUNT(a.id) FILTER (WHERE a.status = 'absent') as absent_count,
            COUNT(a.id) FILTER (WHERE a.status = 'late') as late_count,
            COUNT(a.id) as total_marked
         FROM enrollments e
         JOIN users u ON e.student_id = u.id
         LEFT JOIN live_sessions ls ON ls.course_id = e.course_id
         LEFT JOIN attendance a ON a.session_id = ls.id AND a.student_id = u.id
         WHERE e.course_id = $1
         GROUP BY u.id, u.name, u.roll_no
         ORDER BY u.name ASC`,
        [courseId]
    );

    res.json({ summary: stats.rows[0], perStudent: perStudent.rows });
};

// GET /api/attendance/student/:studentId — Student's own attendance
const getMyAttendance = async (req, res) => {
    const studentId = req.params.studentId || req.user.id;
    if (req.user.role === 'STUDENT' && String(studentId) !== String(req.user.id)) {
        throw createError('Forbidden', 403);
    }

    const result = await query(
        `SELECT
            a.status, a.marked_at,
            ls.title as session_title, ls.session_date,
            ls.start_time, ls.end_time,
            c.id as course_id, c.title as course_title
         FROM attendance a
         JOIN live_sessions ls ON a.session_id = ls.id
         JOIN courses c ON ls.course_id = c.id
         WHERE a.student_id = $1
         ORDER BY ls.session_date DESC`,
        [studentId]
    );

    res.json(result.rows);
};

module.exports = {
    createSession, getSessions, updateSession, deleteSession,
    markAttendance, markSingleAttendance, getAttendance,
    getCourseAttendanceStats, getMyAttendance,
};
