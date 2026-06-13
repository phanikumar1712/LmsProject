const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV === 'development';

// General API Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 3 * 60 * 1000, // 3 minutes
    max: isDev ? 1000 : 100, // Limit each IP to 1000 requests in dev
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again after 3 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Authentication Rate Limiter (Login, Register)
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: isDev ? 100 : 10, // Limit each IP to 100 attempts in dev
    message: {
        success: false,
        message: 'Too many login/register attempts. Please try again after an hour.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// OTP Request Limiter
const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5, // Limit each IP to 5 OTP requests per 10 minutes
    message: {
        success: false,
        message: 'Too many OTP requests. Please wait 10 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = { apiLimiter, authLimiter, otpLimiter };
