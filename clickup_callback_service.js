const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 777;

// Enable CORS
app.use(cors({
    origin: ['http://192.168.20.10:8888', 'http://localhost:8888'],
    credentials: true
}));

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'ClickUp Callback Service',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// ClickUp OAuth callback handler
app.get('/auth/callback', async (req, res) => {
    const { code, state } = req.query;
    
    console.log(`[${new Date().toISOString()}] ClickUp callback received - Code: ${code ? 'YES' : 'NO'}`);
    
    if (!code) {
        console.error('No authorization code received from ClickUp');
        return res.redirect(`http://192.168.20.10:8888/?auth=error&message=No authorization code`);
    }

    // Redirect to frontend with code for processing
    console.log(`[${new Date().toISOString()}] Redirecting to frontend with code`);
    res.redirect(`http://192.168.20.10:8888/?code=${code}&state=${state}&setup=master`);
});

// Catch all other auth routes
app.get('/auth/*', (req, res) => {
    console.log(`[${new Date().toISOString()}] Received auth request: ${req.path}`);
    res.redirect(`http://192.168.20.10:8888${req.path}${req.url.includes('?') ? '&' + req.url.split('?')[1] : ''}`);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🔗 ClickUp Callback Service running on port ${PORT}`);
    console.log(`📍 Callback URL: http://192.168.20.10:${PORT}/auth/callback`);
    console.log(`🏥 Health check: http://192.168.20.10:${PORT}/health`);
    console.log(`🎯 Redirects to: http://192.168.20.10:8888`);
});

module.exports = app;