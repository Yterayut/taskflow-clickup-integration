// Minimal OAuth Backend - No External Dependencies
const http = require('http');
const url = require('url');
const crypto = require('crypto');
const https = require('https');

const PORT = 777;

// ClickUp Configuration
const CLICKUP_CONFIG = {
    clientId: 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL',
    clientSecret: 'BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX',
    redirectUri: 'http://192.168.20.10:777/api/v1/auth/clickup/callback',
    baseApiUrl: 'https://api.clickup.com/api/v2'
};

// In-memory storage
let sessionStorage = new Map();
let clickupTokens = new Map();

// Utility functions
function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    if (data) {
        console.log(`[${timestamp}] [DATA] ${JSON.stringify(data, null, 2)}`);
    }
}

function sendCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', 'http://192.168.20.10:555');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function sendJSON(res, statusCode, data) {
    sendCORS(res);
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function sendRedirect(res, location) {
    res.writeHead(302, { 
        'Location': location,
        'Cache-Control': 'no-cache'
    });
    res.end();
}

function makeHTTPSRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = {
                        status: res.statusCode,
                        headers: res.headers,
                        data: JSON.parse(data)
                    };
                    resolve(result);
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const { pathname, query } = parsedUrl;
    const method = req.method;

    log('info', `${method} ${pathname}`, { query });

    // Handle preflight requests
    if (method === 'OPTIONS') {
        sendCORS(res);
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        // Health check
        if (pathname === '/health') {
            sendJSON(res, 200, {
                status: 'OK',
                timestamp: new Date().toISOString(),
                service: 'TaskFlow Backend - Minimal OAuth',
                version: '9.0.0-minimal-oauth',
                clickup: {
                    configured: true,
                    clientId: CLICKUP_CONFIG.clientId.substring(0, 10) + '...',
                    redirectUri: CLICKUP_CONFIG.redirectUri
                }
            });
            return;
        }

        // Generate OAuth URL
        if (pathname === '/api/v1/auth/clickup/auth-url') {
            const state = crypto.randomBytes(32).toString('hex');
            sessionStorage.set(state, { 
                timestamp: Date.now(),
                ip: req.connection.remoteAddress 
            });
            
            const authUrl = `https://app.clickup.com/api?` +
                `client_id=${CLICKUP_CONFIG.clientId}&` +
                `redirect_uri=${encodeURIComponent(CLICKUP_CONFIG.redirectUri)}&` +
                `state=${state}`;
            
            log('info', 'OAuth URL generated', { authUrl, state });
            
            sendJSON(res, 200, {
                authorization_url: authUrl,
                state: state,
                message: 'Redirect user to authorization_url to complete ClickUp authentication'
            });
            return;
        }

        // Direct OAuth redirect
        if (pathname === '/api/v1/auth/clickup/authorize') {
            const state = crypto.randomBytes(32).toString('hex');
            sessionStorage.set(state, { 
                timestamp: Date.now(),
                ip: req.connection.remoteAddress 
            });
            
            const authUrl = `https://app.clickup.com/api?` +
                `client_id=${CLICKUP_CONFIG.clientId}&` +
                `redirect_uri=${encodeURIComponent(CLICKUP_CONFIG.redirectUri)}&` +
                `state=${state}`;
            
            log('info', 'Direct OAuth redirect', { authUrl });
            sendRedirect(res, authUrl);
            return;
        }

        // OAuth callback
        if (pathname === '/api/v1/auth/clickup/callback') {
            const { code, state, error } = query;
            
            log('info', '=== OAUTH CALLBACK ===', { hasCode: !!code, hasState: !!state, hasError: !!error });
            
            try {
                if (error) {
                    throw new Error(`OAuth error: ${error}`);
                }
                
                if (!state || !sessionStorage.has(state)) {
                    throw new Error('Invalid state parameter');
                }
                
                if (!code) {
                    throw new Error('No authorization code received');
                }
                
                // Check code age
                const stateData = sessionStorage.get(state);
                const codeAge = Date.now() - stateData.timestamp;
                
                if (codeAge > 10 * 60 * 1000) {
                    throw new Error('Authorization code has expired');
                }
                
                log('info', 'Starting token exchange', { code: code.substring(0, 20) + '...' });
                
                // Token exchange
                const tokenOptions = {
                    hostname: 'api.clickup.com',
                    path: '/api/v2/oauth/token',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'TaskFlow-Pro/9.0.0-Minimal'
                    }
                };
                
                const tokenData = JSON.stringify({
                    client_id: CLICKUP_CONFIG.clientId,
                    client_secret: CLICKUP_CONFIG.clientSecret,
                    code: code
                });
                
                const tokenResponse = await makeHTTPSRequest(tokenOptions, tokenData);
                
                log('info', 'Token exchange response', { 
                    status: tokenResponse.status,
                    dataType: typeof tokenResponse.data 
                });
                
                if (tokenResponse.status !== 200 || !tokenResponse.data.access_token) {
                    throw new Error(`Token exchange failed: ${JSON.stringify(tokenResponse.data)}`);
                }
                
                const accessToken = tokenResponse.data.access_token;
                log('info', '🎉 ACCESS TOKEN SUCCESS!', { 
                    tokenLength: accessToken.length 
                });
                
                // Get user info
                const userOptions = {
                    hostname: 'api.clickup.com',
                    path: '/api/v2/user',
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                };
                
                const userResponse = await makeHTTPSRequest(userOptions);
                
                if (userResponse.status === 200 && userResponse.data.user) {
                    log('info', 'User info retrieved', { 
                        username: userResponse.data.user.username 
                    });
                }
                
                // Store token
                const sessionId = crypto.randomBytes(32).toString('hex');
                clickupTokens.set(sessionId, {
                    accessToken: accessToken,
                    timestamp: Date.now(),
                    ip: req.connection.remoteAddress,
                    tokenData: tokenResponse.data,
                    user: userResponse.data?.user
                });
                
                log('info', 'Token stored successfully', { 
                    sessionId: sessionId.substring(0, 10) + '...',
                    storedTokens: clickupTokens.size
                });
                
                // Clean up state
                sessionStorage.delete(state);
                
                // Redirect to frontend
                const redirectUrl = `http://192.168.20.10:555?auth=success&token=${sessionId}`;
                log('info', '🎯 OAUTH SUCCESS - Redirecting', { redirectUrl });
                
                sendRedirect(res, redirectUrl);
                return;
                
            } catch (error) {
                log('error', '❌ OAUTH ERROR', { error: error.message });
                
                const errorMessage = error.message || 'OAuth authentication failed';
                const redirectUrl = `http://192.168.20.10:555?auth=error&message=${encodeURIComponent(errorMessage)}`;
                
                sendRedirect(res, redirectUrl);
                return;
            }
        }

        // Get dashboard data
        if (pathname === '/api/v1/clickup/dashboard-data') {
            const authHeader = req.headers.authorization;
            const sessionId = authHeader?.replace('Bearer ', '');
            
            if (!sessionId || !clickupTokens.has(sessionId)) {
                sendJSON(res, 401, { success: false, error: 'Unauthorized' });
                return;
            }
            
            const tokenData = clickupTokens.get(sessionId);
            log('info', 'Dashboard data requested', { sessionId: sessionId.substring(0, 10) + '...' });
            
            try {
                // Get user info
                const userOptions = {
                    hostname: 'api.clickup.com',
                    path: '/api/v2/user',
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${tokenData.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                };
                
                const userResponse = await makeHTTPSRequest(userOptions);
                
                // Get teams
                const teamsOptions = {
                    hostname: 'api.clickup.com',
                    path: '/api/v2/team',
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${tokenData.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                };
                
                const teamsResponse = await makeHTTPSRequest(teamsOptions);
                
                const dashboardData = {
                    user: userResponse.data?.user || {},
                    teams: teamsResponse.data?.teams || [],
                    tasks: [],
                    workload: {
                        totalTasks: 0,
                        completedTasks: 0,
                        inProgressTasks: 0,
                        overdueTasks: 0,
                        completionRate: 0
                    },
                    employees: [],
                    timestamp: new Date().toISOString()
                };
                
                log('info', 'Dashboard data compiled', {
                    user: !!dashboardData.user,
                    teams: dashboardData.teams.length
                });
                
                sendJSON(res, 200, {
                    success: true,
                    data: dashboardData,
                    source: 'real_clickup_api_minimal'
                });
                return;
                
            } catch (error) {
                log('error', 'Dashboard data fetch failed', { error: error.message });
                sendJSON(res, 500, {
                    success: false,
                    error: 'Failed to fetch dashboard data',
                    details: error.message
                });
                return;
            }
        }

        // Auth status
        if (pathname === '/api/v1/auth/status') {
            const authHeader = req.headers.authorization;
            const sessionId = authHeader?.replace('Bearer ', '');
            const tokenData = clickupTokens.get(sessionId);
            
            sendJSON(res, 200, {
                authenticated: !!tokenData,
                session: sessionId ? 'valid' : 'invalid',
                user: tokenData?.user || null,
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Logout
        if (pathname === '/api/v1/auth/logout' && method === 'POST') {
            const authHeader = req.headers.authorization;
            const sessionId = authHeader?.replace('Bearer ', '');
            
            if (sessionId && clickupTokens.has(sessionId)) {
                clickupTokens.delete(sessionId);
                log('info', 'User logged out', { sessionId: sessionId.substring(0, 10) + '...' });
            }
            
            sendJSON(res, 200, {
                success: true,
                message: 'Logged out successfully'
            });
            return;
        }

        // Root path
        if (pathname === '/') {
            sendCORS(res);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <h1>🚀 TaskFlow Pro Backend - Minimal OAuth</h1>
                <p>✅ Server is running properly.</p>
                <p>📋 Version: 9.0.0-minimal-oauth</p>
                <p>🕐 Time: ${new Date().toISOString()}</p>
                <p>🔧 ClickUp OAuth Integration: Ready</p>
                <p>🌐 Frontend URL: <a href="http://192.168.20.10:555">http://192.168.20.10:555</a></p>
                <hr>
                <h3>🔐 OAuth Testing</h3>
                <p><a href="/api/v1/auth/clickup/auth-url">Get ClickUp Auth URL (JSON)</a></p>
                <p><a href="/api/v1/auth/clickup/authorize">Direct ClickUp OAuth Redirect</a></p>
                <hr>
                <h3>📊 System Status</h3>
                <p>Active Sessions: ${clickupTokens.size}</p>
                <p>OAuth States: ${sessionStorage.size}</p>
                <p>Redirect URI: ${CLICKUP_CONFIG.redirectUri}</p>
            `);
            return;
        }

        // 404
        sendJSON(res, 404, {
            success: false,
            error: 'Endpoint not found'
        });

    } catch (error) {
        log('error', 'Unhandled server error', { error: error.message });
        sendJSON(res, 500, {
            success: false,
            error: 'Internal server error'
        });
    }
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    log('info', '🚀 MINIMAL OAUTH SERVER STARTED', {
        port: PORT,
        clientId: CLICKUP_CONFIG.clientId,
        redirectUri: CLICKUP_CONFIG.redirectUri,
        time: new Date().toISOString()
    });
    
    console.log(`🚀 TaskFlow Pro Backend (Minimal OAuth) running on port ${PORT}`);
    console.log(`🔗 Health check: http://192.168.20.10:${PORT}/health`);
    console.log(`🔐 OAuth URL: http://192.168.20.10:${PORT}/api/v1/auth/clickup/authorize`);
    console.log(`🌐 Frontend: http://192.168.20.10:555`);
    console.log(`⚡ Ready for ClickUp OAuth integration (Minimal Mode)!`);
});

module.exports = server;