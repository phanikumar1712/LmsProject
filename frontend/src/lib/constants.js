/**
 * Shared constants used across the LMS frontend.
 */

// ---------- Subscription Plans ----------
export const PLAN_COLORS = {
    FREE: '#64748b',
    BASIC: '#8b5cf6',
    PRO: '#f59e0b',
    ENTERPRISE: '#06b6d4',
};

/** Tier order for subscription access checks (must match DB enum) */
export const PLAN_ORDER = { FREE: 0, BASIC: 1, PRO: 2, ENTERPRISE: 3 };

// ---------- User Roles ----------
export const ROLES = {
    STUDENT: 'STUDENT',
    INSTRUCTOR: 'INSTRUCTOR',
    ADMIN: 'ADMIN',
    SUPER_ADMIN: 'SUPER_ADMIN',
};

// ---------- Course Status ----------
export const COURSE_STATUS = {
    DRAFT: 'DRAFT',
    PENDING: 'PENDING',
    PUBLISHED: 'PUBLISHED',
    REJECTED: 'REJECTED',
};

// ---------- Chart Colors ----------
export const CHART_COLORS = ['#4f46e5', '#0ea5e9', '#f59e0b', '#ec4899', '#10b981'];

// ---------- Chart Axis Style ----------
export const CHART_AXIS_STYLE = {
    fill: '#64748b',
    fontSize: 12,
    fontWeight: 500,
};

// ---------- Common recharts Chart Margin ----------
export const CHART_MARGIN = { top: 10, right: 10, left: -20, bottom: 0 };
