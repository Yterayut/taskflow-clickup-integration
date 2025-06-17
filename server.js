const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const PORT = process.env.PORT || 666;

// Basic middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/frontend-health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'TaskFlow Frontend', 
    port: PORT,
    timestamp: new Date().toISOString(),
    version: '1.0.0-demo',
    environment: 'production'
  });
});

// API proxy middleware for all backend requests
app.use('/api', createProxyMiddleware({
  target: 'http://127.0.0.1:777',
  changeOrigin: true,
  timeout: 30000,
  proxyTimeout: 30000,
  onError: (err, req, res) => {
    console.error('Proxy Error:', err.message);
    res.status(502).json({ 
      error: 'Backend service unavailable',
      message: 'Unable to connect to backend API on port 777',
      timestamp: new Date().toISOString()
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[PROXY] ${req.method} ${req.url} -> http://127.0.0.1:777${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[PROXY] Response: ${proxyRes.statusCode} for ${req.url}`);
  }
}));

// Fallback for API requests when proxy fails
app.get('/api/v1/health', async (req, res) => {
  try {
    const response = await fetch('http://127.0.0.1:777/health');
    if (response.ok) {
      const data = await response.json();
      res.json(data);
    } else {
      throw new Error(`Backend responded with status ${response.status}`);
    }
  } catch (error) {
    console.error('Backend health check failed:', error.message);
    res.status(502).json({ 
      error: 'Backend not available',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Serve main page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎨 TaskFlow Frontend running on port ${PORT} (all interfaces)`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Frontend server shutting down gracefully');
  process.exit(0);
});
