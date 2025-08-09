// Auth verification endpoint to fix login loop
// Add this after the /api/v2/auth/profile route

// Verify authentication status
app.get('/api/v2/auth/verify', (req, res) => {
    const userId = req.session.userId;
    
    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'Not authenticated'
        });
    }
    
    // Check OAuth user
    if (userTokens.has(userId)) {
        const tokenData = userTokens.get(userId);
        return res.json({
            success: true,
            authenticated: true,
            user: tokenData.user_data,
            auth_type: 'oauth',
            clickupConnected: true
        });
    }
    
    // Check regular user session
    if (userSessions.has(userId)) {
        const sessionData = userSessions.get(userId);
        return res.json({
            success: true,
            authenticated: true,
            user: sessionData.user_data,
            auth_type: sessionData.auth_type || 'password',
            clickupConnected: sessionData.background_sync_enabled || false
        });
    }
    
    // Session exists but no user data found
    console.log(`[${new Date().toISOString()}] Auth verify failed for session userId: ${userId}`);
    return res.status(401).json({
        success: false,
        authenticated: false,
        message: 'Session expired or invalid'
    });
});