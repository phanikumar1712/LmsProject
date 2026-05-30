const router = require('express').Router();
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/coursesController');

// Public routes
router.get('/', optionalAuth, asyncHandler(ctrl.getAll));
router.get('/instructor/:instructorId', authenticate, asyncHandler(ctrl.getByInstructor));
router.get('/:id', asyncHandler(ctrl.getById));
router.get('/:id/lessons', asyncHandler(ctrl.getLessons));

// Instructor routes
router.post('/', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.create));
router.put('/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.update));
router.delete('/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.deleteCourse));
router.post('/:id/sections', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.createSection));
router.put('/sections/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.updateSection));
router.delete('/sections/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.deleteSection));
router.post('/:id/lessons', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.createLesson));
router.put('/lessons/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.updateLesson));
router.delete('/lessons/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.deleteLesson));

// Admin routes
router.put('/:id/approve', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.approve));
router.put('/:id/reject', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.reject));

module.exports = router;
