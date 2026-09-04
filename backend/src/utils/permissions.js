// ── ROLE-BASED PERMISSION SYSTEM ─────────────────────────────────────────────
// The platform is NOT governed by bare role checks alone. Every protected action
// maps to a granular permission ("student.create", "course.approve", ...). A
// user's effective permission set is:
//
//     roleMatrix(role)  ⊕  per-user overrides (user_permissions table)
//
// The role matrix encodes the default ceiling for each role (see ROLE_PERMISSIONS
// below). The SUPER_ADMIN can additionally grant or revoke individual permissions
// for a specific user via the user_permissions table — e.g. "explicitly grant an
// instructor grade.update" or "revoke course.delete from an admin". Overrides
// only ever apply to users who are NOT SUPER_ADMIN (the super admin implicitly
// holds every permission and cannot be locked out).
//
// Usage in routes:
//   router.put('/:id/approve', authenticate, requirePermission('course.approve'), ...)
//   router.post('/students', authenticate, requirePermission('student.create'), ...)
//   requirePermission('assignment.create', 'assignment.update')  → ANY of them.

const PERMISSIONS = {
    // ── Departments ─────────────────────────────────────────────────────────
    'department.view':   { group: 'Departments', label: 'View departments', description: 'List departments and their details' },
    'department.create': { group: 'Departments', label: 'Create department', description: 'Create a new department' },
    'department.update': { group: 'Departments', label: 'Update department', description: 'Edit a department (name, code, limits, status)' },
    'department.delete': { group: 'Departments', label: 'Delete department', description: 'Delete a department' },

    // ── Admins ──────────────────────────────────────────────────────────────
    'admin.create':   { group: 'Admins', label: 'Create admin', description: 'Invite/create an admin account' },
    'admin.update':   { group: 'Admins', label: 'Update admin', description: 'Edit an admin account or its departments' },
    'admin.delete':   { group: 'Admins', label: 'Delete admin', description: 'Remove an admin account' },

    // ── Users (students / instructors) ──────────────────────────────────────
    'user.view':         { group: 'Users', label: 'View users', description: 'List and view user accounts' },
    'student.create':    { group: 'Users', label: 'Create students', description: 'Create or bulk-import student accounts' },
    'student.update':    { group: 'Users', label: 'Update students', description: 'Edit student accounts (profile, cohort)' },
    'student.delete':    { group: 'Users', label: 'Delete students', description: 'Delete student accounts' },
    'instructor.create': { group: 'Users', label: 'Create instructors', description: 'Create or bulk-import instructor accounts' },
    'instructor.update': { group: 'Users', label: 'Update instructors', description: 'Edit instructor accounts' },
    'instructor.delete': { group: 'Users', label: 'Delete instructors', description: 'Delete instructor accounts' },
    'user.role.change':  { group: 'Users', label: 'Change user roles', description: 'Promote/demote a user between roles' },
    'user.status.update':{ group: 'Users', label: 'Activate / suspend', description: 'Activate or suspend user accounts' },
    'user.password.reset': { group: 'Users', label: 'Reset passwords', description: 'Force-reset another user\'s password' },

    // ── Permissions management ──────────────────────────────────────────────
    'permission.manage': { group: 'Permissions', label: 'Manage permissions', description: 'Grant / revoke individual permissions for a user' },

    // ── Courses ─────────────────────────────────────────────────────────────
    'course.view':    { group: 'Courses', label: 'View courses', description: 'Browse the course catalog' },
    'course.create':  { group: 'Courses', label: 'Create courses', description: 'Create a course' },
    'course.update':  { group: 'Courses', label: 'Update courses', description: 'Edit a course or its content' },
    'course.delete':  { group: 'Courses', label: 'Delete courses', description: 'Delete a course' },
    'course.approve': { group: 'Courses', label: 'Approve courses', description: 'Approve / reject courses submitted for review' },
    'course.enroll':  { group: 'Courses', label: 'Enroll in courses', description: 'Enroll in a course' },

    // ── Assignments / grades ────────────────────────────────────────────────
    'assignment.create': { group: 'Assignments', label: 'Create assignments', description: 'Create an assignment' },
    'assignment.update': { group: 'Assignments', label: 'Update assignments', description: 'Edit or delete an assignment' },
    'assignment.submit': { group: 'Assignments', label: 'Submit assignments', description: 'Submit / resubmit assignment work' },
    'grade.update':      { group: 'Assignments', label: 'Grade submissions', description: 'Marks, feedback, and rubric grading' },

    // ── Quizzes ─────────────────────────────────────────────────────────────
    'quiz.create':  { group: 'Quizzes', label: 'Create quizzes', description: 'Create / edit quizzes and exams' },
    'quiz.attempt': { group: 'Quizzes', label: 'Attempt quizzes', description: 'Take quizzes and exams' },

    // ── Platform ────────────────────────────────────────────────────────────
    'audit.view':          { group: 'Platform', label: 'View audit logs', description: 'Read the audit trail (scoped to department)' },
    'reports.view':        { group: 'Platform', label: 'View reports', description: 'Access analytics and report pages' },
    'platform.settings':   { group: 'Platform', label: 'Platform settings', description: 'Read/update global platform settings' },
    'announcement.create': { group: 'Platform', label: 'Create announcements', description: 'Post announcements' },
    'category.manage':     { group: 'Platform', label: 'Manage categories', description: 'Create / edit / delete course categories' },
    'enrollment.manage':   { group: 'Platform', label: 'Manage enrollments', description: 'Bulk-enroll / unenroll students' },
    'import.users':        { group: 'Platform', label: 'Bulk import users', description: 'CSV/Excel import of students and instructors' },
    'attendance.manage':   { group: 'Platform', label: 'Manage attendance', description: 'Create live sessions and mark attendance' },
};

