// Shared course ownership + department-scope authorization helpers.
//
// These mirror the assertCourseOwnership / assertCourseInScope patterns in
// coursesController so that feature modules (assignments, attendance, content
// versions) enforce the same rules without duplicating them.
//
// Access model:
//   - INSTRUCTOR: only for courses they own (instructor_id = req.user.id).
//   - ADMIN: department-scoped admins only for courses in their department;
//     admins without a department are unrestricted (same as coursesController).
//   - SUPER_ADMIN: unrestricted.

const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { getDepartmentScope } = require('./scope');

// For a department-scoped ADMIN, ensure the course belongs to their department
// (via the denormalized courses.department_id column, kept in sync with the
// course's category by DB triggers). Throws 403 on cross-department access.
// Unscoped users (SUPER_ADMIN, global ADMIN, INSTRUCTOR, STUDENT) pass through.
const assertCourseInScope = async (req, courseId) => {
    const { scoped, departmentId } = getDepartmentScope(req);
    if (!scoped) return;
    const r = await query(
        `SELECT department_id FROM courses WHERE id = $1`,
        [courseId]
    );
    if (!r.rows.length) throw createError('Course not found', 404);
    if (r.rows[0].department_id !== departmentId) {
        throw createError('This course is outside your department', 403);
    }
};

// Instructor-ownership + admin department-scope gate for a course. Throws 404 if
// the course doesn't exist, 403 if the user may not edit it. Students always fail.
const assertCourseEditable = async (req, courseId) => {
    const result = await query('SELECT instructor_id FROM courses WHERE id = $1', [courseId]);
    if (!result.rows.length) throw createError('Course not found', 404);
    if (req.user.role === 'INSTRUCTOR' && result.rows[0].instructor_id !== req.user.id) {
        throw createError('Not authorized to modify this course', 403);
    }
    if (req.user.role === 'ADMIN') await assertCourseInScope(req, courseId);
};

// Gate an operation on a child row (assignment / submission / live session /
// section / lesson) by resolving it to its course first. `sql` must return a
// row with a `course_id` column. Throws 404 if the child doesn't exist.
const assertChildEditable = async (req, { sql, id, notFound = 'Resource not found' }) => {
    const result = await query(sql, [id]);
    if (!result.rows.length) throw createError(notFound, 404);
    await assertCourseEditable(req, result.rows[0].course_id);
    return result.rows[0];
};

module.exports = { assertCourseInScope, assertCourseEditable, assertChildEditable };
