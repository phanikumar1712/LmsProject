const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { requirePermission } = require('../utils/permissions');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/assignmentsController');

// Assignment CRUD
router.get('/my', authenticate, asyncHandler(ctrl.getMyAssignments));
router.get('/overview', authenticate, asyncHandler(ctrl.getStudentOverview));
router.get('/course/:courseId', authenticate, asyncHandler(ctrl.getByCourse));
router.post('/', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('assignment.create'), asyncHandler(ctrl.create));
router.put('/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('assignment.update'), asyncHandler(ctrl.update));
router.delete('/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('assignment.update'), asyncHandler(ctrl.remove));

// Submissions
router.get('/:id/submissions', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('grade.update'), asyncHandler(ctrl.getSubmissions));
router.post('/:id/submit', authenticate, authorize('STUDENT'), requirePermission('assignment.submit'), asyncHandler(ctrl.submit));
router.put('/submissions/:id/grade', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('grade.update'), asyncHandler(ctrl.grade));

// Rubric
router.get('/:id/rubric', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('grade.update'), asyncHandler(ctrl.getRubric));
router.put('/:id/rubric', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('grade.update'), asyncHandler(ctrl.saveRubric));
router.get('/submissions/:id/rubric-scores', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('grade.update'), asyncHandler(ctrl.getRubricScores));
router.put('/submissions/:id/rubric-scores', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('grade.update'), asyncHandler(ctrl.saveRubricScores));

// Plagiarism check
router.get('/:id/plagiarism', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('grade.update'), asyncHandler(ctrl.checkPlagiarism));

module.exports = router;
