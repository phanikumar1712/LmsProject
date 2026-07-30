// All courses are free and accessible — no subscription plan checks needed.
export const canAccessCourse = (user, course) => {
    if (!user || !course) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    if (user.role === 'ADMIN') {
        if (!user.departmentId || course.departmentId === user.departmentId) return true;
    }
    return true;
};
