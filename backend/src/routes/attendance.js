const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/attendanceController');

// Live Sessions CRUD
router.get('/sessions', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getSessions));
router.post('/sessions', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.createSession));
router.put('/sessions/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.updateSession));
router.delete('/sessions/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.deleteSession));

// Attendance Marking
router.get('/sessions/:sessionId', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getAttendance));
router.post('/sessions/:sessionId/mark', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.markAttendance));
router.post('/sessions/:sessionId/mark-single', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.markSingleAttendance));

// Attendance Stats
router.get('/course/:courseId/stats', authenticate, asyncHandler(ctrl.getCourseAttendanceStats));
router.get('/student/:studentId', authenticate, asyncHandler(ctrl.getMyAttendance));

module.exports = router;
