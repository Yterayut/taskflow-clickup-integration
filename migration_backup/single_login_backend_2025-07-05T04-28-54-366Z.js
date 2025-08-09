/**
 * TaskFlow Pro v2.1 - Single Login Implementation Backend
 * Domain-driven authentication system with ClickUp integration
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

// Infrastructure imports
const { getDatabase } = require('./infrastructure/database/DatabaseClient');
const { PostgresUserRepository } = require('./infrastructure/repositories/PostgresUserRepository');
const { PostgresClickUpTokenRepository } = require('./infrastructure/repositories/PostgresClickUpTokenRepository');
const { PostgresSystemStatusRepository } = require('./infrastructure/repositories/PostgresSystemStatusRepository');
const { ClickUpOAuthAdapter } = require('./infrastructure/adapters/ClickUpOAuthAdapter');
const { JWTService } = require('./infrastructure/adapters/JWTService');

// Application services imports
const { AuthenticationService } = require('./application/services/AuthenticationService');
const { SystemService } = require('./application/services/SystemService');

// API routes imports
const singleAuthRoutes = require('./api/routes/singleAuthRoutes');
const oauthRoutes = require('./api/routes/oauthRoutes');
const systemRoutes = require('./api/routes/systemRoutes');
const clickupDataRoutes = require('./api/routes/clickupDataRoutes');

const app = express();
const PORT = process.env.PORT || 7812;

// Environment validation
const requiredEnvVars = [
    'JWT_SECRET',
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'CLICKUP_CLIENT_ID',
    'CLICKUP_CLIENT_SECRET',
    'CLICKUP_REDIRECT_URI',
    'MASTER_USER_EMAIL'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnvVars);
    process.exit(1);
}

console.log('✅ Environment variables validated');

// CORS configuration
app.use(cors({
    origin: [
        'http://192.168.20.10:8888',
        'http://localhost:8888',
        'http://127.0.0.1:8888'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session configuration for OAuth state management
app.use(session({
    secret: process.env.SESSION_SECRET || 'taskflow-session-secret-v2',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // HTTP compatibility for OAuth flow
        httpOnly: true,
        sameSite: 'lax', // Required for OAuth cross-origin redirects
        maxAge: 10 * 60 * 1000 // 10 minutes for OAuth flow
    }
}));

// Rate limiting
const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_REQUESTS) || 100,
    message: {
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/', generalLimiter);

// JWT Authentication Middleware
const authenticateJWT = (req, res, next) => {
    const publicRoutes = ['/health', '/api/v2/auth/login', '/auth/clickup', '/auth/clickup/callback', '/api/v2/token/status', '/api/v2/token/validate'];
    if (publicRoutes.includes(req.path)) {
        return next();
    }
    
    const token = req.cookies.taskflow_token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }
    
    try {
        const jwtService = app.get('jwtService');
        const payload = jwtService.verifyToken(token);
        req.user = {
            userId: payload.userId,
            email: payload.email,
            role: payload.role,
            capabilities: payload.capabilities
        };
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
};

// Apply authentication middleware after services are initialized
let authMiddlewareApplied = false;

// Initialize database and services
async function initializeServices() {
    try {
        console.log('🔄 Initializing database connection...');
        const dbClient = getDatabase();
        await dbClient.connect();
        
        console.log('🔄 Initializing repositories...');
        const userRepository = new PostgresUserRepository(dbClient);
        const tokenRepository = new PostgresClickUpTokenRepository(dbClient);
        const statusRepository = new PostgresSystemStatusRepository(dbClient);
        
        console.log('🔄 Initializing adapters...');
        const clickupIntegration = new ClickUpOAuthAdapter();
        const jwtService = new JWTService();
        
        console.log('🔄 Initializing application services...');
        const systemService = new SystemService({
            tokenRepository,
            clickupIntegration,
            statusRepository,
            userRepository
        });
        
        const authenticationService = new AuthenticationService({
            userRepository,
            tokenRepository,
            clickupIntegration,
            jwtService,
            systemService
        });
        
        // Initialize system status if needed
        await statusRepository.initialize();
        
        // Store services in app for route access
        app.set('dbClient', dbClient);
        app.set('userRepository', userRepository);
        app.set('tokenRepository', tokenRepository);
        app.set('statusRepository', statusRepository);
        app.set('clickupIntegration', clickupIntegration);
        app.set('jwtService', jwtService);
        app.set('systemService', systemService);
        app.set('authenticationService', authenticationService);
        
        // Add additional services for dashboard routes
        app.set('authService', authenticationService);
        app.set('clickupService', clickupIntegration);
        app.set('userService', userRepository);
        app.set('analyticsService', {
            async getFullAnalytics() {
                // Implementation for full analytics
                return { completed: 0, inProgress: 0, overdue: 0 };
            },
            async getTeamAnalytics(userId) {
                // Implementation for team analytics
                return { completed: 0, inProgress: 0, overdue: 0 };
            },
            async getPersonalAnalytics(userId) {
                // Implementation for personal analytics
                return { completed: 0, inProgress: 0, overdue: 0 };
            }
        });
        
        console.log('✅ Services initialized successfully');
        
        // Apply authentication middleware after services are ready
        if (!authMiddlewareApplied) {
            app.use(authenticateJWT);
            authMiddlewareApplied = true;
            console.log('✅ Authentication middleware applied');
        }
        
        return { systemService, authenticationService };
    } catch (error) {
        console.error('❌ Service initialization failed:', error);
        throw error;
    }
}

// Feature flag check middleware
function checkFeatureFlags(req, res, next) {
    const singleLoginEnabled = process.env.SINGLE_LOGIN_ENABLED === 'true';
    const legacySupport = process.env.LEGACY_SUPPORT !== 'false';
    
    // Add feature flags to request object
    req.featureFlags = {
        singleLoginEnabled,
        legacySupport
    };
    
    next();
}

app.use(checkFeatureFlags);

// Health check endpoint (basic)
app.get('/health', async (req, res) => {
    try {
        const dbClient = app.get('dbClient');
        if (dbClient) {
            await dbClient.healthCheck();
        }
        
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            service: 'TaskFlow Pro Single Login Authentication Service',
            version: '2.1.0',
            features: [
                'Single form login with auto flow detection',
                'ClickUp OAuth integration',
                'JWT with HttpOnly cookies',
                'System health monitoring'
            ],
            environment: process.env.NODE_ENV,
            uptime_seconds: Math.floor(process.uptime()),
            single_login_enabled: process.env.SINGLE_LOGIN_ENABLED === 'true',
            legacy_support: process.env.LEGACY_SUPPORT !== 'false'
        });
    } catch (error) {
        res.status(503).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            error: error.message,
            service: 'TaskFlow Pro Single Login Authentication Service'
        });
    }
});

// Mount API routes
console.log('🔄 Mounting API routes...');

// V2 API routes (single login implementation)
app.use('/api/v2/auth', singleAuthRoutes);
app.use('/api/v2/system', systemRoutes);
app.use('/api/v2/clickup', clickupDataRoutes);
app.use('/api/v2/dashboard', require('./api/routes/dashboardRoutes'));
app.use('/api/v2/token', require('./api/routes/tokenRoutes'));

// OAuth routes
app.use('/auth', oauthRoutes);

// Legacy API support (if enabled)
if (process.env.LEGACY_SUPPORT !== 'false') {
    console.log('🔄 Legacy API support enabled');
    
    // Redirect legacy endpoints to new ones
    app.use('/api/auth/login', (req, res) => {
        res.redirect(307, '/api/v2/auth/login'); // 307 preserves method and body
    });
    
    app.use('/api/system/status', (req, res) => {
        res.redirect('/api/v2/system/status');
    });
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'API endpoint not found',
        code: 'ENDPOINT_NOT_FOUND',
        available_endpoints: {
            v2_auth: '/api/v2/auth/*',
            v2_system: '/api/v2/system/*',
            oauth: '/auth/clickup/*'
        }
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🔄 SIGTERM received, shutting down gracefully...');
    
    const dbClient = app.get('dbClient');
    if (dbClient) {
        await dbClient.close();
    }
    
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🔄 SIGINT received, shutting down gracefully...');
    
    const dbClient = app.get('dbClient');
    if (dbClient) {
        await dbClient.close();
    }
    
    process.exit(0);
});

// Start server
async function startServer() {
    try {
        console.log('🚀 Starting TaskFlow Pro Single Login Authentication Service v2.1...');
        
        // Initialize services
        const { systemService } = await initializeServices();
        
        // Check initial system status
        console.log('🔄 Checking initial system status...');
        const initialStatus = await systemService.getStatus();
        console.log('📊 Initial system status:', {
            operational: initialStatus.isOperational(),
            level: initialStatus.getStatusLevel(),
            message: initialStatus.getStatusMessage()
        });
        
        // Start HTTP server
        const server = app.listen(PORT, () => {
            console.log('✅ Server started successfully!');
            console.log(`🌐 Server running on port ${PORT}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/health`);
            console.log(`🔐 Authentication API: http://localhost:${PORT}/api/v2/auth/`);
            console.log(`⚙️  System API: http://localhost:${PORT}/api/v2/system/`);
            console.log(`🔄 OAuth endpoint: http://localhost:${PORT}/auth/clickup`);
            console.log('📋 Feature flags:', {
                singleLoginEnabled: process.env.SINGLE_LOGIN_ENABLED === 'true',
                legacySupport: process.env.LEGACY_SUPPORT !== 'false'
            });
            console.log('🎯 Ready to accept requests!');
        });
        
        // Handle server errors
        server.on('error', (error) => {
            console.error('❌ Server error:', error);
            process.exit(1);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer().catch(error => {
    console.error('❌ Startup error:', error);
    process.exit(1);
});

module.exports = app;