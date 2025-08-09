import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/app.config.js';
import { logger } from './utils/logger.js';
import dbConnection from './database/connection.js';
import { errorHandler } from './middleware/error.middleware.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { loggingMiddleware } from './middleware/logging.middleware.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/users.routes.js';
import taskRoutes from './routes/tasks.routes.js';
import teamRoutes from './routes/teams.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import healthRoutes from './routes/health.routes.js';

class TaskFlowServer {
  private app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.cors.origins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Strict rate limiting for auth endpoints
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // Limit each IP to 5 requests per windowMs for auth
      message: 'Too many authentication attempts, please try again later.',
      skipSuccessfulRequests: true,
    });
    this.app.use('/api/auth/login', authLimiter);
    this.app.use('/api/auth/register', authLimiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(cookieParser());

    // Compression
    this.app.use(compression());

    // Request logging
    if (config.env === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined', {
        stream: { write: (message) => logger.info(message.trim()) }
      }));
    }

    // Custom logging middleware
    this.app.use(loggingMiddleware);

    // Health check (no auth required)
    this.app.use('/health', healthRoutes);
  }

  private initializeRoutes() {
    // API routes
    this.app.use('/api/auth', authRoutes);
    
    // Protected routes (require authentication)
    this.app.use('/api/users', authMiddleware, userRoutes);
    this.app.use('/api/tasks', authMiddleware, taskRoutes);
    this.app.use('/api/teams', authMiddleware, teamRoutes);
    this.app.use('/api/attendance', authMiddleware, attendanceRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'TaskFlow Pro API',
        version: '2.0.0',
        environment: config.env,
        timestamp: new Date().toISOString(),
        docs: '/api/docs',
        health: '/health'
      });
    });

    // API documentation
    this.app.get('/api', (req, res) => {
      res.json({
        service: 'TaskFlow Pro API',
        version: '2.0.0',
        environment: config.env,
        endpoints: {
          auth: '/api/auth',
          users: '/api/users',
          tasks: '/api/tasks',
          teams: '/api/teams',
          attendance: '/api/attendance',
          health: '/health'
        },
        documentation: 'https://docs.taskflowpro.com/api'
      });
    });
  }

  private initializeErrorHandling() {
    // 404 handler
    this.app.use('*', notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  public async start() {
    try {
      // Initialize database
      await dbConnection.runMigrations();
      
      // Test database connection
      const healthCheck = await dbConnection.healthCheck();
      if (healthCheck.status !== 'healthy') {
        throw new Error('Database health check failed');
      }

      // Start server
      this.server = this.app.listen(config.port, config.host, () => {
        logger.info('TaskFlow Pro Server started', {
          port: config.port,
          host: config.host,
          environment: config.env,
          pid: process.pid,
          database: healthCheck.info
        });
      });

      // Graceful shutdown handling
      process.on('SIGTERM', this.gracefulShutdown.bind(this));
      process.on('SIGINT', this.gracefulShutdown.bind(this));
      process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
        this.gracefulShutdown(1);
      });
      process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection', { reason, promise });
        this.gracefulShutdown(1);
      });

    } catch (error) {
      logger.error('Failed to start server', { error: error.message });
      process.exit(1);
    }
  }

  private async gracefulShutdown(signal?: number) {
    logger.info('Shutting down server gracefully...', { signal });

    if (this.server) {
      this.server.close((error) => {
        if (error) {
          logger.error('Error during server shutdown', { error });
        } else {
          logger.info('HTTP server closed');
        }

        // Close database connection
        dbConnection.close();
        
        // Exit process
        process.exit(signal || 0);
      });

      // Force close after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    } else {
      process.exit(signal || 0);
    }
  }

  public getApp() {
    return this.app;
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new TaskFlowServer();
  server.start();
}

export default TaskFlowServer;