import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from '../config/app.config.js';

// Ensure log directory exists
if (config.logging.file.enabled) {
  if (!fs.existsSync(config.logging.file.path)) {
    fs.mkdirSync(config.logging.file.path, { recursive: true });
  }
}

// Custom format for structured logging
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    
    const log = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };

    return JSON.stringify(log);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: config.logging.console.colorize }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = '\n' + JSON.stringify(meta, null, 2);
    }
    
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Create winston logger
const transports: winston.transport[] = [];

// Console transport
if (config.logging.console.enabled) {
  transports.push(
    new winston.transports.Console({
      format: config.env === 'development' ? consoleFormat : customFormat,
      level: config.logging.level,
    })
  );
}

// File transports
if (config.logging.file.enabled) {
  // Combined logs
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logging.file.path, 'combined.log'),
      format: customFormat,
      level: config.logging.level,
      maxsize: parseInt(config.logging.file.maxSize) * 1024 * 1024, // Convert MB to bytes
      maxFiles: config.logging.file.maxFiles,
      tailable: true,
    })
  );

  // Error logs
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logging.file.path, 'error.log'),
      format: customFormat,
      level: 'error',
      maxsize: parseInt(config.logging.file.maxSize) * 1024 * 1024,
      maxFiles: config.logging.file.maxFiles,
      tailable: true,
    })
  );

  // Access logs (for HTTP requests)
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logging.file.path, 'access.log'),
      format: customFormat,
      level: 'info',
      maxsize: parseInt(config.logging.file.maxSize) * 1024 * 1024,
      maxFiles: config.logging.file.maxFiles,
      tailable: true,
    })
  );
}

export const logger = winston.createLogger({
  level: config.logging.level,
  format: customFormat,
  defaultMeta: {
    service: 'taskflow-api',
    version: '2.0.0',
    environment: config.env,
  },
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Handle uncaught exceptions and unhandled rejections
if (config.logging.file.enabled) {
  logger.exceptions.handle(
    new winston.transports.File({
      filename: path.join(config.logging.file.path, 'exceptions.log'),
      format: customFormat,
    })
  );

  logger.rejections.handle(
    new winston.transports.File({
      filename: path.join(config.logging.file.path, 'rejections.log'),
      format: customFormat,
    })
  );
}

// Helper functions for structured logging
export const logError = (message: string, error: Error, meta?: any) => {
  logger.error(message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...meta,
  });
};

export const logRequest = (req: any, res: any, duration: number) => {
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
  });
};

export const logAuth = (event: string, userId?: string, meta?: any) => {
  logger.info(`Auth: ${event}`, {
    userId,
    ...meta,
  });
};

export const logDatabase = (operation: string, table: string, duration: number, meta?: any) => {
  logger.debug('Database Operation', {
    operation,
    table,
    duration: `${duration}ms`,
    ...meta,
  });
};

export const logIntegration = (service: string, operation: string, status: string, meta?: any) => {
  logger.info('External Integration', {
    service,
    operation,
    status,
    ...meta,
  });
};

// Performance monitoring helpers
export const createTimer = () => {
  const start = process.hrtime.bigint();
  return () => {
    const end = process.hrtime.bigint();
    return Number(end - start) / 1000000; // Convert to milliseconds
  };
};

// Audit logging
export const logAudit = (action: string, resource: string, userId: string, meta?: any) => {
  logger.info('Audit Log', {
    audit: true,
    action,
    resource,
    userId,
    timestamp: new Date().toISOString(),
    ...meta,
  });
};

export default logger;