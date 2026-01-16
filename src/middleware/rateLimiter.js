const rateLimit = require('express-rate-limit');

const config = require('../config/env');

const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    message: `Too many requests from this IP, please try again after ${Math.ceil(config.rateLimit.windowMs / 60000)} minutes`
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 50, // Limit each IP to 50 login attempts per 10 minutes
  message: {
    message: 'Too many login attempts from this IP, please try again after 10 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 submissions per hour (Anti-Spam)
  message: {
    message: 'Too many lead submissions from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { globalLimiter, authLimiter, submissionLimiter };
