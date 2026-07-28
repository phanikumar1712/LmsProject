const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/certificatesController');

// Public verification page data (no auth needed)
router.get('/verify/:certId', asyncHandler(ctrl.verify));

// Student: view my certificates
router.get('/my', authenticate, authorize('STUDENT'), asyncHandler(ctrl.getMy));

// Generate certificate (when course is completed — called by system or enrollment controller)
router.post('/generate', authenticate, authorize('STUDENT'), asyncHandler(ctrl.generate));

module.exports = router;
