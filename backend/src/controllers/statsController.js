const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { getDepartmentScope } = require('../utils/scope');
const cache = require('../utils/cache');

// GET /api/stats/platform?from=&to=&departmentId=
const getPlatform = async (req, res) => {
    // Department scope: a scoped ADMIN is locked to its department; SUPER_ADMIN may
    // optionally pass departmentId. deptId NULL => whole platform. from/to bound the
    // enrolment-based windows. Each query takes ($1 deptId, $2 from, $3 to).
    const { scoped, departmentId } = getDepartmentScope(req);
    const deptId = scoped ? departmentId : (req.query.departmentId || null);
    const from = req.query.from || null;
    const to = req.query.to || null;
    const p = [deptId, from, to];

    // Reusable fragments. Courses/enrolments are tied to a department via the
    // course's category.department_id.
    const timeWin = `AND ($2::timestamptz IS NULL OR e.enrolled_at >= $2) AND ($3::timestamptz IS NULL OR e.enrolled_at <= $3)`;

    const [users, courses, enrollments, revenue, premiumSubs, avgRatingQuery] = await Promise.all([
        query(`SELECT COUNT(*) FROM users WHERE ($1::uuid IS NULL OR department_id = $1)`, [deptId]),
        query(`SELECT COUNT(*) as total,
                      COUNT(*) FILTER (WHERE c.status='PUBLISHED') as published,
                      COUNT(*) FILTER (WHERE c.status='PENDING') as pending
               FROM courses c LEFT JOIN categories cat ON c.category_id = cat.id
               WHERE c.status NOT IN ('REJECTED', 'ARCHIVED')
                 AND ($1::uuid IS NULL OR cat.department_id = $1)`, [deptId]),
        query(`SELECT COUNT(*) FROM enrollments e
               JOIN courses c ON e.course_id = c.id
               LEFT JOIN categories cat ON c.category_id = cat.id
               WHERE ($1::uuid IS NULL OR cat.department_id = $1) ${timeWin}`, p),
        query(`SELECT 0 as total`, []),
        query(`SELECT COUNT(*) FROM users WHERE subscription_plan != 'FREE' AND ($1::uuid IS NULL OR department_id = $1)`, [deptId]),
        query(`SELECT ROUND(AVG(r.stars)::numeric, 1) as avg_rating FROM ratings r
               JOIN courses c ON r.course_id = c.id
               LEFT JOIN categories cat ON c.category_id = cat.id
               WHERE ($1::uuid IS NULL OR cat.department_id = $1)`, [deptId]),
    ]);

    const usersCount = parseInt(users.rows[0].count);

    const [usersByRoleQuery, monthlyStatsQuery, topCatQuery] = await Promise.all([
        query(`SELECT role, COUNT(*) as count FROM users WHERE ($1::uuid IS NULL OR department_id = $1) GROUP BY role`, [deptId]),
        query(`
            SELECT TO_CHAR(e.enrolled_at, 'Mon') as month, COUNT(e.id) as count, 0 as revenue
            FROM enrollments e JOIN courses c ON e.course_id = c.id
            LEFT JOIN categories cat ON c.category_id = cat.id
            WHERE e.enrolled_at >= NOW() - INTERVAL '6 months'
              AND ($1::uuid IS NULL OR cat.department_id = $1)
            GROUP BY TO_CHAR(e.enrolled_at, 'Mon'), DATE_TRUNC('month', e.enrolled_at)
            ORDER BY DATE_TRUNC('month', e.enrolled_at) ASC
        `, [deptId]),
        query(`
            SELECT cat.name, COUNT(e.id) as enrollments
            FROM categories cat
            JOIN courses c ON c.category_id = cat.id
            JOIN enrollments e ON e.course_id = c.id
            WHERE ($1::uuid IS NULL OR cat.department_id = $1) ${timeWin}
            GROUP BY cat.name ORDER BY enrollments DESC LIMIT 5
        `, p),
    ]);
    const usersByRole = usersByRoleQuery.rows.map(r => ({ role: r.role, count: parseInt(r.count) }));
    const monthlyRevenue = monthlyStatsQuery.rows.map(r => ({ month: r.month, revenue: parseFloat(r.revenue) }));
    const enrollmentsByMonth = monthlyStatsQuery.rows.map(r => ({ month: r.month, count: parseInt(r.count) }));
    const topCategories = topCatQuery.rows.map(r => ({ name: r.name, enrollments: parseInt(r.enrollments) }));

    let revenueGrowth = 0;
    if (monthlyRevenue.length >= 2) {
        const curr = monthlyRevenue[monthlyRevenue.length - 1].revenue;
        const prev = monthlyRevenue[monthlyRevenue.length - 2].revenue;
        if (prev > 0) revenueGrowth = Math.round(((curr - prev) / prev) * 100);
        else if (curr > 0) revenueGrowth = 100;
    }

    let studentGrowth = 0;
    if (enrollmentsByMonth.length >= 2) {
        const curr = enrollmentsByMonth[enrollmentsByMonth.length - 1].count;
        const prev = enrollmentsByMonth[enrollmentsByMonth.length - 2].count;
        if (prev > 0) studentGrowth = Math.round(((curr - prev) / prev) * 100);
        else if (curr > 0) studentGrowth = 100;
    }

    res.json({
        totalUsers: usersCount,
        activeStudents: Math.floor(usersCount * 0.8),
        premiumSubscribers: parseInt(premiumSubs.rows[0].count),
        avgRating: parseFloat(avgRatingQuery.rows[0].avg_rating) || 0,
        totalCourses: parseInt(courses.rows[0].total),
        approvedCourses: parseInt(courses.rows[0].published),
        pendingCourses: parseInt(courses.rows[0].pending),
        totalEnrollments: parseInt(enrollments.rows[0].count),
        totalRevenue: 0,
        usersByRole,
        monthlyRevenue,
        enrollmentsByMonth,
        topCategories,
        revenueGrowth: 0,
        studentGrowth,
        platformGrowth: studentGrowth // Proxy for platform growth
    });
};

