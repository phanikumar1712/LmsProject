const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/certificatesController');

// Public verification page data (no auth needed)
router.get('/verify/:certId', asyncHandler(ctrl.verify));

// Student: view my certificates
router.get('/my', authenticate, authorize('STUDENT'), asyncHandler(ctrl.getMy));

// Admin/super-admin: view a specific user's certificates
router.get('/user/:userId', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getByUser));

// Generate certificate (when course is completed — called by system or enrollment controller)
router.post('/generate', authenticate, authorize('STUDENT'), asyncHandler(ctrl.generate));

module.exports = router;
