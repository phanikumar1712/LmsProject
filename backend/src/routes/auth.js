const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/authController');

router.post('/register', asyncHandler(ctrl.register));
router.post('/login', asyncHandler(ctrl.login));
router.post('/demo', asyncHandler(ctrl.demoLogin));
router.get('/me', authenticate, asyncHandler(ctrl.getMe));
router.put('/profile', authenticate, asyncHandler(ctrl.updateProfile));
router.put('/change-password', authenticate, asyncHandler(ctrl.changePassword));

module.exports = router;