// GET /api/stats/instructor/:instructorId
const getInstructor = async (req, res) => {
    const { instructorId } = req.params;
    if (req.user.role === 'INSTRUCTOR' && req.user.id !== instructorId) {
        throw createError('Forbidden', 403);
    }

    const [courses, enrollments, ratings, user] = await Promise.all([
        query(`SELECT COUNT(*) as total,
                      COUNT(*) FILTER (WHERE status='PUBLISHED') as published,
                      COUNT(*) FILTER (WHERE status='PENDING') as pending
               FROM courses WHERE instructor_id = $1`, [instructorId]),
        query(`SELECT COUNT(*) FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE c.instructor_id = $1`, [instructorId]),
        query(`SELECT ROUND(AVG(r.stars)::numeric,1) as avg_rating FROM ratings r JOIN courses c ON r.course_id = c.id WHERE c.instructor_id = $1`, [instructorId]),
        query('SELECT earnings FROM users WHERE id = $1', [instructorId]),
    ]);

    const monthlyEarningsQuery = query(`
        SELECT TO_CHAR(e.enrolled_at, 'Mon') as month, 0 as revenue
        FROM enrollments e JOIN courses c ON e.course_id = c.id
        WHERE c.instructor_id = $1 AND e.enrolled_at >= NOW() - INTERVAL '6 months'
        GROUP BY TO_CHAR(e.enrolled_at, 'Mon'), DATE_TRUNC('month', e.enrolled_at)
        ORDER BY DATE_TRUNC('month', e.enrolled_at) ASC
    `, [instructorId]);

    const thisMonthQuery = query(`
        SELECT 
            COUNT(e.id) as enrollments,
            0 as earnings
        FROM enrollments e 
        JOIN courses c ON e.course_id = c.id 
        WHERE c.instructor_id = $1 AND e.enrolled_at >= DATE_TRUNC('month', NOW())
    `, [instructorId]);

    const newCoursesThisMonthQuery = query(`
        SELECT COUNT(*) FROM courses WHERE instructor_id = $1 AND created_at >= DATE_TRUNC('month', NOW())
    `, [instructorId]);

    const [monthlyEarnings, thisMonth, newCourses] = await Promise.all([
        monthlyEarningsQuery, thisMonthQuery, newCoursesThisMonthQuery
    ]);

    res.json({
        totalCourses: parseInt(courses.rows[0].total),
        publishedCourses: parseInt(courses.rows[0].published),
        pendingCourses: parseInt(courses.rows[0].pending),
        totalEnrollments: parseInt(enrollments.rows[0].count),
        avgRating: parseFloat(ratings.rows[0].avg_rating) || 0,
        earnings: parseFloat(user.rows[0]?.earnings) || 0,
        monthlyEarnings: monthlyEarnings.rows.map(r => ({ month: r.month, revenue: parseFloat(r.revenue) })),
        thisMonth: {
            enrollments: parseInt(thisMonth.rows[0].enrollments),
            earnings: parseFloat(thisMonth.rows[0].earnings),
            newCourses: parseInt(newCourses.rows[0].count)
        }
    });
};

// GET /api/stats/audit-logs
const getAuditLogs = async (req, res) => {
    const { scoped, departmentId } = getDepartmentScope(req);
    // A scoped ADMIN only sees audit entries produced by users in their department.
    const where = scoped ? 'WHERE u.department_id = $1' : '';
    const values = scoped ? [departmentId] : [];
    const result = await query(`
        SELECT al.*, u.name as user_name, u.email as user_email, u.role as user_role
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ${where}
        ORDER BY al.created_at DESC
        LIMIT 200
    `, values);
    const formatted = result.rows.map(log => ({
        id: log.id,
        userName: log.user_name || 'System',
        userRole: log.user_role,
        action: log.action,
        target: log.resource + (log.resource_id ? ' (' + log.resource_id + ')' : ''),
        timestamp: log.created_at,
        ip: log.ip_address || '127.0.0.1'
    }));
    res.json(formatted);
};

// GET /api/stats/admins — SUPER_ADMIN per-department overview.
// Limits are now set per-department (not per-admin). All admins in a department
// share the same quota. Falls back to platform global defaults.
const getAdminOverview = async (req, res) => {
    const settingsRes = await query("SELECT value FROM platform_settings WHERE key = 'global'");
    const settings = settingsRes.rows[0]?.value || {};
    const defaultMaxStudents = Number(settings.defaultMaxStudentsPerAdmin ?? 500);
    const defaultMaxCourses = Number(settings.defaultMaxCoursesPerAdmin ?? 100);

    const result = await query(`
        SELECT
            d.id                                       AS "departmentId",
            d.name                                     AS "departmentName",
            d.max_students                             AS "maxStudentsOverride",
            d.max_courses                              AS "maxCoursesOverride",
            COALESCE(u_agg.students, 0)::int           AS "studentCount",
            COALESCE(u_agg.instructors, 0)::int        AS "instructorCount",
            COALESCE(u_agg.admins, 0)::int             AS "adminCount",
            COALESCE(cc.course_count, 0)::int          AS "courseCount"
        FROM departments d
        LEFT JOIN (
            SELECT department_id,
                   COUNT(*) FILTER (WHERE role = 'STUDENT')    AS students,
                   COUNT(*) FILTER (WHERE role = 'INSTRUCTOR') AS instructors,
                   COUNT(*) FILTER (WHERE role = 'ADMIN')      AS admins
            FROM users
            WHERE department_id IS NOT NULL
            GROUP BY department_id
        ) u_agg ON u_agg.department_id = d.id
        LEFT JOIN (
            SELECT cat.department_id, COUNT(*) AS course_count
            FROM courses c
            JOIN categories cat ON c.category_id = cat.id
            WHERE c.status NOT IN ('REJECTED', 'ARCHIVED')
              AND cat.department_id IS NOT NULL
            GROUP BY cat.department_id
        ) cc ON cc.department_id = d.id
        ORDER BY d.name ASC
    `);

    const data = result.rows.map(r => {
        const maxStudents = r.maxStudentsOverride ?? defaultMaxStudents;
        const maxCourses = r.maxCoursesOverride ?? defaultMaxCourses;
        return {
            id: r.departmentId,
            departmentId: r.departmentId,
            departmentName: r.departmentName,
            studentCount: r.studentCount,
            instructorCount: r.instructorCount,
            adminCount: r.adminCount,
            courseCount: r.courseCount,
            maxStudents,
            maxCourses,
            maxStudentsOverride: r.maxStudentsOverride,
            maxCoursesOverride: r.maxCoursesOverride,
            studentsOver: r.studentCount > maxStudents,
            coursesOver: r.courseCount > maxCourses,
        };
    });

    res.json({ defaults: { maxStudents: defaultMaxStudents, maxCourses: defaultMaxCourses }, data });
};

