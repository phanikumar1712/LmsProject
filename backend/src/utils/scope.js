// Department-based admin isolation.
//
// A department groups course categories. An ADMIN assigned a department only
// manages the slice of the platform belonging to it; SUPER_ADMIN (and any admin
// without a department_id) stays global/unrestricted.
//
// Returns { scoped: true, departmentId } only when the request is made by a
// department-bound ADMIN, otherwise { scoped: false, departmentId: null }.
const getDepartmentScope = (req) => {
    const user = req.user;
    if (user && user.role === 'ADMIN' && user.department_id) {
        return { scoped: true, departmentId: user.department_id };
    }
    return { scoped: false, departmentId: null };
};

module.exports = { getDepartmentScope };
