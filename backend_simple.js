const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 777;

// CORS configuration
app.use(cors({
    origin: 'http://192.168.20.10:555',
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'TaskFlow Backend - Simple Version',
    port: PORT.toString(),
    timestamp: new Date().toISOString(),
    version: '2.0.0-simple'
  });
});

// API v1 routes
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'TaskFlow API v1',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    status: 'TaskFlow Backend - Simple Version',
    message: 'Backend is operational',
    health_check: '/health',
    version: '2.0.0-simple'
  });
});

// Start server on all interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TaskFlow Backend (Simple) starting on port ${PORT}...`);
  console.log(`🌐 Listening on all interfaces (0.0.0.0:${PORT})`);
  console.log(`✅ Backend service ready for TaskFlow Pro`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Backend server shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Backend server shutting down gracefully');
  process.exit(0);
});