// GET /api/stats/categories
// GET /api/stats/categories/:id — full category detail with stats (courses, users, enrollments)
const getCategoryDetail = async (req, res) => {
    await assertCategoryInScope(req, req.params.id);
    const result = await query(`
        SELECT
            cat.*,
            COUNT(DISTINCT c.id)::int AS course_count,
            COUNT(DISTINCT e.student_id)::int AS user_count,
            COUNT(DISTINCT e.id)::int AS enrollment_count
        FROM categories cat
        LEFT JOIN courses c ON c.category_id = cat.id
        LEFT JOIN enrollments e ON e.course_id = c.id
        WHERE cat.id = $1
        GROUP BY cat.id
    `, [req.params.id]);
    if (!result.rows.length) throw createError('Category not found', 404);
    const { mapCategory } = require('../utils/formatters');
    res.json({
        ...mapCategory(result.rows[0]),
        courseCount: parseInt(result.rows[0].course_count),
        userCount: parseInt(result.rows[0].user_count),
        enrollmentCount: parseInt(result.rows[0].enrollment_count),
    });
};

// PUT /api/stats/categories/:id/courses — assign a course to this category
const assignCourseToCategory = async (req, res) => {
    await assertCategoryInScope(req, req.params.id);
    const { courseId } = req.body;
    if (!courseId) throw createError('courseId is required', 400);
    const course = await query('SELECT id, title FROM courses WHERE id = $1', [courseId]);
    if (!course.rows.length) throw createError('Course not found', 404);
    await query('UPDATE courses SET category_id = $1 WHERE id = $2', [req.params.id, courseId]);
    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'COURSE_ASSIGNED_CATEGORY', 'courses', courseId,
         JSON.stringify({ categoryId: req.params.id, courseTitle: course.rows[0].title })]
    ).catch(() => {});
    res.json({ success: true, courseId, categoryId: req.params.id });
};

// DELETE /api/stats/categories/:id/courses/:courseId — remove a course from this category
const removeCourseFromCategory = async (req, res) => {
    await assertCategoryInScope(req, req.params.id);
    const course = await query('SELECT id, title FROM courses WHERE id = $1', [req.params.courseId]);
    if (!course.rows.length) throw createError('Course not found', 404);
    await query('UPDATE courses SET category_id = NULL WHERE id = $1 AND category_id = $2',
        [req.params.courseId, req.params.id]);
    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'COURSE_REMOVED_CATEGORY', 'courses', req.params.courseId,
         JSON.stringify({ categoryId: req.params.id, courseTitle: course.rows[0].title })]
    ).catch(() => {});
    res.json({ success: true, courseId: req.params.courseId, categoryId: req.params.id });
};

const getCategories = async (req, res) => {
    // Public endpoint (no auth) → getDepartmentScope returns unscoped for anonymous
    // callers, so browsing is unaffected; a scoped ADMIN sees only their categories.
    const { scoped, departmentId } = getDepartmentScope(req);
    // Scoped admins see only their own department's categories (not global ones).
    const where = scoped ? 'WHERE cat.department_id = $1' : '';
    const values = scoped ? [departmentId] : [];
    const result = await query(`
        SELECT cat.*, COUNT(c.id) as course_count
        FROM categories cat
        LEFT JOIN courses c ON c.category_id = cat.id AND c.status = 'PUBLISHED'
        ${where}
        GROUP BY cat.id
        ORDER BY cat.name ASC
    `, values);
    const { mapCategory } = require('../utils/formatters');
    res.json(result.rows.map(mapCategory));
};

// A scoped ADMIN may only touch categories in their own department.
const assertCategoryInScope = async (req, categoryId) => {
    const { scoped, departmentId } = getDepartmentScope(req);
    if (!scoped) return;
    const r = await query('SELECT department_id FROM categories WHERE id = $1', [categoryId]);
    if (!r.rows.length) throw createError('Category not found', 404);
    // Scoped admins may ONLY access categories within their own department.
    if (r.rows[0].department_id !== departmentId) {
        throw createError('This category is outside your department', 403);
    }
};

const createCategory = async (req, res) => {
    const { name, icon } = req.body;
    if (!name) throw createError('Category name is required', 400);
    // New categories created by a scoped ADMIN are stamped with their department.
    const { scoped, departmentId } = getDepartmentScope(req);
    const result = await query(
        `INSERT INTO categories (name, icon, department_id) VALUES ($1, $2, $3) RETURNING *`,
        [name, icon || '📚', scoped ? departmentId : (req.body.departmentId || null)]
    );
    const { mapCategory } = require('../utils/formatters');
    res.status(201).json(mapCategory(result.rows[0]));
};

