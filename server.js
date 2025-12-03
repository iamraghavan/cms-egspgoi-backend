const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
const { globalLimiter, authLimiter } = require('./src/middleware/rateLimiter');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: true, // Allow all origins (reflects request origin)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
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
app.use('/api/v1/smartflo', require('./src/routes/smartfloRoutes'));

// Error Handler
app.use(errorHandler);

module.exports = app;

// 01
