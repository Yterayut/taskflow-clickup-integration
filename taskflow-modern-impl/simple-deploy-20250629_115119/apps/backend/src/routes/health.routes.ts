import { Router } from 'express';
import { z } from 'zod';
import dbConnection from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/app.config.js';

const router = Router();

// Health check endpoint
router.get('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Check database health
    const dbHealth = await dbConnection.healthCheck();
    
    // Check system resources
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    const healthStatus = {
      status: dbHealth.status === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      version: '2.0.0',
      environment: config.env,
      services: {
        database: {
          status: dbHealth.status,
          responseTime: `${responseTime}ms`,
          ...dbHealth.info
        },
        api: {
          status: 'healthy',
          responseTime: `${responseTime}ms`
        }
      },
      system: {
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        },
        uptime: Math.floor(uptime),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      }
    };

    // Log health check
    logger.debug('Health check performed', {
      status: healthStatus.status,
      responseTime: healthStatus.services.database.responseTime,
      memoryUsed: healthStatus.system.memory.used,
    });

    // Set appropriate status code
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json(healthStatus);
    
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      uptime: Math.floor(process.uptime()),
      version: '2.0.0',
      environment: config.env,
    });
  }
});

// Readiness probe (for Kubernetes)
router.get('/ready', async (req, res) => {
  try {
    // Check if database is ready
    const dbHealth = await dbConnection.healthCheck();
    
    if (dbHealth.status === 'healthy') {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'ready'
        }
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'not_ready'
        }
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Liveness probe (for Kubernetes)
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    pid: process.pid
  });
});

// Detailed system information (requires admin)
router.get('/info', async (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const dbHealth = await dbConnection.healthCheck();
    
    const systemInfo = {
      service: 'TaskFlow Pro API',
      version: '2.0.0',
      environment: config.env,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      pid: process.pid,
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      database: dbHealth,
      config: {
        port: config.port,
        host: config.host,
        cors: config.cors,
        // Don't expose sensitive config
      }
    };

    res.json(systemInfo);
  } catch (error) {
    logger.error('Failed to get system info', { error: error.message });
    res.status(500).json({
      error: 'Failed to get system information',
      message: error.message
    });
  }
});

export default router;