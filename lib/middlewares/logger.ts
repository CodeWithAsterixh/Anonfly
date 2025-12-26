/**
 * Centralized logger utility for structured logging
 * Uses pino for high-performance logging with JSON output
 */
import pino from 'pino';
import env from '../constants/env.js';

// Configure logger based on environment
const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined,
  // Add base properties to all logs
  base: {
    env: env.NODE_ENV,
    service: 'kadian-api'
  },
  // Timestamp in ISO format
  timestamp: pino.stdTimeFunctions.isoTime
});

// Export specialized loggers for different contexts
export default {
  // Main application logger
  app: logger,
  // Database operations logger
  db: logger.child({ context: 'database' }),
  
  // Authentication logger
  auth: logger.child({ context: 'auth' }),
  
  // API request logger
  api: logger.child({ context: 'api' }),
  
  // Payment processing logger
  payment: logger.child({ context: 'payment' }),
  
  // Security events logger
  security: logger.child({ context: 'security' }),
  
  // Create a custom logger for specific components
  child: (component: any) => logger.child({ context: component })
};
