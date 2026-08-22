// Department limit helpers shared across approval, user creation, and the
// dashboard. Effective limits = department override (departments.max_students /
// max_courses) → platform global default (defaultMaxStudentsPerAdmin /
// defaultMaxCoursesPerAdmin). Enforcement blocks at count >= limit; a
// "limit reached" notification goes to the department's admins AND all super
// admins (for a limit-review discussion), deduped per (user, type) within 24h.

const { query } = require('../db/pool');

// Resolve the effective student/course limits for a department.
const getEffectiveLimits = async (deptId) => {
    const settingsRes = await query("SELECT value FROM platform_settings WHERE key = 'global'");
    const settings = settingsRes.rows[0]?.value || {};
    const defaultMaxStudents = Number(settings.defaultMaxStudentsPerAdmin ?? 500);
    const defaultMaxCourses = Number(settings.defaultMaxCoursesPerAdmin ?? 100);

    if (!deptId) {
        return { deptName: null, maxStudents: defaultMaxStudents, maxCourses: defaultMaxCourses };
    }
    const dept = await query('SELECT name, max_students, max_courses FROM departments WHERE id = $1', [deptId]);
    const row = dept.rows[0];
    return {
        deptName: row?.name || null,
        maxStudents: row?.max_students ?? defaultMaxStudents,
        maxCourses: row?.max_courses ?? defaultMaxCourses,
    };
};

// Current usage for a department. Courses are tied to a department via their
// category (uncategorized courses fall back to the instructor's department) —
// the same rule the admin course list uses, so enforcement matches what admins
// see in the dashboard.
const getDeptCounts = async (deptId) => {
    const [students, courses] = await Promise.all([
        query(
            "SELECT COUNT(*)::int AS c FROM users WHERE department_id = $1 AND role = 'STUDENT'",
            [deptId]
        ),
        query(`
            SELECT COUNT(*)::int AS c
            FROM courses c
            LEFT JOIN categories cat ON c.category_id = cat.id
            LEFT JOIN users u ON c.instructor_id = u.id
            WHERE c.status NOT IN ('REJECTED', 'ARCHIVED')
              AND (cat.department_id = $1 OR (c.category_id IS NULL AND u.department_id = $1))
        `, [deptId]),
    ]);
    return { studentCount: students.rows[0]?.c || 0, courseCount: courses.rows[0]?.c || 0 };
};

// Full capacity picture — limits + usage + "at limit" flags. Used by both the
// enforcement paths and the admin dashboard visuals.
const getDeptCapacity = async (deptId) => {
    const [limits, counts] = await Promise.all([getEffectiveLimits(deptId), getDeptCounts(deptId)]);
    return {
        ...limits,
        ...counts,
        studentLimit: limits.maxStudents,
        courseLimit: limits.maxCourses,
        studentsAtLimit: counts.studentCount >= limits.maxStudents,
        coursesAtLimit: counts.courseCount >= limits.maxCourses,
    };
};

// Notify the department's admins + all super admins that a limit has been hit.
// Dedupes per (user, type) within 24 hours so repeated blocked attempts don't spam.
const notifyLimitReached = async (deptId, kind, capacity = null) => {
    // Callers that already computed the capacity (e.g. a blocked import loop)
    // can pass it in to avoid re-running the count queries on every row.
    const cap = capacity || await getDeptCapacity(deptId);
    const type = kind === 'students' ? 'student_limit' : 'course_limit';
    const label = kind === 'students' ? 'student' : 'course';
    const limit = kind === 'students' ? cap.maxStudents : cap.maxCourses;
    const count = kind === 'students' ? cap.studentCount : cap.courseCount;
    const deptLabel = cap.deptName || 'this department';
    const action = kind === 'courses' ? 'approve more courses' : 'add more students';
    const message = `⚠️ ${label[0].toUpperCase()}${label.slice(1)} limit reached in ${deptLabel}: ${count} of ${limit} used. You can't ${action} until a Super Admin raises the limit.`;

    const [admins, superAdmins] = await Promise.all([
        query(
            "SELECT id FROM users WHERE department_id = $1 AND role = 'ADMIN' AND active = true",
            [deptId]
        ),
        query("SELECT id FROM users WHERE role = 'SUPER_ADMIN' AND active = true"),
    ]);
    const targets = new Set();
    admins.rows.forEach(r => targets.add(r.id));
    superAdmins.rows.forEach(r => targets.add(r.id));

    // Batch the dedupe + insert into a single statement (was N+1: one
    // SELECT + one INSERT per target). NOT EXISTS preserves the 24h
    // per-(user, type) dedupe semantics exactly.
    const targetIds = [...targets];
    if (targetIds.length) {
        await query(
            `INSERT INTO notifications (user_id, message, type, link)
             SELECT t.id, $1, $2, $3
             FROM unnest($4::uuid[]) AS t(id)
             WHERE NOT EXISTS (
                 SELECT 1 FROM notifications n
                 WHERE n.user_id = t.id AND n.type = $2
                   AND n.created_at > NOW() - INTERVAL '24 hours'
             )`,
            [message, type, '/admin', targetIds]
        ).catch(() => {});
    }
};

module.exports = { getEffectiveLimits, getDeptCounts, getDeptCapacity, notifyLimitReached };
