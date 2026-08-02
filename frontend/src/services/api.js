// Real API layer — connects to NeonDB backend via Express
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─── HTTP Helper ──────────────────────────────────────────────────────────────
// Default timeout for regular API calls (60s).
// Bulk imports have their own longer timeout (120s) via AbortController.
const DEFAULT_TIMEOUT_MS = 60000;

const http = async (method, path, body = null, token = null, { signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Chain external signal + our own timeout via a single AbortController
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (signal) {
        signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
        const options = { method, headers, signal: controller.signal };
        if (body) options.body = JSON.stringify(body);

        const res = await fetch(`${BASE_URL}${path}`, options);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            if (res.status === 401) {
                console.error('Authentication Error Details:', data);
                // Clear stale token and redirect to login
                localStorage.removeItem('lms_token');
                if (!window.location.pathname.includes('/login')) {
                    window.location.href = '/login?expired=true';
                }
            }
            throw new Error(data.error || data.message || `HTTP ${res.status}`);
        }
        return data;
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('Request timed out. The server may be starting up or under load. Please try again.', { cause: err });
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
};

const getToken = () => localStorage.getItem('lms_token');

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const authAPI = {
    login: async (email, password) => {
        return http('POST', '/auth/login', { email, password });
    },

    register: async (name, email, password, role = 'STUDENT', departmentId = null, rollNo = null) => {
        return http('POST', '/auth/register', { name, email, password, role, departmentId, rollNo });
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
    // Long-running / slow endpoints get an extended 120s timeout
    getAll: async (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.status) params.set('status', filters.status);
        if (filters.admin) params.set('admin', 'true');
        if (filters.category) params.set('category', filters.category);
        if (filters.search) params.set('search', filters.search);
        if (filters.level) params.set('level', filters.level);
        if (filters.sort) params.set('sort', filters.sort);
        if (filters.limit) params.set('limit', filters.limit);
        if (filters.departmentId) params.set('departmentId', filters.departmentId);
        const token = filters.admin ? getToken() : null;
        const opts = filters.admin ? { timeoutMs: 120000 } : {};
        const res = await http('GET', `/courses?${params.toString()}`, null, token, opts);
        return res.data || [];
    },

    getById: async (id) => http('GET', `/courses/${id}`),

    getLessons: async (courseId) => http('GET', `/courses/${courseId}/lessons`, null, getToken()),

    getByInstructor: async (instructorId) =>
        http('GET', `/courses/instructor/${instructorId}`, null, getToken()),

    create: async (data) =>
        http('POST', '/courses', data, getToken()),

    update: async (id, data) =>
        http('PUT', `/courses/${id}`, data, getToken()),

    approve: async (id) =>
        http('PUT', `/courses/${id}/approve`, {}, getToken()),

    reject: async (id, reason = '') =>
        http('PUT', `/courses/${id}/reject`, { reason }, getToken()),

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

    // ── CONTENT VERSIONING ─────────────────────────────────────────────────
    getVersions: async (courseId) =>
        http('GET', `/courses/${courseId}/versions`, null, getToken()),

    createVersion: async (courseId, data) =>
        http('POST', `/courses/${courseId}/versions`, data, getToken()),

    getVersionById: async (courseId, versionId) =>
        http('GET', `/courses/${courseId}/versions/${versionId}`, null, getToken()),

    updateChangelog: async (courseId, versionId, data) =>
        http('PUT', `/courses/${courseId}/versions/${versionId}/changelog`, data, getToken()),

    // ── DRIP CONTENT ───────────────────────────────────────────────────────
    getDripStatus: async (courseId) =>
        http('GET', `/courses/${courseId}/drip-status`, null, getToken()),
};

// ─── ATTENDANCE / LIVE SESSIONS ───────────────────────────────────────────────
export const attendanceAPI = {
    getSessions: async (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return http('GET', `/attendance/sessions${qs ? `?${qs}` : ''}`, null, getToken());
    },
    createSession: async (data) =>
        http('POST', '/attendance/sessions', data, getToken()),
    updateSession: async (id, data) =>
        http('PUT', `/attendance/sessions/${id}`, data, getToken()),
    deleteSession: async (id) =>
        http('DELETE', `/attendance/sessions/${id}`, null, getToken()),
    getAttendance: async (sessionId) =>
        http('GET', `/attendance/sessions/${sessionId}`, null, getToken()),
    markAttendance: async (sessionId, records) =>
        http('POST', `/attendance/sessions/${sessionId}/mark`, { records }, getToken()),
    markSingleAttendance: async (sessionId, studentId, status) =>
        http('POST', `/attendance/sessions/${sessionId}/mark-single`, { studentId, status }, getToken()),
    getCourseAttendanceStats: async (courseId) =>
        http('GET', `/attendance/course/${courseId}/stats`, null, getToken()),
    getMyAttendance: async (studentId) =>
        http('GET', `/attendance/student/${studentId}`, null, getToken()),
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

    bulkEnroll: async (courseId, studentIds, rollNos = []) =>
        http('POST', '/enrollments/bulk', { courseId, studentIds, rollNos }, getToken()),
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

    getByInstructor: async (instructorId) =>
        http('GET', `/quizzes/instructor/${instructorId}`, null, getToken()),

    getPerformance: async (quizId) =>
        http('GET', `/quizzes/${quizId}/performance`, null, getToken()),

    getStudentAttempts: async (quizId, studentId) =>
        http('GET', `/quizzes/${quizId}/attempts/${studentId}`, null, getToken()),

    getAvailableExams: async () =>
        http('GET', '/quizzes/available', null, getToken()),

    createQuiz: async (quizData) =>
        http('POST', '/quizzes', quizData, getToken()),

    remindStudents: async (quizId, payload = {}) =>
        http('POST', `/quizzes/${quizId}/remind`, payload, getToken()),
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
    getAll: async (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.role) params.set('role', filters.role);
        if (filters.status) params.set('status', filters.status);
        if (filters.search) params.set('search', filters.search);
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        if (filters.departmentId) params.set('departmentId', filters.departmentId);
        if (filters.limit) params.set('limit', filters.limit);
        const qs = params.toString();
        const res = await http('GET', `/users${qs ? `?${qs}` : ''}`, null, getToken());
        return res.data || res; // handle both wrapped and plain
    },

    createInstructor: async (data) =>
        http('POST', '/users/instructors', data, getToken()),

    downloadInstructorTemplate: async () => {
        const token = getToken();
        const res = await fetch(`${BASE_URL}/users/instructors/template`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to download template');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Instructor_Import_Template.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
    },

    downloadStudentTemplate: async () => {
        const token = getToken();
        const res = await fetch(`${BASE_URL}/users/students/template`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to download template');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Student_Import_Template.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
    },

    importInstructors: async (file, { signal, timeoutMs = 120000 } = {}) => {
        const formData = new FormData();
        formData.append('file', file);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        // Chain external signal to our controller (compatible with older browsers)
        if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
        try {
            const res = await fetch(`${BASE_URL}/users/instructors/import`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${getToken()}` },
                body: formData,
                signal: controller.signal,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
            return data;
        } finally {
            clearTimeout(timer);
        }
    },

    importStudents: async (file, { signal, timeoutMs = 120000 } = {}) => {
        const formData = new FormData();
        formData.append('file', file);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
        try {
            const res = await fetch(`${BASE_URL}/users/students/import`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${getToken()}` },
                body: formData,
                signal: controller.signal,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
            return data;
        } finally {
            clearTimeout(timer);
        }
    },

    updateRole: async (userId, role, reason = '', adminPassword = '') =>
        http('PUT', `/users/${userId}/role`, { role, reason, adminPassword }, getToken()),

    resetPassword: async (userId, password) =>
        http('PUT', `/users/${userId}/reset-password`, password ? { password } : {}, getToken()),

    toggleStatus: async (userId) =>
        http('PUT', `/users/${userId}/toggle-status`, {}, getToken()),

    delete: async (userId) =>
        http('DELETE', `/users/${userId}`, null, getToken()),

    submitInstructorRequest: async (data) =>
        http('POST', '/users/instructor-request', data, getToken()),

    getById: async (userId) =>
        http('GET', `/users/${userId}`, null, getToken()),

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
    setAdminDepartments: async (userId, departmentIds) =>
        http('PUT', `/users/${userId}/departments`, { departmentIds }, getToken()),
    getUserDepartments: async (userId) =>
        http('GET', `/users/${userId}/departments`, null, getToken()),
};

// ─── DEPARTMENTS ──────────────────────────────────────────────────────────────
export const departmentsAPI = {
    publicList: async () =>
        http('GET', '/departments/public'),

    list: async () =>
        http('GET', '/departments', null, getToken()),

    create: async (data) =>
        http('POST', '/departments', data, getToken()),

    update: async (id, data) =>
        http('PUT', `/departments/${id}`, data, getToken()),

    delete: async (id) =>
        http('DELETE', `/departments/${id}`, null, getToken()),

    updateLimits: async (id, { maxStudents, maxCourses }) =>
        http('PUT', `/departments/${id}/limits`, { maxStudents, maxCourses }, getToken()),
};

// ─── CERTIFICATES ────────────────────────────────────────────────────────────
export const certificatesAPI = {
    verify: async (certId) => http('GET', `/certificates/verify/${certId}`),
    getMy: async () => http('GET', '/certificates/my', null, getToken()),
    generate: async (courseId) => http('POST', '/certificates/generate', { courseId }, getToken()),
};

// ─── DISCUSSIONS ──────────────────────────────────────────────────────────────
export const discussionsAPI = {
    getQuestions: async (courseId, lessonId) => {
        const params = lessonId ? `?lessonId=${lessonId}` : '';
        return http('GET', `/discussions/course/${courseId}${params}`, null, getToken());
    },
    createQuestion: async (data) => http('POST', '/discussions/questions', data, getToken()),
    deleteQuestion: async (id) => http('DELETE', `/discussions/questions/${id}`, null, getToken()),
    getAnswers: async (questionId) => http('GET', `/discussions/questions/${questionId}/answers`, null, getToken()),
    createAnswer: async (questionId, content) => http('POST', `/discussions/questions/${questionId}/answers`, { content }, getToken()),
    deleteAnswer: async (id) => http('DELETE', `/discussions/answers/${id}`, null, getToken()),
    toggleUpvote: async (answerId) => http('POST', `/discussions/answers/${answerId}/upvote`, {}, getToken()),
    markBestAnswer: async (answerId) => http('PUT', `/discussions/answers/${answerId}/best-answer`, {}, getToken()),
};

// ─── ANNOUNCEMENTS ────────────────────────────────────────────────────────────
export const announcementsAPI = {
    list: async (all = false) =>
        http('GET', `/announcements${all ? '?all=true' : ''}`, null, getToken()),

    create: async (data) =>
        http('POST', '/announcements', data, getToken()),

    update: async (id, data) =>
        http('PUT', `/announcements/${id}`, data, getToken()),

    delete: async (id) =>
        http('DELETE', `/announcements/${id}`, null, getToken()),

    markRead: async (id) =>
        http('POST', `/announcements/${id}/mark-read`, {}, getToken()),

    getReads: async (id) =>
        http('GET', `/announcements/${id}/reads`, null, getToken()),
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
export const notificationsAPI = {
    getByUser: async () => {
        const res = await http('GET', '/notifications', null, getToken());
        return res.data || [];
    },

    markRead: async (userId, notifId) =>
        http('PUT', `/notifications/${notifId}/read`, {}, getToken()),

    markAllRead: async () =>
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

    getPlatform: async (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        if (filters.departmentId) params.set('departmentId', filters.departmentId);
        const qs = params.toString();
        return http('GET', `/stats/platform${qs ? `?${qs}` : ''}`, null, getToken());
    },

    getInstructor: async (instructorId) =>
        http('GET', `/stats/instructor/${instructorId}`, null, getToken()),

    getAuditLogs: async () =>
        http('GET', '/stats/audit-logs', null, getToken()),

    getAdminOverview: async () =>
        http('GET', '/stats/admins', null, getToken()),

    getStudentStreak: async () =>
        http('GET', '/stats/student/streak', null, getToken()),

    getDepartments: async () =>
        http('GET', '/stats/departments', null, getToken()),

    getSystemHealth: async () =>
        http('GET', '/stats/system-health', null, getToken()),
    getAiReport: async () =>
        http('GET', '/stats/ai-report', null, getToken()),

    getCategories: async () =>
        http('GET', '/stats/categories', null, getToken()),

    getCategoryDetail: async (id) =>
        http('GET', `/stats/categories/${id}`, null, getToken()),

    createCategory: async (data) =>
        http('POST', '/stats/categories', data, getToken()),

    updateCategory: async (id, data) =>
        http('PUT', `/stats/categories/${id}`, data, getToken()),

    deleteCategory: async (id) =>
        http('DELETE', `/stats/categories/${id}`, null, getToken()),

    assignCourseToCategory: async (categoryId, courseId) =>
        http('PUT', `/stats/categories/${categoryId}/courses`, { courseId }, getToken()),

    removeCourseFromCategory: async (categoryId, courseId) =>
        http('DELETE', `/stats/categories/${categoryId}/courses/${courseId}`, null, getToken()),

    bulkEnroll: async (courseId, studentIds, rollNos = []) =>
        http('POST', '/enrollments/bulk', { courseId, studentIds, rollNos }, getToken()),

    importCategories: async (file, { signal, timeoutMs = 120000 } = {}) => {
        const formData = new FormData();
        formData.append('file', file);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
        try {
            const res = await fetch(`${BASE_URL}/stats/categories/import`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${getToken()}` },
                body: formData,
                signal: controller.signal,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
            return data;
        } finally {
            clearTimeout(timer);
        }
    },

    getSettings: async () =>
        http('GET', '/stats/settings', null, getToken()),

    updateSettings: async (settings) =>
        http('PUT', '/stats/settings', settings, getToken()),
};

// ─── WISHLIST ─────────────────────────────────────────────────────────────────
export const wishlistAPI = {
    toggle: async (userId, courseId) =>
        http('POST', '/wishlist/toggle', { courseId }, getToken()),

    get: async () => {
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