const updateCategory = async (req, res) => {
    await assertCategoryInScope(req, req.params.id);
    const { name, icon } = req.body;
    const result = await query(
        `UPDATE categories SET name = $1, icon = $2 WHERE id = $3 RETURNING *`,
        [name, icon, req.params.id]
    );
    if (!result.rows.length) throw createError('Category not found', 404);
    const { mapCategory } = require('../utils/formatters');
    res.json(mapCategory(result.rows[0]));
};

const deleteCategory = async (req, res) => {
    await assertCategoryInScope(req, req.params.id);
    const result = await query('DELETE FROM categories WHERE id = $1 RETURNING id, name', [req.params.id]);
    if (!result.rows.length) throw createError('Category not found', 404);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'CATEGORY_DELETED', 'categories', req.params.id,
         JSON.stringify({ name: result.rows[0].name })]
    ).catch(() => {});

    res.json({ success: true });
};

// POST /api/stats/categories/import — bulk create categories from CSV/XLSX.
// Columns (case-insensitive): name, icon (optional). Returns per-row results.
const importCategories = async (req, res) => {
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

    const { scoped, departmentId } = getDepartmentScope(req);

    // Normalize header keys to lowercase for lookup.
    const pick = (row, key) => {
        const found = Object.keys(row).find(k => k.trim().toLowerCase() === key);
        return found ? row[found] : '';
    };

    const results = [];
    for (const row of rows) {
        const name = String(pick(row, 'name')).trim();
        const icon = String(pick(row, 'icon') || '📚').trim() || '📚';
        try {
            if (!name) throw createError('Category name is required', 400);
            const exists = await query('SELECT id FROM categories WHERE LOWER(name) = LOWER($1)', [name]);
            if (exists.rows.length) throw createError('Category already exists', 409);
            const result = await query(
                `INSERT INTO categories (name, icon, department_id) VALUES ($1, $2, $3) RETURNING *`,
                [name, icon, scoped ? departmentId : null]
            );
            await query(
                `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
                [req.user.id, 'CATEGORY_IMPORTED', 'categories', result.rows[0].id]
            ).catch(() => { });
            const { mapCategory } = require('../utils/formatters');
            results.push({ ...mapCategory(result.rows[0]), status: 'created' });
        } catch (err) {
            results.push({ name, icon, status: 'error', error: err.message });
        }
    }

    const created = results.filter(r => r.status === 'created').length;
    res.status(201).json({ total: results.length, created, failed: results.length - created, results });
};

// GET /api/stats/public — lightweight, no auth required
// Cached for 30s since these values change slowly.
const getPublicStats = async (req, res) => {
    const CACHE_KEY = 'public_stats';
    const cached = cache.get(CACHE_KEY);
    if (cached) return res.json(cached);

    try {
        const [students, instructors, courses, ratings] = await Promise.all([
            query("SELECT COUNT(*) FROM users WHERE role = 'STUDENT'"),
            query("SELECT COUNT(*) FROM users WHERE role = 'INSTRUCTOR'"),
            query("SELECT COUNT(*) FROM courses WHERE status = 'PUBLISHED'"),
            query("SELECT ROUND(COALESCE(AVG(stars), 4.9), 1) as avg_rating FROM ratings"),
        ]);

        const avg = parseFloat(ratings.rows[0]?.avg_rating || 4.9);
        const satisfactionRate = Math.round((avg / 5) * 100);

        const data = {
            totalStudents: parseInt(students.rows[0].count),
            totalInstructors: parseInt(instructors.rows[0].count),
            totalCourses: parseInt(courses.rows[0].count),
            avgRating: avg,
            satisfactionRate: satisfactionRate
        };
        cache.set(CACHE_KEY, data, 30); // 30 second TTL
        res.json(data);
    } catch (err) {
        // Fallback to approximate numbers if DB is down to avoid breaking the homepage
        res.json({
            totalStudents: 10000,
            totalInstructors: 200,
            totalCourses: 50,
            avgRating: 4.9,
            satisfactionRate: 98,
            isFallback: true
        });
    }
};

const toDateKey = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const STREAK_ACTIONS = ['LESSON_COMPLETED', 'QUIZ_ATTEMPTED'];

// GET /api/stats/academic-sessions — list sessions (department-scoped)
const getAcademicSessions = async (req, res) => {
    const { scoped, departmentId } = getDepartmentScope(req);
    const where = scoped ? 'WHERE s.department_id = $1 OR s.department_id IS NULL' : '';
    const values = scoped ? [departmentId] : [];
    const result = await query(`
        SELECT s.*, d.name as department_name
        FROM academic_sessions s
        LEFT JOIN departments d ON s.department_id = d.id
        ${where}
        ORDER BY s.start_date DESC
    `, values);
    res.json(result.rows);
};

// POST /api/stats/academic-sessions
const createAcademicSession = async (req, res) => {
    const { name, departmentId, startDate, endDate, enrollmentOpen = true } = req.body;
    if (!name || !startDate || !endDate) throw createError('name, startDate, and endDate are required', 400);
    const { scoped } = getDepartmentScope(req);
    const result = await query(`
        INSERT INTO academic_sessions (name, department_id, start_date, end_date, enrollment_open)
        VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [name, scoped ? departmentId : (departmentId || null), startDate, endDate, enrollmentOpen]);
    res.status(201).json(result.rows[0]);
};

// PUT /api/stats/academic-sessions/:id
const updateAcademicSession = async (req, res) => {
    const { name, startDate, endDate, enrollmentOpen } = req.body;
    const result = await query(`
        UPDATE academic_sessions
        SET name = COALESCE($1, name),
            start_date = COALESCE($2, start_date),
            end_date = COALESCE($3, end_date),
            enrollment_open = COALESCE($4, enrollment_open)
        WHERE id = $5 RETURNING *
    `, [name, startDate, endDate, enrollmentOpen, req.params.id]);
    if (!result.rows.length) throw createError('Session not found', 404);
    res.json(result.rows[0]);
};

// DELETE /api/stats/academic-sessions/:id
const deleteAcademicSession = async (req, res) => {
    const result = await query('DELETE FROM academic_sessions WHERE id = $1 RETURNING id, name', [req.params.id]);
    if (!result.rows.length) throw createError('Session not found', 404);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'ACADEMIC_SESSION_DELETED', 'academic_sessions', req.params.id,
         JSON.stringify({ name: result.rows[0].name })]
    ).catch(() => {});

    res.json({ success: true });
};

