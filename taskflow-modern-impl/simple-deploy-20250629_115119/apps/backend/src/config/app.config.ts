import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Configuration schema
const configSchema = z.object({
  // Server configuration
  env: z.enum(['development', 'production', 'test']).default('development'),
  host: z.string().default('localhost'),
  port: z.coerce.number().default(5000),
  
  // Database configuration
  database: z.object({
    path: z.string().default('./data/taskflow.db'),
    migrationsPath: z.string().default('./src/database/migrations'),
    backupPath: z.string().default('./data/backups'),
  }),

  // JWT configuration
  jwt: z.object({
    secret: z.string().min(32),
    expiresIn: z.string().default('24h'),
    refreshExpiresIn: z.string().default('7d'),
    algorithm: z.enum(['HS256', 'HS384', 'HS512', 'RS256']).default('HS256'),
  }),

  // CORS configuration
  cors: z.object({
    origins: z.array(z.string()).default(['http://localhost:3000', 'http://localhost:8888']),
  }),

  // Redis configuration
  redis: z.object({
    url: z.string().optional(),
    host: z.string().default('localhost'),
    port: z.coerce.number().default(6379),
    password: z.string().optional(),
    db: z.coerce.number().default(0),
    keyPrefix: z.string().default('taskflow:'),
  }),

  // ClickUp integration
  clickup: z.object({
    clientId: z.string(),
    clientSecret: z.string(),
    redirectUri: z.string(),
    baseUrl: z.string().default('https://api.clickup.com/api/v2'),
    authUrl: z.string().default('https://app.clickup.com/api'),
  }),

  // Email configuration
  email: z.object({
    provider: z.enum(['smtp', 'sendgrid', 'ses']).default('smtp'),
    from: z.string().email(),
    smtp: z.object({
      host: z.string().optional(),
      port: z.coerce.number().optional(),
      secure: z.boolean().default(false),
      user: z.string().optional(),
      password: z.string().optional(),
    }).optional(),
  }),

  // File upload configuration
  upload: z.object({
    maxFileSize: z.coerce.number().default(10 * 1024 * 1024), // 10MB
    allowedTypes: z.array(z.string()).default([
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]),
    path: z.string().default('./data/uploads'),
  }),

  // Logging configuration
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    file: z.object({
      enabled: z.boolean().default(true),
      path: z.string().default('./logs'),
      maxSize: z.string().default('10m'),
      maxFiles: z.string().default('14d'),
    }),
    console: z.object({
      enabled: z.boolean().default(true),
      colorize: z.boolean().default(true),
    }),
  }),

  // Rate limiting
  rateLimit: z.object({
    windowMs: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
    max: z.coerce.number().default(100),
    authMax: z.coerce.number().default(5),
  }),
});

// Parse and validate configuration
const parseConfig = () => {
  const rawConfig = {
    env: process.env.NODE_ENV,
    host: process.env.HOST,
    port: process.env.PORT,

    database: {
      path: process.env.DATABASE_PATH,
      migrationsPath: process.env.MIGRATIONS_PATH,
      backupPath: process.env.BACKUP_PATH,
    },

    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN,
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
      algorithm: process.env.JWT_ALGORITHM,
    },

    cors: {
      origins: process.env.CORS_ORIGINS?.split(',') || undefined,
    },

    redis: {
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB,
      keyPrefix: process.env.REDIS_KEY_PREFIX,
    },

    clickup: {
      clientId: process.env.CLICKUP_CLIENT_ID,
      clientSecret: process.env.CLICKUP_CLIENT_SECRET,
      redirectUri: process.env.CLICKUP_REDIRECT_URI,
      baseUrl: process.env.CLICKUP_BASE_URL,
      authUrl: process.env.CLICKUP_AUTH_URL,
    },

    email: {
      provider: process.env.EMAIL_PROVIDER,
      from: process.env.EMAIL_FROM,
      smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER,
        password: process.env.SMTP_PASSWORD,
      },
    },

    upload: {
      maxFileSize: process.env.UPLOAD_MAX_FILE_SIZE,
      allowedTypes: process.env.UPLOAD_ALLOWED_TYPES?.split(',') || undefined,
      path: process.env.UPLOAD_PATH,
    },

    logging: {
      level: process.env.LOG_LEVEL,
      file: {
        enabled: process.env.LOG_FILE_ENABLED !== 'false',
        path: process.env.LOG_FILE_PATH,
        maxSize: process.env.LOG_FILE_MAX_SIZE,
        maxFiles: process.env.LOG_FILE_MAX_FILES,
      },
      console: {
        enabled: process.env.LOG_CONSOLE_ENABLED !== 'false',
        colorize: process.env.LOG_CONSOLE_COLORIZE !== 'false',
      },
    },

    rateLimit: {
      windowMs: process.env.RATE_LIMIT_WINDOW_MS,
      max: process.env.RATE_LIMIT_MAX,
      authMax: process.env.RATE_LIMIT_AUTH_MAX,
    },
  };

  try {
    return configSchema.parse(rawConfig);
  } catch (error) {
    console.error('Configuration validation failed:');
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
};

export const config = parseConfig();

// Export individual configurations for convenience
export const {
  env,
  host,
  port,
  database,
  jwt,
  cors,
  redis,
  clickup,
  email,
  upload,
  logging,
  rateLimit,
} = config;