// The default permission ceiling per role. SUPER_ADMIN is implicit (everything)
// and is therefore not listed — see ALL_PERMISSIONS below.
const ROLE_PERMISSIONS = {
    STUDENT: [
        'course.view',
        'course.enroll',
        'assignment.submit',
        'quiz.attempt',
    ],
    INSTRUCTOR: [
        'course.view',
        'course.create',
        'course.update',
        'assignment.create',
        'assignment.update',
        'grade.update',
        'quiz.create',
        'attendance.manage',
        'announcement.create',
    ],
    ADMIN: [
        // Department-scoped admin (see getDepartmentScope / assertUserInScope —
        // every one of these is additionally locked to the admin's department).
        'department.view',
        'user.view',
        'student.create',
        'student.update',
        'student.delete',
        'instructor.create',
        'instructor.update',
        'instructor.delete',
        'user.status.update',
        'user.password.reset',
        'user.role.change',
        'course.view',
        'course.update',
        'course.delete',
        'course.approve',
        'enrollment.manage',
        'import.users',
        'category.manage',
        'announcement.create',
        'attendance.manage',
        'audit.view',
        'reports.view',
        // Department admins can manage assignments and grading within
        // their department (mirrors INSTRUCTOR minus course.create).
        'assignment.create',
        'assignment.update',
        'grade.update',
    ],
    SUPER_ADMIN: [], // implicit: everything (see ALL_PERMISSIONS / hasPermission)
};

const ALL_PERMISSIONS = Object.keys(PERMISSIONS);

// ── Role helpers ─────────────────────────────────────────────────────────────

// The default permission list for a role (SUPER_ADMIN = everything).
const permissionsForRole = (role) => {
    if (role === 'SUPER_ADMIN') return [...ALL_PERMISSIONS];
    return [...(ROLE_PERMISSIONS[role] || [])];
};

// ── Per-user overrides ───────────────────────────────────────────────────────

// Fetch the user_permissions overrides for a user: Map<permission, granted>.
const getOverrides = async (userId) => {
    const res = await require('../db/pool').query(
        'SELECT permission, granted FROM user_permissions WHERE user_id = $1',
        [userId]
    );
    return new Map(res.rows.map(r => [r.permission, r.granted]));
};

// Apply overrides onto a base permission list. Returns { permissions, overrides }.
const applyOverrides = (base, overrides) => {
    const set = new Set(base);
    const applied = [];
    for (const [perm, granted] of overrides) {
        if (!PERMISSIONS[perm]) continue; // stale/unknown permission — ignore
        if (granted) { set.add(perm); applied.push(perm); }
        else { set.delete(perm); applied.push(perm); }
    }
    return { permissions: [...set], overrides: applied };
};

// Effective permission list for a user (role matrix + overrides). Async because
// overrides live in the DB. For SUPER_ADMIN no DB read is needed — it always has
// everything and can never be locked out by a bad override.
const getEffectivePermissions = async (user) => {
    if (user.role === 'SUPER_ADMIN') return [...ALL_PERMISSIONS];
    const base = permissionsForRole(user.role);
    if (!user.id) return base;
    const overrides = await getOverrides(user.id).catch(() => new Map());
    return applyOverrides(base, overrides).permissions;
};

// Sync check: does this user (with an optional pre-loaded override map) hold a
// permission? If `overrides` is omitted, role matrix only. Overrides take
// precedence over the role matrix — a false override revokes a role default and
// a true override grants beyond it.
const hasPermission = (user, permission, overrides) => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    if (overrides) {
        const granted = overrides.get(permission);
        if (granted === true) return true;
        if (granted === false) return false;
    }
    return (ROLE_PERMISSIONS[user.role] || []).includes(permission);
};

// ── Express middleware ───────────────────────────────────────────────────────

// requirePermission('perm1', 'perm2') → the user must hold ANY of the listed
// permissions. Overrides are loaded from the DB once per request (only for
// non-super-admin users) and attached to req so controllers can re-check.
const requirePermission = (...permissions) => async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.role === 'SUPER_ADMIN') return next();

    const overrides = await getOverrides(req.user.id).catch(() => new Map());
    req.permissionOverrides = overrides;
    if (permissions.some(p => hasPermission(req.user, p, overrides))) return next();

    return res.status(403).json({ error: 'Insufficient permissions' });
};

// Attach the full effective permission list to the request (used by controllers
// that return user payloads, e.g. auth responses). Also caches overrides.
const attachPermissions = async (req, res, next) => {
    try {
        if (req.user) {
            if (req.user.role === 'SUPER_ADMIN') {
                req.user.permissions = [...ALL_PERMISSIONS];
            } else {
                const overrides = await getOverrides(req.user.id).catch(() => new Map());
                req.permissionOverrides = overrides;
                req.user.permissions = applyOverrides(permissionsForRole(req.user.role), overrides).permissions;
            }
        }
    } catch { /* non-fatal — permission list is an enhancement */ }
    next();
};

module.exports = {
    PERMISSIONS,
    ROLE_PERMISSIONS,
    ALL_PERMISSIONS,
    permissionsForRole,
    getOverrides,
    applyOverrides,
    getEffectivePermissions,
    hasPermission,
    requirePermission,
    attachPermissions,
};
