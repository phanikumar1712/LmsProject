const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/authController');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, asyncHandler(ctrl.register));
router.post('/login', authLimiter, asyncHandler(ctrl.login));
router.post('/demo', asyncHandler(ctrl.demoLogin));
router.post('/reset-password/request', otpLimiter, asyncHandler(ctrl.requestPasswordReset));
router.post('/verify-otp', otpLimiter, asyncHandler(ctrl.verifyOTP));
router.post('/reset-password', authLimiter, asyncHandler(ctrl.resetPasswordByEmail));
router.get('/me', authenticate, asyncHandler(ctrl.getMe));
router.put('/profile', authenticate, asyncHandler(ctrl.updateProfile));
router.put('/change-password', authenticate, asyncHandler(ctrl.changePassword));

module.exports = router;
