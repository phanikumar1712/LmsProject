/** Shared API response normalizers (snake_case DB → camelCase frontend) */

const VALID_PLANS = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'];

const normalizePlan = (plan) => {
    if (!plan) return 'FREE';
    const p = String(plan).toUpperCase();
    if (p === 'PREMIUM') return 'PRO';
    if (p === 'BASE') return 'BASIC';
    return VALID_PLANS.includes(p) ? p : 'FREE';
};

const mapUser = (u) => {
    if (!u) return u;
    return {
        ...u,
        subscriptionPlan: normalizePlan(u.subscription_plan || u.subscriptionPlan),
        subscriptionExpiry: u.subscription_expiry || u.subscriptionExpiry || null,
        currentStreak: parseInt(u.current_streak ?? u.currentStreak ?? 0),
        longestStreak: parseInt(u.longest_streak ?? u.longestStreak ?? 0),
        createdAt: u.created_at || u.createdAt,
    };
};

const mapCourse = (c) => ({
    ...c,
    shortDesc: c.short_desc,
    discountPrice: c.discount_price,
    learningOutcomes: c.what_you_learn || [],
    prerequisites: c.requirements || [],
    reviewCount: c.review_count,
    enrollmentCount: c.enrollment_count,
    certificate: c.certificate,
    requiredPlan: normalizePlan(c.required_plan || c.requiredPlan),
    lessonsCount: parseInt(c.lessonsCount ?? c.lessons_count ?? 0, 10) || 0,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    category: c.categoryName,
    categoryId: c.categoryId,
    categoryIcon: c.categoryIcon,
    instructorBio: c.instructorBio,
    instructorRole: c.instructorRole,
    instructorEarnings: c.instructorEarnings,
    instructorPlan: normalizePlan(c.instructorPlan),
    instructorJoined: c.instructorJoined,
});

const mapCategory = (cat) => ({
    ...cat,
    courseCount: parseInt(cat.course_count ?? cat.courseCount ?? 0, 10) || 0,
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
    normalizePlan,
    mapUser,
    mapCourse,
    mapCategory,
    mapInstructorRequest,
    mapEnrollment,
    mapNotification,
    mapQuizAttempt,
    mapRating,
    VALID_PLANS,
};
