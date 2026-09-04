const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/authController');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');

// Rate limiters temporarily disabled for development
router.post('/register', asyncHandler(ctrl.register));
router.post('/login', asyncHandler(ctrl.login));
router.post('/demo', asyncHandler(ctrl.demoLogin));
router.post('/reset-password/request', asyncHandler(ctrl.requestPasswordReset));
router.post('/verify-otp', asyncHandler(ctrl.verifyOTP));
router.post('/reset-password', asyncHandler(ctrl.resetPasswordByEmail));
router.get('/me', authenticate, asyncHandler(ctrl.getMe));
router.put('/profile', authenticate, asyncHandler(ctrl.updateProfile));
router.put('/change-password', authenticate, asyncHandler(ctrl.changePassword));

module.exports = router;
