// Frontend mirror of backend/src/utils/permissions.js — used to render the
// permission matrix in the Super Admin Permissions page. The BACKEND registry
// is the source of truth for enforcement; this catalog only drives the UI.

export const PERMISSIONS = {
    'department.view':   { group: 'Departments', label: 'View departments', description: 'List departments and their details' },
    'department.create': { group: 'Departments', label: 'Create department', description: 'Create a new department' },
    'department.update': { group: 'Departments', label: 'Update department', description: 'Edit a department (name, code, limits, status)' },
    'department.delete': { group: 'Departments', label: 'Delete department', description: 'Delete a department' },

    'admin.create':   { group: 'Admins', label: 'Create admin', description: 'Invite/create an admin account' },
    'admin.update':   { group: 'Admins', label: 'Update admin', description: 'Edit an admin account or its departments' },
    'admin.delete':   { group: 'Admins', label: 'Delete admin', description: 'Remove an admin account' },

    'user.view':          { group: 'Users', label: 'View users', description: 'List and view user accounts' },
    'student.create':     { group: 'Users', label: 'Create students', description: 'Create or bulk-import student accounts' },
    'student.update':     { group: 'Users', label: 'Update students', description: 'Edit student accounts (profile, cohort)' },
    'student.delete':     { group: 'Users', label: 'Delete students', description: 'Delete student accounts' },
    'instructor.create':  { group: 'Users', label: 'Create instructors', description: 'Create or bulk-import instructor accounts' },
    'instructor.update':  { group: 'Users', label: 'Update instructors', description: 'Edit instructor accounts' },
    'instructor.delete':  { group: 'Users', label: 'Delete instructors', description: 'Delete instructor accounts' },
    'user.role.change':   { group: 'Users', label: 'Change user roles', description: 'Promote/demote a user between roles' },
    'user.status.update': { group: 'Users', label: 'Activate / suspend', description: 'Activate or suspend user accounts' },
    'user.password.reset': { group: 'Users', label: 'Reset passwords', description: 'Force-reset another user\'s password' },

    'permission.manage':  { group: 'Permissions', label: 'Manage permissions', description: 'Grant / revoke individual permissions for a user' },

    'course.view':    { group: 'Courses', label: 'View courses', description: 'Browse the course catalog' },
    'course.create':  { group: 'Courses', label: 'Create courses', description: 'Create a course' },
    'course.update':  { group: 'Courses', label: 'Update courses', description: 'Edit a course or its content' },
    'course.delete':  { group: 'Courses', label: 'Delete courses', description: 'Delete a course' },
    'course.approve': { group: 'Courses', label: 'Approve courses', description: 'Approve / reject courses submitted for review' },
    'course.enroll':  { group: 'Courses', label: 'Enroll in courses', description: 'Enroll in a course' },

    'assignment.create': { group: 'Assignments', label: 'Create assignments', description: 'Create an assignment' },
    'assignment.update': { group: 'Assignments', label: 'Update assignments', description: 'Edit or delete an assignment' },
    'assignment.submit': { group: 'Assignments', label: 'Submit assignments', description: 'Submit / resubmit assignment work' },
    'grade.update':      { group: 'Assignments', label: 'Grade submissions', description: 'Marks, feedback, and rubric grading' },

    'quiz.create':  { group: 'Quizzes', label: 'Create quizzes', description: 'Create / edit quizzes and exams' },
    'quiz.attempt': { group: 'Quizzes', label: 'Attempt quizzes', description: 'Take quizzes and exams' },

    'audit.view':          { group: 'Platform', label: 'View audit logs', description: 'Read the audit trail (scoped to department)' },
    'reports.view':        { group: 'Platform', label: 'View reports', description: 'Access analytics and report pages' },
    'platform.settings':   { group: 'Platform', label: 'Platform settings', description: 'Read/update global platform settings' },
    'announcement.create': { group: 'Platform', label: 'Create announcements', description: 'Post announcements' },
    'category.manage':     { group: 'Platform', label: 'Manage categories', description: 'Create / edit / delete course categories' },
    'enrollment.manage':   { group: 'Platform', label: 'Manage enrollments', description: 'Bulk-enroll / unenroll students' },
    'import.users':        { group: 'Platform', label: 'Bulk import users', description: 'CSV/Excel import of students and instructors' },
    'attendance.manage':   { group: 'Platform', label: 'Manage attendance', description: 'Create live sessions and mark attendance' },
};

// Ordered groups for the UI.
export const PERMISSION_GROUPS = ['Departments', 'Admins', 'Users', 'Permissions', 'Courses', 'Assignments', 'Quizzes', 'Platform'];

// Default (role-matrix) permission sets, for the "role default" chip display.
export const ROLE_PERMISSIONS = {
    STUDENT: ['course.view', 'course.enroll', 'assignment.submit', 'quiz.attempt'],
    INSTRUCTOR: ['course.view', 'course.create', 'course.update', 'assignment.create', 'assignment.update', 'grade.update', 'quiz.create', 'attendance.manage', 'announcement.create'],
    ADMIN: ['department.view', 'user.view', 'student.create', 'student.update', 'student.delete', 'instructor.create', 'instructor.update', 'instructor.delete', 'user.status.update', 'user.password.reset', 'user.role.change', 'course.view', 'course.update', 'course.delete', 'course.approve', 'enrollment.manage', 'import.users', 'category.manage', 'announcement.create', 'attendance.manage', 'audit.view', 'reports.view'],
    SUPER_ADMIN: Object.keys(PERMISSIONS),
};
