/** Shared API response normalizers (snake_case DB → camelCase frontend) */

const toNumberOrNull = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
};

const mapUser = (u) => {
    if (!u) return u;
    return {
        ...u,
        currentStreak: parseInt(u.current_streak ?? u.currentStreak ?? 0),
        longestStreak: parseInt(u.longest_streak ?? u.longestStreak ?? 0),
        departmentId: u.department_id ?? u.departmentId ?? null,
        departmentName: u.department_name ?? u.departmentName ?? null,
        rollNo: u.roll_no ?? u.rollNo ?? null,
        username: u.username ?? null,
        lastLogin: u.last_login ?? u.lastLogin ?? null,
        designation: u.designation ?? null,
        qualification: u.qualification ?? null,
        specialization: u.specialization ?? null,
        year: u.year ?? null,
        semester: u.semester ?? null,
        section: u.section ?? null,
        batch: u.batch ?? null,
        mustChangePassword: u.must_change_password ?? u.mustChangePassword ?? false,
        createdAt: u.created_at || u.createdAt,
    };
};

const mapDepartment = (d) => ({
    ...d,
    hod: d.hod ?? '',
    contactEmail: d.contact_email ?? d.contactEmail ?? '',
    contactNumber: d.contact_number ?? d.contactNumber ?? '',
    createdAt: d.created_at || d.createdAt,
});

const mapCourse = (c) => ({
    ...c,
    shortDesc: c.short_desc,
    learningOutcomes: c.what_you_learn || [],
    prerequisites: c.requirements || [],
    reviewCount: c.review_count,
    enrollmentCount: c.enrollment_count,
    certificate: c.certificate,
    lessonsCount: parseInt(c.lessonsCount ?? c.lessons_count ?? 0, 10) || 0,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    category: c.categoryName,
    categoryId: c.categoryId,
    categoryIcon: c.categoryIcon,
    reviewNote: c.review_note ?? c.reviewNote ?? null,
    departmentId: c.departmentId,
    departmentName: c.departmentName,
    instructorBio: c.instructorBio,
    instructorRole: c.instructorRole,
    instructorJoined: c.instructorJoined,
    // Many-to-many bucket assignments (may contain several values each).
    semesters: Array.isArray(c.semesters) ? c.semesters.map(Number).sort((a, b) => a - b) : (c.semester != null ? [Number(c.semester)] : []),
    years: Array.isArray(c.years) ? c.years.map(Number).sort((a, b) => a - b) : [],
});

const mapCategory = (cat) => ({
    ...cat,
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    departmentId: cat.department_id ?? cat.departmentId ?? null,
    courseCount: parseInt(cat.course_count ?? cat.courseCount ?? 0, 10) || 0,
    studentCount: parseInt(cat.student_count ?? cat.studentCount ?? 0, 10) || 0,
    enrollmentCount: parseInt(cat.enrollment_count ?? cat.enrollmentCount ?? 0, 10) || 0,
    avgRating: cat.avg_rating != null ? parseFloat(cat.avg_rating) : (cat.avgRating ?? null),
    createdAt: cat.created_at || cat.createdAt,
});

const mapInstructorRequest = (r) => ({
    ...r,
    userName: r.user_name || r.userName,
    userEmail: r.user_email || r.userEmail,
    sampleTopic: r.sample_topic || r.sampleTopic,
    userId: r.user_id || r.userId,
    createdAt: r.created_at || r.createdAt,
});

const mapEnrollment = (e) => ({
    ...e,
    completedLessons: e.completed_lessons || [],
    lastAccessed: e.last_accessed || e.lastAccessed,
    enrolledAt: e.enrolled_at || e.enrolledAt,
    completedAt: e.completed_at || e.completedAt || null,
    versionId: e.version_id || e.versionId || null,
    courseId: e.courseId || e.course_id,
    course: {
        id: e.courseId || e.course_id,
        title: e.title,
        thumbnail: e.thumbnail,
        level: e.level,
        duration: e.duration,
        instructorName: e.instructorName,
        instructorAvatar: e.instructorAvatar,
    },
});

const mapNotification = (n) => ({
    ...n,
    createdAt: n.created_at || n.createdAt,
    link: n.link || '',
});

const mapQuizAttempt = (r) => ({
    ...r,
    quizId: r.quiz_id,
    studentId: r.student_id,
    completedAt: r.completed_at,
    timeTaken: r.time_taken,
    violations: r.violations ?? 0,
    quiz: { title: r.quiz_title, passingScore: r.passing_score },
    course: { id: r.course_id, title: r.course_title },
});

const mapRating = (r) => ({
    ...r,
    courseId: r.course_id,
    studentId: r.student_id,
    studentName: r.studentName || r.student_name,
    studentAvatar: r.studentAvatar || r.student_avatar,
    instructorReply: r.instructor_reply,
    createdAt: r.created_at,
});

module.exports = {
    mapUser,
    mapCourse,
    mapCategory,
    mapDepartment,
    mapInstructorRequest,
    mapEnrollment,
    mapNotification,
    mapQuizAttempt,
    mapRating,
};