const getStudentStreak = async (req, res) => {
    const studentId = req.user.id;

    // Get the cached streak and the weekly logs
    const [userReq, logsReq] = await Promise.all([
        query('SELECT current_streak FROM users WHERE id = $1', [studentId]),
        query(`
            SELECT DISTINCT DATE(created_at) as date
            FROM audit_logs
            WHERE user_id = $1
              AND created_at >= NOW() - INTERVAL '7 days'
              AND action = ANY($2::text[])
        `, [studentId, STREAK_ACTIONS])
    ]);

    const activeDates = logsReq.rows.map(r => toDateKey(new Date(r.date)));
    const currentStreak = userReq.rows[0]?.current_streak || 0;

    const streakDays = [];
    const activeStreak = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = toDateKey(d);
        const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
        streakDays.push(dayStr.charAt(0));
        activeStreak.push(activeDates.includes(dateStr));
    }

    res.json({ streakDays, activeStreak, currentStreak });
};

const getSystemHealth = async (req, res) => {
    const start = Date.now();
    let dbStatus = 'operational';
    let dbLatency = 0;

    try {
        await query('SELECT 1');
        dbLatency = Date.now() - start;
    } catch (err) {
        dbStatus = 'outage';
    }

    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    // Mock services that would normally be checked via health-check endpoints
    const services = [
        { name: 'API Server', desc: 'Core backend REST API', status: 'operational', uptime: '99.98%', latency: `${Math.round(Math.random() * 20 + 20)}ms`, icon: 'Server' },
        { name: 'Database (PostgreSQL)', desc: 'Primary relational database', status: dbStatus, uptime: '99.99%', latency: `${dbLatency}ms`, icon: 'Database' },
        { name: 'CDN / Storage', desc: 'Video and asset delivery', status: 'operational', uptime: '99.95%', latency: '18ms', icon: 'Globe' },
        { name: 'Authentication', desc: 'JWT token service', status: 'operational', uptime: '100%', latency: '12ms', icon: 'Shield' },
        { name: 'Email Service', desc: 'Transactional email delivery', status: 'operational', uptime: '99.2%', latency: '45ms', icon: 'Zap' },
        { name: 'WebSocket Server', desc: 'Real-time notifications', status: 'operational', uptime: '99.9%', latency: '5ms', icon: 'Activity' },
    ];

    res.json({
        services,
        memory: {
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            rss: Math.round(memoryUsage.rss / 1024 / 1024)
        },
        uptime: Math.round(uptime),
        nodeVersion: process.version,
        platform: process.platform,
        timestamp: new Date().toISOString()
    });
};

const getPlatformSettings = async (req, res) => {
    const result = await query("SELECT value FROM platform_settings WHERE key = 'global'");
    if (!result.rows.length) {
        throw createError('Settings not found', 404);
    }
    res.json(result.rows[0].value);
};

const updatePlatformSettings = async (req, res) => {
    const settings = req.body;
    if (!settings || typeof settings !== 'object') {
        throw createError('Invalid settings data', 400);
    }

    const result = await query(
        "UPDATE platform_settings SET value = $1, updated_at = NOW() WHERE key = 'global' RETURNING value",
        [JSON.stringify(settings)]
    );

    if (!result.rows.length) {
        throw createError('Settings not found', 404);
    }

    // Audit log
    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, ip_address) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'PLATFORM_SETTINGS_UPDATED', 'platform_settings', 'global', req.ip]
    ).catch(() => { });

    res.json(result.rows[0].value);
};

const MAX_IMPORT_ROWS = 500;

// GET /api/stats/departments — SUPER_ADMIN overview of every department with
// aggregated user, course, enrollment, revenue, and rating data in one query.
const getDepartmentsStats = async (req, res) => {
    const result = await query(`
        SELECT
            d.id,
            d.name,
            d.icon,
            d.max_students                            AS "maxStudentsOverride",
            d.max_courses                             AS "maxCoursesOverride",
            COALESCE(u_agg.students, 0)::int       AS "studentCount",
            COALESCE(u_agg.instructors, 0)::int    AS "instructorCount",
            COALESCE(u_agg.admins, 0)::int          AS "adminCount",
            COALESCE(c_agg.total, 0)::int           AS "courseTotal",
            COALESCE(c_agg.published, 0)::int       AS "coursePublished",
            COALESCE(c_agg.pending, 0)::int         AS "coursePending",
            COALESCE(e_agg.enrollments, 0)::int     AS "totalEnrollments",
            COALESCE(e_agg.revenue, 0)::float       AS "totalRevenue",
            COALESCE(r_agg.avg_rating, 0)::float    AS "avgRating",
            COALESCE(cat_agg.category_count, 0)::int AS "categoryCount"
        FROM departments d
        LEFT JOIN (
            SELECT department_id,
                   COUNT(*) FILTER (WHERE role = 'STUDENT')    AS students,
                   COUNT(*) FILTER (WHERE role = 'INSTRUCTOR') AS instructors,
                   COUNT(*) FILTER (WHERE role = 'ADMIN')      AS admins
            FROM users
            WHERE department_id IS NOT NULL
            GROUP BY department_id
        ) u_agg ON u_agg.department_id = d.id
        LEFT JOIN (
            SELECT cat.department_id,
                   COUNT(*)                                           AS total,
                   COUNT(*) FILTER (WHERE c.status = 'PUBLISHED')     AS published,
                   COUNT(*) FILTER (WHERE c.status = 'PENDING')       AS pending
            FROM courses c
            JOIN categories cat ON c.category_id = cat.id
            WHERE c.status NOT IN ('REJECTED', 'ARCHIVED')
              AND cat.department_id IS NOT NULL
            GROUP BY cat.department_id
        ) c_agg ON c_agg.department_id = d.id
        LEFT JOIN (
            SELECT cat.department_id,
                   COUNT(e.id)                                                      AS enrollments,                    0          AS revenue
            FROM enrollments e
            JOIN courses c2 ON e.course_id = c2.id
            JOIN categories cat ON c2.category_id = cat.id
            WHERE cat.department_id IS NOT NULL
            GROUP BY cat.department_id
        ) e_agg ON e_agg.department_id = d.id
        LEFT JOIN (
            SELECT cat.department_id,
                   ROUND(AVG(r.stars)::numeric, 1) AS avg_rating
            FROM ratings r
            JOIN courses c3 ON r.course_id = c3.id
            JOIN categories cat ON c3.category_id = cat.id
            WHERE cat.department_id IS NOT NULL
            GROUP BY cat.department_id
        ) r_agg ON r_agg.department_id = d.id
        LEFT JOIN (
            SELECT department_id, COUNT(*)::int AS category_count
            FROM categories
            WHERE department_id IS NOT NULL
            GROUP BY department_id
        ) cat_agg ON cat_agg.department_id = d.id
        ORDER BY d.name ASC
    `);

    res.json(result.rows);
};

