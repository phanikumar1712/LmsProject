const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/gradesController');

// Student's own per-course grade breakdown
router.get('/my', authenticate, asyncHandler(ctrl.getMyGrades));

module.exports = router;
