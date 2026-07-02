// Real API layer — connects to NeonDB backend via Express
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─── HTTP Helper ──────────────────────────────────────────────────────────────
const http = async (method, path, body = null, token = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${BASE_URL}${path}`, options);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        if (res.status === 401 || data.error === 'Invalid token' || data.error === 'Token expired') {
            console.error('Authentication Error Details:', data);
            // localStorage.removeItem('lms_token'); // Don't clear yet
            // window.location.href = '/login?expired=true';
        }
        throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }
    return data;
};

const getToken = () => localStorage.getItem('lms_token');

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const authAPI = {
    login: async (email, password) => {
        return http('POST', '/auth/login', { email, password });
    },

    register: async (name, email, password, role = 'STUDENT') => {
        return http('POST', '/auth/register', { name, email, password, role });
    },

    verifyToken: async (token) => {
        return http('GET', '/auth/me', null, token);
    },

    updateProfile: async (userId, updates) => {
        return http('PUT', '/auth/profile', updates, getToken());
    },

    changePassword: async (userId, currentPassword, newPassword) => {
        return http('PUT', '/auth/change-password', { currentPassword, newPassword }, getToken());
    },

    requestPasswordReset: async (email) => {
        return http('POST', '/auth/reset-password/request', { email });
    },

    resetPassword: async (email, otp, newPassword) => {
        return http('POST', '/auth/reset-password', { email, otp, newPassword });
    },

    verifyOTP: async (email, otp) => {
        return http('POST', '/auth/verify-otp', { email, otp });
    },

    loginWithDemo: async (role = 'STUDENT') => {
        return http('POST', '/auth/demo', { role });
    },
};

// ─── COURSES ─────────────────────────────────────────────────────────────────
export const coursesAPI = {
    getAll: async (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.status) params.set('status', filters.status);
        if (filters.admin) params.set('admin', 'true');
        if (filters.category) params.set('category', filters.category);
        if (filters.search) params.set('search', filters.search);
        if (filters.level) params.set('level', filters.level);
        if (filters.sort) params.set('sort', filters.sort);
        if (filters.limit) params.set('limit', filters.limit);
        const token = filters.admin ? getToken() : null;
        const res = await http('GET', `/courses?${params.toString()}`, null, token);
        return res.data || [];
    },

    getById: async (id) => http('GET', `/courses/${id}`),

    getLessons: async (courseId) => http('GET', `/courses/${courseId}/lessons`),

    getByInstructor: async (instructorId) =>
        http('GET', `/courses/instructor/${instructorId}`, null, getToken()),

    create: async (data) =>
        http('POST', '/courses', data, getToken()),

    update: async (id, data) =>
        http('PUT', `/courses/${id}`, data, getToken()),

    approve: async (id) =>
        http('PUT', `/courses/${id}/approve`, {}, getToken()),

    reject: async (id) =>
        http('PUT', `/courses/${id}/reject`, {}, getToken()),

    delete: async (id) =>
        http('DELETE', `/courses/${id}`, null, getToken()),

    createSection: async (courseId, data) =>
        http('POST', `/courses/${courseId}/sections`, data, getToken()),

    updateSection: async (sectionId, data) =>
        http('PUT', `/courses/sections/${sectionId}`, data, getToken()),

    deleteSection: async (sectionId) =>
        http('DELETE', `/courses/sections/${sectionId}`, null, getToken()),

    createLesson: async (courseId, data) =>
        http('POST', `/courses/${courseId}/lessons`, data, getToken()),

    updateLesson: async (lessonId, data) =>
        http('PUT', `/courses/lessons/${lessonId}`, data, getToken()),

    deleteLesson: async (lessonId) =>
        http('DELETE', `/courses/lessons/${lessonId}`, null, getToken()),
};

// ─── ENROLLMENTS ─────────────────────────────────────────────────────────────
export const enrollmentsAPI = {
    getByStudent: async (studentId) => {
        const res = await http('GET', `/enrollments/student/${studentId}`, null, getToken());
        return res.data || [];
    },

    enroll: async (studentId, courseId) =>
        http('POST', '/enrollments', { courseId }, getToken()),

    updateProgress: async (studentId, courseId, lessonId) =>
        http('PUT', '/enrollments/progress', { courseId, lessonId }, getToken()),

    markLessonComplete: async (studentId, courseId, lessonId) =>
        http('PUT', '/enrollments/progress', { courseId, lessonId }, getToken()),

    getStats: async (instructorId) => {
        const res = await http('GET', `/enrollments/stats/${instructorId}`, null, getToken());
        return res.data || [];
    },
};

// ─── QUIZZES ─────────────────────────────────────────────────────────────────
export const quizzesAPI = {
    getByCourse: async (courseId) =>
        http('GET', `/quizzes/course/${courseId}`, null, getToken()),

    getById: async (id) =>
        http('GET', `/quizzes/${id}`, null, getToken()),

    startAttempt: async (quizId) =>
        http('POST', `/quizzes/${quizId}/start`, {}, getToken()),

    submitAttempt: async (quizId, attemptId, answers, violations) =>
        http('POST', `/quizzes/${quizId}/attempt`, { attemptId, answers, violations }, getToken()),

    getAttempts: async (studentId) =>
        http('GET', `/quizzes/attempts/${studentId}`, null, getToken()),

    createQuiz: async (quizData) =>
        http('POST', '/quizzes', quizData, getToken()),
};

// ─── RATINGS ─────────────────────────────────────────────────────────────────
export const ratingsAPI = {
    getAll: async () =>
        http('GET', '/ratings', null, getToken()),

    getByInstructor: async (instructorId) =>
        http('GET', `/ratings/instructor/${instructorId}`, null, getToken()),

    getByCourse: async (courseId) =>
        http('GET', `/ratings/course/${courseId}`),

    getMyRating: async (courseId) =>
        http('GET', `/ratings/my/${courseId}`, null, getToken()),

    getByStudent: async (studentId) =>
        http('GET', `/ratings/student/${studentId}`, null, getToken()),

    create: async (courseId, studentId, stars, comment) =>
        http('POST', '/ratings', { courseId, stars, comment }, getToken()),

    replyToReview: async (ratingId, reply) =>
        http('PUT', `/ratings/${ratingId}/reply`, { reply }, getToken()),

    likeReview: async (ratingId) =>
        http('PUT', `/ratings/${ratingId}/like`, {}, getToken()),

    delete: async (ratingId) =>
        http('DELETE', `/ratings/${ratingId}`, null, getToken()),
};

// ─── USERS (Admin) ────────────────────────────────────────────────────────────
export const usersAPI = {
    getAll: async () => {
        const res = await http('GET', '/users', null, getToken());
        return res.data || res; // handle both wrapped and plain
    },

    updateRole: async (userId, role) =>
        http('PUT', `/users/${userId}/role`, { role }, getToken()),

    toggleStatus: async (userId) =>
        http('PUT', `/users/${userId}/toggle-status`, {}, getToken()),

    assignPlan: async (userId, plan) =>
        http('PUT', `/users/${userId}/subscription`, { plan }, getToken()),

    delete: async (userId) =>
        http('DELETE', `/users/${userId}`, null, getToken()),

    submitInstructorRequest: async (data) =>
        http('POST', '/users/instructor-request', data, getToken()),

    getInstructorRequests: async () =>
        http('GET', '/users/instructor-requests', null, getToken()),

    approveInstructorRequest: async (id, action) =>
        http('PUT', `/users/instructor-requests/${id}/approve`, { action }, getToken()),

    getInstructorProfile: async (id) =>
        http('GET', `/users/instructor/${id}`, null, getToken()),

    followInstructor: async (id) =>
        http('POST', `/users/instructor/${id}/follow`, {}, getToken()),

    unfollowInstructor: async (id) =>
        http('POST', `/users/instructor/${id}/unfollow`, {}, getToken()),

    inviteAdmin: async (data) =>
        http('POST', '/users/invite-admin', data, getToken()),
};

// ─── SUBSCRIPTIONS ────────────────────────────────────────────────────────────
export const subscriptionsAPI = {
    getPlans: async () =>
        http('GET', '/subscriptions/plans'),

    upgrade: async (userId, planId) =>
        http('POST', '/subscriptions/upgrade', { planId }, getToken()),

    updatePlan: async (planId, data) =>
        http('PUT', `/subscriptions/plans/${planId}`, data, getToken()),
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
export const notificationsAPI = {
    getByUser: async (userId) => {
        const res = await http('GET', '/notifications', null, getToken());
        return res.data || [];
    },

    markRead: async (userId, notifId) =>
        http('PUT', `/notifications/${notifId}/read`, {}, getToken()),

    markAllRead: async (userId) =>
        http('PUT', '/notifications/read-all', {}, getToken()),

    clearAll: async () =>
        http('DELETE', '/notifications/clear-all', null, getToken()),

    create: async (data) =>
        http('POST', '/notifications', data, getToken()),
};

// ─── STATS ────────────────────────────────────────────────────────────────────
export const statsAPI = {
    getPublic: async () =>
        http('GET', '/stats/public'),

    getPlatform: async () =>
        http('GET', '/stats/platform', null, getToken()),

    getInstructor: async (instructorId) =>
        http('GET', `/stats/instructor/${instructorId}`, null, getToken()),

    getAuditLogs: async () =>
        http('GET', '/stats/audit-logs', null, getToken()),

    getStudentStreak: async () =>
        http('GET', '/stats/student/streak', null, getToken()),

    getSystemHealth: async () =>
        http('GET', '/stats/system-health', null, getToken()),

    getCategories: async () =>
        http('GET', '/stats/categories'),

    createCategory: async (data) =>
        http('POST', '/stats/categories', data, getToken()),

    updateCategory: async (id, data) =>
        http('PUT', `/stats/categories/${id}`, data, getToken()),

    deleteCategory: async (id) =>
        http('DELETE', `/stats/categories/${id}`, null, getToken()),

    getSettings: async () =>
        http('GET', '/stats/settings', null, getToken()),

    updateSettings: async (settings) =>
        http('PUT', '/stats/settings', settings, getToken()),
};

// ─── WISHLIST ─────────────────────────────────────────────────────────────────
export const wishlistAPI = {
    toggle: async (userId, courseId) =>
        http('POST', '/wishlist/toggle', { courseId }, getToken()),

    get: async (userId) => {
        const res = await http('GET', '/wishlist', null, getToken());
        return res.data || [];
    },
};

// ─── UPLOADS ──────────────────────────────────────────────────────────────────
export const uploadAPI = {
    uploadMedia: async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${BASE_URL}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            },
            body: formData
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
        return data; // Returns { url, public_id, format, resource_type }
    },

    uploadProfilePhoto: async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${BASE_URL}/upload/profile-photo`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            },
            body: formData
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
        return data;
    }
};
