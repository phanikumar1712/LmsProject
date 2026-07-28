const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/assignmentsController');

// Assignment CRUD
router.get('/course/:courseId', authenticate, asyncHandler(ctrl.getByCourse));
router.post('/', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.create));
router.put('/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.update));
router.delete('/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.remove));

// Submissions
router.get('/:id/submissions', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getSubmissions));
router.post('/:id/submit', authenticate, authorize('STUDENT'), asyncHandler(ctrl.submit));
router.put('/submissions/:id/grade', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.grade));

// Rubric
router.get('/:id/rubric', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getRubric));
router.put('/:id/rubric', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.saveRubric));
router.get('/submissions/:id/rubric-scores', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getRubricScores));
router.put('/submissions/:id/rubric-scores', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.saveRubricScores));

// Plagiarism check
router.get('/:id/plagiarism', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.checkPlagiarism));

module.exports = router;
