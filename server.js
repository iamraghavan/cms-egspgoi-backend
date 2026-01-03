const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
const { globalLimiter, authLimiter } = require('./src/middleware/rateLimiter');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();

const config = require('./src/config/env');
const { conditionalRequestMiddleware } = require('./src/middleware/conditionalRequest');

const compression = require('compression');
const { cacheMiddleware } = require('./src/middleware/cacheMiddleware');

// ...

// Middleware
app.set('etag', 'strong'); // Enable strong ETag generation
app.use(conditionalRequestMiddleware); // Encourage conditional requests
app.use(compression()); // Compress all responses
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline for some UI frameworks if needed
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.pusherapp.com"] // Allow external APIs if strictly needed
    }
  },
  hsts: {
    maxAge: 31536000, // 1 Year
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny' // Prevent Clickjacking
  }
}));
app.use(cors({
  origin: true, // Allow any origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10kb' })); // Body limit
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(hpp()); // Prevent Parameter Pollution
app.use(globalLimiter); // Global Rate Limit

// Routes 
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Admissions CRM API' });
});

app.use('/api/v1/auth', authLimiter, require('./src/routes/userRoutes'));
app.use('/api/v1/users', require('./src/routes/userRoutes'));
app.use('/api/v1', require('./src/routes/campaignRoutes'));
app.use('/api/v1', require('./src/routes/leadRoutes'));
app.use('/api/v1', require('./src/routes/accountingRoutes'));
app.use('/api/v1/smartflo', require('./src/routes/smartfloWebhookRoutes'));
app.use('/api/v1/analytics', cacheMiddleware(300), require('./src/routes/analyticsRoutes')); // Cache Analytics for 5 mins
app.use('/api/v1/search', cacheMiddleware(60), require('./src/routes/searchRoutes')); // Cache Search for 1 min
app.use('/api/v1/leads/bulk', require('./src/routes/bulkLeadRoutes'));
// app.use('/api/v1/gemini', require('./src/routes/geminiRoutes'));
app.use('/api/v1/smartflo', require('./src/routes/smartfloApiRoutes'));

// Error Handler
app.use(errorHandler);

module.exports = app;

// 01
