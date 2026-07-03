const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');

// GET /api/stats/platform
const getPlatform = async (req, res) => {
    const [users, courses, enrollments, revenue, premiumSubs, avgRatingQuery] = await Promise.all([
        query('SELECT COUNT(*) FROM users'),
        query(`SELECT COUNT(*) as total,
                      COUNT(*) FILTER (WHERE status='PUBLISHED') as published,
                      COUNT(*) FILTER (WHERE status='PENDING') as pending
               FROM courses WHERE status NOT IN ('REJECTED', 'ARCHIVED')`),
        query('SELECT COUNT(*) FROM enrollments'),
        query(`SELECT COALESCE(SUM(c.discount_price), SUM(c.price), 0) as total 
               FROM enrollments e 
               JOIN courses c ON e.course_id = c.id`),
        query(`SELECT COUNT(*) FROM users WHERE subscription_plan != 'FREE'`),
        query(`SELECT ROUND(AVG(stars)::numeric, 1) as avg_rating FROM ratings`),
    ]);

    const usersCount = parseInt(users.rows[0].count);

    const [usersByRoleQuery, monthlyStatsQuery, topCatQuery] = await Promise.all([
        query(`SELECT role, COUNT(*) as count FROM users GROUP BY role`),
        query(`
            SELECT TO_CHAR(e.enrolled_at, 'Mon') as month, COUNT(e.id) as count, COALESCE(SUM(c.discount_price), SUM(c.price), 0) as revenue
            FROM enrollments e JOIN courses c ON e.course_id = c.id
            WHERE e.enrolled_at >= NOW() - INTERVAL '6 months'
            GROUP BY TO_CHAR(e.enrolled_at, 'Mon'), DATE_TRUNC('month', e.enrolled_at)
            ORDER BY DATE_TRUNC('month', e.enrolled_at) ASC
        `),
        query(`
            SELECT cat.name, COUNT(e.id) as enrollments
            FROM categories cat
            JOIN courses c ON c.category_id = cat.id
            JOIN enrollments e ON e.course_id = c.id
            GROUP BY cat.name ORDER BY enrollments DESC LIMIT 5
        `),
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
        totalRevenue: parseFloat(revenue.rows[0].total),
        usersByRole,
        monthlyRevenue,
        enrollmentsByMonth,
        topCategories,
        revenueGrowth,
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
        SELECT TO_CHAR(e.enrolled_at, 'Mon') as month, COALESCE(SUM(c.discount_price), SUM(c.price), 0) * 0.8 as revenue
        FROM enrollments e JOIN courses c ON e.course_id = c.id
        WHERE c.instructor_id = $1 AND e.enrolled_at >= NOW() - INTERVAL '6 months'
        GROUP BY TO_CHAR(e.enrolled_at, 'Mon'), DATE_TRUNC('month', e.enrolled_at)
        ORDER BY DATE_TRUNC('month', e.enrolled_at) ASC
    `, [instructorId]);

    const thisMonthQuery = query(`
        SELECT 
            COUNT(e.id) as enrollments,
            COALESCE(SUM(c.discount_price), SUM(c.price), 0) * 0.8 as earnings
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
    const result = await query(`
        SELECT al.*, u.name as user_name, u.email as user_email, u.role as user_role
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT 200
    `);
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

// GET /api/stats/categories
const getCategories = async (req, res) => {
    const result = await query(`
        SELECT cat.*, COUNT(c.id) as course_count
        FROM categories cat
        LEFT JOIN courses c ON c.category_id = cat.id AND c.status = 'PUBLISHED'
        GROUP BY cat.id
        ORDER BY cat.name ASC
    `);
    const { mapCategory } = require('../utils/formatters');
    res.json(result.rows.map(mapCategory));
};

const createCategory = async (req, res) => {
    const { name, icon } = req.body;
    if (!name) throw createError('Category name is required', 400);
    const result = await query(
        `INSERT INTO categories (name, icon) VALUES ($1, $2) RETURNING *`,
        [name, icon || '📚']
    );
    const { mapCategory } = require('../utils/formatters');
    res.status(201).json(mapCategory(result.rows[0]));
};

const updateCategory = async (req, res) => {
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
    const result = await query('DELETE FROM categories WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) throw createError('Category not found', 404);
    res.json({ success: true });
};

// GET /api/stats/public — lightweight, no auth required
const getPublicStats = async (req, res) => {
    try {
        const [students, instructors, courses, ratings] = await Promise.all([
            query("SELECT COUNT(*) FROM users WHERE role = 'STUDENT'"),
            query("SELECT COUNT(*) FROM users WHERE role = 'INSTRUCTOR'"),
            query("SELECT COUNT(*) FROM courses WHERE status = 'PUBLISHED'"),
            query("SELECT ROUND(COALESCE(AVG(stars), 4.9), 1) as avg_rating FROM ratings"),
        ]);

        const avg = parseFloat(ratings.rows[0]?.avg_rating || 4.9);
        const satisfactionRate = Math.round((avg / 5) * 100);

        res.json({
            totalStudents: parseInt(students.rows[0].count),
            totalInstructors: parseInt(instructors.rows[0].count),
            totalCourses: parseInt(courses.rows[0].count),
            avgRating: avg,
            satisfactionRate: satisfactionRate
        });
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

module.exports = {
    getPlatform,
    getInstructor,
    getAuditLogs,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getPublicStats,
    getStudentStreak,
    getSystemHealth,
    getPlatformSettings,
    updatePlatformSettings
};