// GET /api/stats/ai-report — SUPER_ADMIN only. Generates a structured
// platform report with computed insights, trends, comparisons, and
// recommendations — all data-driven (no external LLM needed).
const getAiReport = async (req, res) => {
    // Gather all the data we need in parallel
    const [
        platformRes, usersByRoleRes, topCoursesRes,
        topInstructorsRes, pendingCoursesRes, zeroEnrollCoursesRes,
        deptComparisons, deptDepRes
    ] = await Promise.all([
        query(`
            SELECT
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM courses WHERE status = 'PUBLISHED') as published_courses,
                (SELECT COUNT(*) FROM enrollments) as total_enrollments,
                (SELECT 0) as total_revenue,
                (SELECT COUNT(*) FROM users WHERE subscription_plan != 'FREE') as premium_subs,
                (SELECT COUNT(*) FROM courses WHERE status = 'PENDING') as pending_courses,
                (SELECT COUNT(*) FROM departments) as total_departments
        `),
        query(`SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC`),
        query(`
            SELECT c.title, c.enrollment_count, c.rating, c.review_count,
                   u.name as instructor_name
            FROM courses c JOIN users u ON c.instructor_id = u.id
            WHERE c.status = 'PUBLISHED'
            ORDER BY c.enrollment_count DESC LIMIT 5
        `),
        query(`
            SELECT u.name, u.avatar, COUNT(c.id) as course_count,
                   ROUND(AVG(r.stars)::numeric, 1) as avg_rating, COUNT(e.id) as total_students
            FROM users u
            JOIN courses c ON c.instructor_id = u.id
            LEFT JOIN enrollments e ON e.course_id = c.id
            LEFT JOIN ratings r ON r.course_id = c.id
            WHERE u.role = 'INSTRUCTOR'
            GROUP BY u.id ORDER BY total_students DESC LIMIT 5
        `),
        query(`
            SELECT c.title, c.created_at, u.name as instructor_name
            FROM courses c JOIN users u ON c.instructor_id = u.id
            WHERE c.status = 'PENDING'
            ORDER BY c.created_at DESC LIMIT 10
        `),
        query(`
            SELECT c.title, u.name as instructor_name
            FROM courses c JOIN users u ON c.instructor_id = u.id
            WHERE c.status = 'PUBLISHED' AND c.enrollment_count = 0
            ORDER BY c.created_at DESC LIMIT 10
        `),
        query(`
            SELECT d.name,
                   COALESCE(u_agg.users, 0)::int as users,
                   COALESCE(c_agg.courses, 0)::int as courses,
                   COALESCE(e_agg.enrollments, 0)::int as enrollments,                    0 as revenue
            FROM departments d
            LEFT JOIN (SELECT department_id, COUNT(*) as users FROM users WHERE department_id IS NOT NULL GROUP BY department_id) u_agg ON u_agg.department_id = d.id
            LEFT JOIN (SELECT cat.department_id, COUNT(*) as courses FROM courses c JOIN categories cat ON c.category_id = cat.id WHERE c.status = 'PUBLISHED' AND cat.department_id IS NOT NULL GROUP BY cat.department_id) c_agg ON c_agg.department_id = d.id
            LEFT JOIN (SELECT cat.department_id, COUNT(e.id) as enrollments, COALESCE(SUM(COALESCE(c2.discount_price, c2.price)), 0) as revenue FROM enrollments e JOIN courses c2 ON e.course_id = c2.id JOIN categories cat ON c2.category_id = cat.id WHERE cat.department_id IS NOT NULL GROUP BY cat.department_id) e_agg ON e_agg.department_id = d.id
            ORDER BY e_agg.enrollments DESC
        `),
        query(`
            SELECT
                (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_30d,
                (SELECT COUNT(*) FROM courses WHERE created_at >= NOW() - INTERVAL '30 days') as new_courses_30d,
                (SELECT COUNT(*) FROM enrollments WHERE enrolled_at >= NOW() - INTERVAL '30 days') as new_enrollments_30d,
                (SELECT 0) as revenue_30d,
                (SELECT COUNT(*) FROM enrollments WHERE enrolled_at >= NOW() - INTERVAL '7 days') as enrollments_7d,
                (SELECT COUNT(*) FROM enrollments WHERE enrolled_at >= NOW() - INTERVAL '14 days' AND enrolled_at < NOW() - INTERVAL '7 days') as enrollments_prev_7d
        `)
    ]);

    const platform = platformRes.rows[0];
    const usersByRole = usersByRoleRes.rows;
    const topCourses = topCoursesRes.rows;
    const topInstructors = topInstructorsRes.rows;
    const pendingCourses = pendingCoursesRes.rows;
    const zeroEnrollCourses = zeroEnrollCoursesRes.rows || [];
    const depComparisons = deptComparisons.rows;
    const growth = deptDepRes.rows[0];

    // Compute trends and insights
    const enrollTrend = growth.enrollments_7d > growth.enrollments_prev_7d ? 'up' :
                        growth.enrollments_7d < growth.enrollments_prev_7d ? 'down' : 'flat';

    const enrollmentChange = growth.enrollments_prev_7d > 0
        ? Math.round(((growth.enrollments_7d - growth.enrollments_prev_7d) / growth.enrollments_prev_7d) * 100)
        : 0;

    // Find best and worst performing departments
    const topDept = depComparisons[0];
    const bottomDept = depComparisons[depComparisons.length - 1];

    // Build the report
    const report = {
        generatedAt: new Date().toISOString(),
        period: {
            last30Days: {
                newUsers: parseInt(growth.new_users_30d),
                newCourses: parseInt(growth.new_courses_30d),
                newEnrollments: parseInt(growth.new_enrollments_30d),
                revenue: parseFloat(growth.revenue_30d),
            }
        },
        platform,
        usersByRole: usersByRole.map(r => ({ role: r.role, count: parseInt(r.count) })),
        topCourses: topCourses.map(c => ({
            title: c.title,
            enrollments: c.enrollment_count,
            rating: parseFloat(c.rating) || 0,
            reviews: c.review_count,
            instructor: c.instructor_name
        })),
        topInstructors: topInstructors.map(i => ({
            name: i.name,
            courses: i.course_count,
            rating: parseFloat(i.avg_rating) || 0,
            students: i.total_students
        })),
        pendingCourses: pendingCourses.map(c => ({
            title: c.title,
            instructor: c.instructor_name,
            created: c.created_at
        })),
        zeroEnrollCourses: zeroEnrollCourses.map(c => ({
            title: c.title,
            instructor: c.instructor_name
        })),
        departments: depComparisons.map(d => ({
            name: d.name,
            users: parseInt(d.users),
            courses: parseInt(d.courses),
            enrollments: parseInt(d.enrollments),
            revenue: parseFloat(d.revenue)
        })),
        insights: [],
        recommendations: []
    };

    // Compute insights
    if (platform.total_enrollments > 0) {
        report.insights.push({
            type: 'metric',
            title: 'Conversion Rate',
            value: `${Math.round((parseInt(platform.total_enrollments) / parseInt(platform.total_users)) * 100)}%`,
            detail: `${platform.total_enrollments} enrollments from ${platform.total_users} users`
        });
    }

    if (platform.total_revenue > 0 && platform.total_enrollments > 0) {
        report.insights.push({
            type: 'metric',
            title: 'Avg Revenue Per Enrollment',
            value: `₹${Math.round(parseFloat(platform.total_revenue) / parseInt(platform.total_enrollments))}`,
            detail: `Based on ${platform.total_enrollments} enrollments generating ₹${Math.round(parseFloat(platform.total_revenue)).toLocaleString()}`
        });
    }

    if (platform.premium_subs > 0) {
        const premiumPct = Math.round((parseInt(platform.premium_subs) / parseInt(platform.total_users)) * 100);
        report.insights.push({
            type: 'metric',
            title: 'Premium Conversion',
            value: `${premiumPct}%`,
            detail: `${platform.premium_subs} of ${platform.total_users} users on paid plans`
        });
    }

    // Enrollment trend
    const trendWord = enrollTrend === 'up' ? 'increasing' : enrollTrend === 'down' ? 'decreasing' : 'stable';
    report.insights.push({
        type: enrollTrend === 'down' ? 'warning' : 'success',
        title: `Enrollments ${trendWord}`,
        value: `${enrollmentChange > 0 ? '+' : ''}${enrollmentChange}%`,
        detail: `${growth.enrollments_7d} enrollments this week vs ${growth.enrollments_prev_7d} last week`
    });

    // Pending courses
    if (parseInt(platform.pending_courses) > 0) {
        report.insights.push({
            type: 'warning',
            title: 'Pending Approvals',
            value: `${platform.pending_courses} courses`,
            detail: `${platform.pending_courses} courses waiting for review — the oldest is from ${new Date(pendingCourses[pendingCourses.length - 1]?.created).toLocaleDateString() || 'unknown'}`
        });
    }

    // Zero-enrollment courses
    if (zeroEnrollCourses.length > 0) {
        report.insights.push({
            type: 'warning',
            title: 'Unpopular Courses',
            value: `${zeroEnrollCourses.length} courses`,
            detail: `${zeroEnrollCourses.length} published courses have zero enrollments`
        });
    }

    // Department comparison
    if (topDept && bottomDept && topDept.name !== bottomDept.name) {
        report.insights.push({
            type: 'info',
            title: 'Top Department',
            value: topDept.name,
            detail: `${topDept.enrollments} enrollments, ₹${Math.round(parseFloat(topDept.revenue)).toLocaleString()} revenue — ${Math.round((parseFloat(topDept.revenue) / (parseFloat(platform.total_revenue) || 1)) * 100)}% of platform`
        });
        report.insights.push({
            type: 'info',
            title: 'Needs Attention',
            value: bottomDept.name,
            detail: `${bottomDept.enrollments} enrollments — lowest performing department`
        });
    }

    // Growth indicators
    if (parseInt(growth.new_users_30d) > 0) {
        const pct = Math.round((parseInt(growth.new_users_30d) / parseInt(platform.total_users)) * 100);
        report.insights.push({
            type: 'success',
            title: 'User Growth (30d)',
            value: `${growth.new_users_30d} new`,
            detail: `${growth.new_users_30d} new users in last 30 days (${pct}% of total)`
        });
    }

    // Recommendations
    if (parseInt(platform.pending_courses) > 5) {
        report.recommendations.push({
            priority: 'high',
            title: 'Review pending courses',
            detail: `${platform.pending_courses} courses await approval. Consider batch-reviewing to reduce turnaround time.`
        });
    }

    if (zeroEnrollCourses.length > 3) {
        report.recommendations.push({
            priority: 'medium',
            title: 'Promote low-enrollment courses',
            detail: `${zeroEnrollCourses.length} courses have zero enrollments. Consider featuring them on the homepage or running a promotion.`
        });
    }

    if (depComparisons.length > 1) {
        const enrollmentSpread = depComparisons[0]?.enrollments - depComparisons[depComparisons.length - 1]?.enrollments;
        if (enrollmentSpread > 100) {
            report.recommendations.push({
                priority: 'medium',
                title: 'Balance department engagement',
                detail: `Enrollment gap between top and bottom departments is ${enrollmentSpread}. Consider cross-department content initiatives.`
            });
        }
    }

    const revenuePerUser = platform.total_enrollments > 0
        ? Math.round(parseFloat(platform.total_revenue) / parseInt(platform.total_users))
        : 0;
    if (revenuePerUser < 500) {
        report.recommendations.push({
            priority: 'low',
            title: 'Explore revenue optimization',
            detail: `Revenue per user is ₹${revenuePerUser}. Consider premium upsells or subscription-tier promotions.`
        });
    }

    if (parseInt(growth.new_enrollments_30d) > 50) {
        report.recommendations.push({
            priority: 'low',
            title: 'Leverage growth momentum',
            detail: `${growth.new_enrollments_30d} enrollments this month — strong growth! Consider introducing referral programs or bundle offers.`
        });
    }

    // Most popular course insight
    const topCourse = topCourses[0];
    if (topCourse) {
        report.recommendations.push({
            priority: 'low',
            title: 'Study top-performing content',
            detail: `"${topCourse.title}" (by ${topCourse.instructor_name}) leads with ${topCourse.enrollment_count} enrollments. Analyze what makes it successful and replicate.`
        });
    }

    res.json(report);
};

