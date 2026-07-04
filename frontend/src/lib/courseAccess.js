import { PLAN_ORDER } from './constants';

export const canAccessCourse = (user, course) => {
    if (!user || !course) return false;
    if (['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return true;

    const userPlan = String(user.subscriptionPlan || 'FREE').toUpperCase();
    const requiredPlan = String(course.requiredPlan || 'FREE').toUpperCase();
    const explicitPlans = (course.accessiblePlans || []).map(plan => String(plan).toUpperCase());

    return explicitPlans.includes(userPlan) || (PLAN_ORDER[userPlan] ?? 0) >= (PLAN_ORDER[requiredPlan] ?? 0);
};
