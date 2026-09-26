const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require('morgan');
const logger = require('./utils/logger');

const app = express();
app.set('trust proxy', 1);

// 1. LOGGING
const stream = { write: (message) => logger.info(message.trim()) };
app.use(morgan('combined', { stream }));

// 2. SECURITY HEADERS
app.use(helmet());

// 3. PRODUCTION & DEVELOPMENT CORS SETTINGS
const allowedOrigins = [
  'http://localhost:3000', 
  'http://localhost:5173', 
  'http://localhost:5174', 
  'http://localhost:5175', 
  'http://localhost:5176', 
  'http://localhost:8080', 
  'http://localhost:8081', 
  'http://localhost:8082'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In production, also allow your explicit Vercel frontend URL configuration
    if (allowedOrigins.indexOf(origin) !== -1 || origin === process.env.FRONTEND_URL || origin === process.env.CLIENT_URL) {
      return callback(null, true);
    } else if (process.env.NODE_ENV !== 'production') {
      return callback(null, true); 
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true
}));

// 4. STRIPE RAW PARSER (Must come before global express.json parses payload)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// 5. GLOBAL PARSERS
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 6. CUSTOM SECURITY MIDDLEWARE (NoSQL Injection & Input Sanitization Cleaner)
const deepClean = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return typeof obj === 'string' ? obj.replace(/<[^>]*>?/gm, '') : obj;
  }

  for (let key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // NoSQL Injection Clean: Remove keys starting with $ or containing .
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
        continue;
      }

      // XSS Clean: Strip potential HTML elements
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].replace(/<[^>]*>?/gm, ''); 
      } else if (typeof obj[key] === 'object') {
        deepClean(obj[key]);
      }
    }
  }
  return obj;
};

app.use((req, res, next) => {
  if (req.body) deepClean(req.body);
  if (req.params) deepClean(req.params);
  
  if (req.query) {
    const sanitizedQuery = Object.fromEntries(
      Object.entries(req.query).map(([key, value]) => [key, deepClean(value)])
    );
    Object.defineProperty(req, 'query', { value: sanitizedQuery, enumerable: true });
  }
  next();
});

// 7. STATIC FILES
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 8. TEST ROUTE
app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'gebeyaplus-api' });
});

app.get('/health/ready', (req, res) => {
  const mongoose = require('mongoose');
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', database: ready ? 'connected' : 'disconnected' });
});

app.get("/", (req, res) => {
  res.send("GebeyaPlus API is running flawlessly...");
});

module.exports = app;