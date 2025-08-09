/**
 * TaskFlow Pro Authentication Service v2.0
 * Features:
 * - PostgreSQL database integration
 * - JWT with HttpOnly Secure Cookies
 * - bcrypt password hashing
 * - Master user ClickUp OAuth restriction
 * - Role-based access control (master/user)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 7810;

// PostgreSQL connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'taskflow_pro',
    user: process.env.DB_USER || 'taskflow_user',
    password: process.env.DB_PASSWORD || 'TaskFlow2025Secure',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// ClickUp Configuration
const CLICKUP_CONFIG = {
    CLIENT_ID: process.env.CLICKUP_CLIENT_ID,
    CLIENT_SECRET: process.env.CLICKUP_CLIENT_SECRET,
    REDIRECT_URI: process.env.CLICKUP_REDIRECT_URI,
    BASE_URL: 'https://api.clickup.com/api/v2',
    AUTH_URL: 'https://app.clickup.com',
    TOKEN_URL: 'https://api.clickup.com/api/v2/oauth/token'
};

// JWT Configuration
const JWT_CONFIG = {
    SECRET: process.env.JWT_SECRET,
    EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    REMEMBER_EXPIRES_IN: process.env.JWT_REMEMBER_EXPIRES_IN || '30d',
    ISSUER: process.env.JWT_ISSUER || 'taskflow-pro',
    AUDIENCE: process.env.JWT_AUDIENCE || 'taskflow-users'
};

// Cookie Configuration
const COOKIE_CONFIG = {
    NAME: 'taskflow_token',
    SECRET: process.env.COOKIE_SECRET,
    SECURE: process.env.COOKIE_SECURE === 'true',
    HTTP_ONLY: process.env.COOKIE_HTTP_ONLY !== 'false',
    SAME_SITE: process.env.COOKIE_SAME_SITE || 'Strict',
    MAX_AGE: parseInt(process.env.COOKIE_MAX_AGE) || 86400000 // 24 hours
};

const MASTER_USER_EMAIL = process.env.MASTER_USER_EMAIL || 'yterayut@gmail.com';

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // Allow inline scripts for development
}));

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://192.168.20.10:8888'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Rate limiting
const loginLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5,
    message: {
        success: false,
        error: 'Too many login attempts, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ========================
// JWT Utility Functions
// ========================

function generateToken(payload, expiresIn = JWT_CONFIG.EXPIRES_IN) {
    try {
        return jwt.sign(payload, JWT_CONFIG.SECRET, {
            expiresIn,
            issuer: JWT_CONFIG.ISSUER,
            audience: JWT_CONFIG.AUDIENCE
        });
    } catch (error) {
        console.error('JWT generation error:', error);
        throw new Error('Failed to generate authentication token');
    }
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_CONFIG.SECRET, {
            issuer: JWT_CONFIG.ISSUER,
            audience: JWT_CONFIG.AUDIENCE
        });
    } catch (error) {
        console.error('JWT verification error:', error);
        throw new Error('Invalid or expired token');
    }
}

function setAuthCookie(res, token, rememberMe = false) {
    const maxAge = rememberMe ? 
        30 * 24 * 60 * 60 * 1000 : // 30 days 
        COOKIE_CONFIG.MAX_AGE;     // 24 hours
    
    res.cookie(COOKIE_CONFIG.NAME, token, {
        httpOnly: COOKIE_CONFIG.HTTP_ONLY,
        secure: COOKIE_CONFIG.SECURE,
        sameSite: COOKIE_CONFIG.SAME_SITE,
        maxAge: maxAge,
        path: '/'
    });
}

function clearAuthCookie(res) {
    res.clearCookie(COOKIE_CONFIG.NAME, {
        httpOnly: COOKIE_CONFIG.HTTP_ONLY,
        secure: COOKIE_CONFIG.SECURE,
        sameSite: COOKIE_CONFIG.SAME_SITE,
        path: '/'
    });
}

function getTokenFromRequest(req) {
    // Check Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    
    // Check cookies
    return req.cookies?.[COOKIE_CONFIG.NAME];
}

// ========================
// Database Functions
// ========================

async function findUserByEmail(email) {
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1 AND is_active = true',
            [email.toLowerCase()]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Database error finding user:', error);
        throw new Error('Database query failed');
    }
}

async function findUserById(id) {
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE id = $1 AND is_active = true',
            [id]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Database error finding user by ID:', error);
        throw new Error('Database query failed');
    }
}

async function updateLastLogin(userId) {
    try {
        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [userId]
        );
    } catch (error) {
        console.error('Database error updating last login:', error);
        // Don't throw - this is not critical
    }
}

async function verifyPassword(plainPassword, hashedPassword) {
    try {
        return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
        console.error('Password verification error:', error);
        return false;
    }
}

// ========================
// Authentication Middleware
// ========================

async function authenticateToken(req, res, next) {
    try {
        const token = getTokenFromRequest(req);
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }
        
        const decoded = verifyToken(token);
        const user = await findUserById(decoded.userId);
        
        if (!user) {
            clearAuthCookie(res);
            return res.status(401).json({
                success: false,
                message: 'User not found or inactive'
            });
        }
        
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.full_name
        };
        
        next();
        
    } catch (error) {
        console.error('Authentication error:', error);
        clearAuthCookie(res);
        
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
}

function requireMasterRole(req, res, next) {
    if (req.user.role !== 'master') {
        return res.status(403).json({
            success: false,
            message: 'Master role required'
        });
    }
    next();
}

// ========================
// Authentication Routes
// ========================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'TaskFlow Pro Authentication Service v2.0',
        version: '2.0.0',
        features: [
            'PostgreSQL Database',
            'JWT + HttpOnly Cookies',
            'bcrypt Password Hashing',
            'Master User ClickUp OAuth',
            'Role-based Access Control'
        ],
        database: pool.totalCount > 0 ? 'Connected' : 'Disconnected'
    });
});

// Login endpoint
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        const { email, password, rememberMe = false } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }
        
        console.log(`[AUTH] Login attempt for: ${email}`);
        
        // Find user in database
        const user = await findUserByEmail(email);
        
        if (!user) {
            console.log(`[AUTH] User not found: ${email}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
        
        // Verify password
        const isValidPassword = await verifyPassword(password, user.password_hash);
        
        if (!isValidPassword) {
            console.log(`[AUTH] Invalid password for: ${email}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
        
        // Generate JWT token
        const tokenPayload = {
            userId: user.id,
            email: user.email,
            role: user.role
        };
        
        const expiresIn = rememberMe ? JWT_CONFIG.REMEMBER_EXPIRES_IN : JWT_CONFIG.EXPIRES_IN;
        const token = generateToken(tokenPayload, expiresIn);
        
        // Set cookie
        setAuthCookie(res, token, rememberMe);
        
        // Update last login
        await updateLastLogin(user.id);
        
        console.log(`[AUTH] Login successful for: ${email} (${user.role})`);
        
        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                fullName: user.full_name
            },
            token: token, // For compatibility
            expiresIn: expiresIn
        });
        
    } catch (error) {
        console.error('[AUTH] Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again.'
        });
    }
});

// Token verification
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: req.user,
        authenticated: true
    });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    clearAuthCookie(res);
    
    res.json({
        success: true,
        message: 'Logout successful'
    });
});

// Token refresh
app.post('/api/auth/refresh', authenticateToken, (req, res) => {
    try {
        const newToken = generateToken({
            userId: req.user.id,
            email: req.user.email,
            role: req.user.role
        });
        
        setAuthCookie(res, newToken);
        
        res.json({
            success: true,
            token: newToken,
            expiresIn: JWT_CONFIG.EXPIRES_IN
        });
        
    } catch (error) {
        console.error('[AUTH] Token refresh error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refresh token'
        });
    }
});

// User profile
app.get('/api/auth/profile', authenticateToken, (req, res) => {
    res.json({
        success: true,
        profile: {
            id: req.user.id,
            email: req.user.email,
            role: req.user.role,
            fullName: req.user.fullName
        }
    });
});

// ========================
// ClickUp OAuth Routes (Master User Only)
// ========================

app.get('/auth/clickup', (req, res) => {
    // Allow testing different OAuth configurations via query params
    const testClientId = req.query.client_id || CLICKUP_CONFIG.CLIENT_ID;
    const testRedirectUri = req.query.redirect_uri || CLICKUP_CONFIG.REDIRECT_URI;
    const testEndpoint = req.query.endpoint || 'oauth'; // 'oauth' or 'api/oauth'
    
    const baseUrl = testEndpoint === 'api/oauth' 
        ? 'https://app.clickup.com/api/oauth/authorize'
        : 'https://app.clickup.com/oauth/authorize';
    
    const authUrl = `${baseUrl}?` +
        `client_id=${testClientId}&` +
        `redirect_uri=${encodeURIComponent(testRedirectUri)}&` +
        `response_type=code`;
    
    console.log('[CLICKUP] OAuth URL:', authUrl);
    console.log('[CLICKUP] Client ID:', testClientId);
    console.log('[CLICKUP] Redirect URI:', testRedirectUri);
    console.log('[CLICKUP] Endpoint:', baseUrl);
    console.log('[CLICKUP] Redirecting to ClickUp OAuth');
    
    res.redirect(authUrl);
});

// Handle ClickUp redirect at root level since they only allow domain:port format
app.get('/', async (req, res) => {
    // Check if this is a ClickUp OAuth callback
    if (req.query.code) {
        return handleClickUpCallback(req, res);
    }
    
    // Otherwise redirect to dashboard
    res.redirect(`${process.env.FRONTEND_URL}/`);
});

app.get('/auth/callback', async (req, res) => {
    return handleClickUpCallback(req, res);
});

async function handleClickUpCallback(req, res) {
    try {
        const { code } = req.query;
        
        if (!code) {
            throw new Error('No authorization code received');
        }
        
        console.log('[CLICKUP] Processing OAuth callback');
        
        // Exchange code for tokens
        const tokenResponse = await axios.post(CLICKUP_CONFIG.TOKEN_URL, {
            client_id: CLICKUP_CONFIG.CLIENT_ID,
            client_secret: CLICKUP_CONFIG.CLIENT_SECRET,
            code: code,
            redirect_uri: CLICKUP_CONFIG.REDIRECT_URI
        });
        
        const { access_token, refresh_token } = tokenResponse.data;
        
        // Get user info from ClickUp
        const userResponse = await axios.get(`${CLICKUP_CONFIG.BASE_URL}/user`, {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        
        const clickupUser = userResponse.data.user;
        const email = clickupUser.email.toLowerCase();
        
        console.log(`[CLICKUP] OAuth user: ${email}`);
        
        // Verify this is the master user
        if (email !== MASTER_USER_EMAIL.toLowerCase()) {
            console.log(`[CLICKUP] Unauthorized OAuth attempt: ${email} (not master user)`);
            return res.redirect(`${process.env.FRONTEND_URL}/login.html?error=unauthorized`);
        }
        
        // Find master user in database
        const masterUser = await findUserByEmail(email);
        
        if (!masterUser || masterUser.role !== 'master') {
            console.log(`[CLICKUP] Master user not found in database: ${email}`);
            return res.redirect(`${process.env.FRONTEND_URL}/login.html?error=user_not_found`);
        }
        
        // Store ClickUp tokens
        const expiresAt = new Date(Date.now() + (tokenResponse.data.expires_in * 1000));
        
        await pool.query(`
            INSERT INTO clickup_tokens (user_id, access_token, refresh_token, expires_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                expires_at = EXCLUDED.expires_at,
                updated_at = CURRENT_TIMESTAMP
        `, [masterUser.id, access_token, refresh_token, expiresAt]);
        
        // Generate JWT for master user
        const token = generateToken({
            userId: masterUser.id,
            email: masterUser.email,
            role: masterUser.role
        });
        
        setAuthCookie(res, token);
        await updateLastLogin(masterUser.id);
        
        console.log(`[CLICKUP] Master user authenticated successfully: ${email}`);
        
        res.redirect(`${process.env.FRONTEND_URL}/?clickup=connected`);
        
    } catch (error) {
        console.error('[CLICKUP] OAuth callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/login.html?error=oauth_failed`);
    }
}

// Get ClickUp connection status
app.get('/api/auth/clickup/status', authenticateToken, requireMasterRole, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT access_token, expires_at FROM clickup_tokens WHERE user_id = $1',
            [req.user.id]
        );
        
        const tokenData = result.rows[0];
        const isConnected = tokenData && new Date(tokenData.expires_at) > new Date();
        
        res.json({
            success: true,
            connected: isConnected,
            expiresAt: tokenData?.expires_at
        });
        
    } catch (error) {
        console.error('[CLICKUP] Status check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check ClickUp connection'
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Database connection test
async function testDatabaseConnection() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        console.log('✅ Database connected successfully');
        client.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// Start server
async function startServer() {
    const dbConnected = await testDatabaseConnection();
    
    if (!dbConnected) {
        console.error('💥 Server startup failed: Database connection required');
        process.exit(1);
    }
    
    app.listen(PORT, () => {
        console.log('\n🚀 TaskFlow Pro Authentication Service v2.0');
        console.log('===========================================');
        console.log(`📡 Server running on port ${PORT}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔐 JWT + HttpOnly Cookies enabled`);
        console.log(`🗃️  PostgreSQL database connected`);
        console.log(`👤 Master user: ${MASTER_USER_EMAIL}`);
        console.log(`🔑 ClickUp OAuth: ${CLICKUP_CONFIG.CLIENT_ID ? 'Configured' : 'Not configured'}`);
        console.log('\n🎯 Available endpoints:');
        console.log(`   POST /api/auth/login`);
        console.log(`   GET  /api/auth/verify`);
        console.log(`   POST /api/auth/logout`);
        console.log(`   POST /api/auth/refresh`);
        console.log(`   GET  /api/auth/profile`);
        console.log(`   GET  /auth/clickup (Master only)`);
        console.log(`   GET  /api/auth/clickup/status (Master only)`);
        console.log(`   GET  /health`);
    });
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully');
    pool.end(() => {
        console.log('✅ Database connections closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully');
    pool.end(() => {
        console.log('✅ Database connections closed');
        process.exit(0);
    });
});

if (require.main === module) {
    startServer();
}

module.exports = app;