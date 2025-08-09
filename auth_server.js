#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import authentication routes
const authRoutes = require('./auth/authRoutes');
const { JWTAuth, authenticateToken } = require('./auth/jwt');

const app = express();
const PORT = process.env.AUTH_PORT || 7810;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.clickup.com"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://192.168.20.10:8888',
            'http://localhost:8888',
            'http://127.0.0.1:8888',
            'http://192.168.20.10:7810',
            'http://localhost:7810'
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            return callback(null, true);
        }
        
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// General middleware
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined', {
    skip: function (req, res) {
        return res.statusCode < 400;
    }
}));

app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'TaskFlow Pro Authentication Server',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Serve static files (login page)
app.use('/static', express.static(path.join(__dirname, 'public')));

// Serve login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Redirect root to login
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Dashboard route (protected)
app.get('/dashboard', authenticateToken, (req, res) => {
    // Redirect to main dashboard
    res.redirect('http://192.168.20.10:8888/');
});

// API routes
app.use('/api/auth', authRoutes);

// Catch-all for API routes
app.all('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        path: req.path,
        method: req.method
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('[ERROR]', err);
    
    // CORS error
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({
            success: false,
            message: 'CORS policy violation',
            origin: req.get('Origin')
        });
    }
    
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid authentication token'
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Authentication token expired'
        });
    }
    
    // Validation errors
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON payload'
        });
    }
    
    // Database errors
    if (err.code === 'ECONNREFUSED') {
        return res.status(503).json({
            success: false,
            message: 'Database connection failed'
        });
    }
    
    // Generic error response
    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.path,
        method: req.method
    });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 TaskFlow Pro Authentication Server Started');
    console.log(`📍 Server running on: http://0.0.0.0:${PORT}`);
    console.log(`🔐 Login page: http://192.168.20.10:${PORT}/login`);
    console.log(`🏥 Health check: http://192.168.20.10:${PORT}/health`);
    console.log(`📊 API base: http://192.168.20.10:${PORT}/api/auth`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('✅ Authentication system ready');
});

module.exports = app;