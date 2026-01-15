const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
const { globalLimiter, authLimiter } = require('./src/middleware/rateLimiter');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();

// Trust Proxy (Required for Vercel/Heroku + Rate Limiting)
app.set('trust proxy', 1);

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

const authRoutes = require('./src/routes/userRoutes');
const userRoutes = require('./src/routes/userRoutes');
const leadRoutes = require('./src/routes/leadRoutes');
const campaignRoutes = require('./src/routes/campaignRoutes');
const accountingRoutes = require('./src/routes/accountingRoutes');
const searchRoutes = require('./src/routes/searchRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const bulkLeadRoutes = require('./src/routes/bulkLeadRoutes');
const smartfloRoutes = require('./src/routes/smartfloWebhookRoutes'); // Renamed from smartfloWebhookRoutes to smartfloRoutes
const geminiRoutes = require('./src/routes/geminiRoutes');
const webhookRoutes = require('./src/routes/webhookRoutes');
const smartfloApiRoutes = require('./src/routes/smartfloApiRoutes'); // Proxy routes
const notificationRoutes = require('./src/routes/notificationRoutes');

const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`, authLimiter, authRoutes); // Apply authLimiter to auth routes
app.use(`${API_PREFIX}/users`, userRoutes); // This includes the new /device-token route
app.use(`${API_PREFIX}/leads`, leadRoutes);
app.use(`${API_PREFIX}/campaigns`, campaignRoutes);
app.use(`${API_PREFIX}/accounting`, accountingRoutes);
app.use(`${API_PREFIX}/search`, cacheMiddleware(60), searchRoutes); // Cache Search for 1 min
app.use(`${API_PREFIX}/analytics`, cacheMiddleware(300), analyticsRoutes); // Cache Analytics for 5 mins
app.use(`${API_PREFIX}/bulk-leads`, bulkLeadRoutes); // New
app.use(`${API_PREFIX}/smartflo`, smartfloRoutes);
app.use(`${API_PREFIX}/ai`, geminiRoutes);
app.use(`${API_PREFIX}/webhook`, webhookRoutes);
app.use(`${API_PREFIX}/smartflo-api`, smartfloApiRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);

// Error Handler
app.use(errorHandler);

module.exports = app;

// 02