// GET /api/stats/students/progress — Admin view of student progress
const getStudentProgress = async (req, res) => {
    const { scoped, departmentId } = getDepartmentScope(req);
    const { limit = 50, offset = 0, courseId, search } = req.query;
    const { getPagination } = require('../utils/pagination');

    let conditions = ['u.role = $1'];
    const values = ['STUDENT'];
    let i = 2;

    if (scoped) {
        conditions.push(`u.department_id = $${i++}`);
        values.push(departmentId);
    }

    if (courseId) {
        conditions.push(`e.course_id = $${i++}`);
        values.push(courseId);
    }

    if (search) {
        conditions.push(`(u.name ILIKE $${i} OR u.email ILIKE $${i} OR u.roll_no ILIKE $${i})`);
        values.push(`%${search.replace(/[%_]/g, '\\$&')}%`);
        i++;
    }

    const where = conditions.join(' AND ');

    const countRes = await query(`
        SELECT COUNT(DISTINCT u.id)::int as total
        FROM users u
        LEFT JOIN enrollments e ON e.student_id = u.id
        WHERE ${where}
    `, values);

    const result = await query(`
        SELECT
            u.id, u.name, u.email, u.roll_no, u.avatar, u.department_id,
            d.name as department_name,
            COUNT(DISTINCT e.id)::int as enrolled_courses,
            COALESCE(AVG(e.progress), 0)::int as avg_progress,
            COUNT(DISTINCT CASE WHEN e.progress >= 100 THEN e.course_id END)::int as completed_courses,
            MAX(e.last_accessed) as last_active,
            (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.student_id = u.id) as quiz_attempts,
            (SELECT ROUND(AVG(qa.score)::numeric, 1) FROM quiz_attempts qa WHERE qa.student_id = u.id) as avg_quiz_score
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN enrollments e ON e.student_id = u.id
        ${scoped || departmentId ? '' : `LEFT JOIN enrollments e2 ON e2.student_id = u.id`}
        WHERE ${where}
        GROUP BY u.id, d.name
        ORDER BY last_active DESC NULLS LAST
        LIMIT $${i++} OFFSET $${i++}
    `, [...values, parseInt(limit), parseInt(offset)]);

    const pageNum = Math.floor(parseInt(offset) / parseInt(limit)) + 1;

    res.json({
        data: result.rows.map(r => ({
            id: r.id,
            name: r.name,
            email: r.email,
            rollNo: r.roll_no,
            avatar: r.avatar,
            departmentId: r.department_id,
            departmentName: r.department_name,
            enrolledCourses: r.enrolled_courses,
            avgProgress: r.avg_progress,
            completedCourses: r.completed_courses,
            lastActive: r.last_active,
            quizAttempts: r.quiz_attempts,
            avgQuizScore: r.avg_quiz_score,
        })),
        pagination: getPagination(countRes.rows[0].total, pageNum, limit)
    });
};

module.exports = {
    getPlatform,
    getInstructor,
    getAuditLogs,
    getAdminOverview,
    getCategories,
    getCategoryDetail,
    createCategory,
    updateCategory,
    deleteCategory,
    assignCourseToCategory,
    removeCourseFromCategory,
    getPublicStats,
    getStudentStreak,
    getStudentProgress,
    getSystemHealth,
    getPlatformSettings,
    updatePlatformSettings,
    importCategories,
    getDepartmentsStats,
    getAiReport,
    getAcademicSessions,
    createAcademicSession,
    updateAcademicSession,
    deleteAcademicSession,
};
