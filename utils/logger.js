const winston = require('winston');

const logger = winston.createLogger({
  level: 'info', // Minimum level to log
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // Capture stack traces
    winston.format.splat(),
    winston.format.json() // Production standard
  ),
  defaultMeta: { service: 'nextcart-service' },
  transports: [
    // 1. Write all errors to error.log
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // 2. Write all logs to combined.log
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// If we're not in production, also log to the console with colors
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

module.exports = logger;