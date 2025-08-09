// Fix login success handling - remove token dependency
if (response.ok && data.success) {
    console.log('Login successful:', data);
    
    // Store user info (no token needed for session-based auth)
    if (data.user) {
        localStorage.setItem('taskflow-user', JSON.stringify(data.user));
        localStorage.setItem('taskflow-user-role', data.user.role);
        localStorage.setItem('taskflow-authenticated', 'true');
    }
    
    // Store ClickUp connection status  
    localStorage.setItem('taskflow-clickup-connected', 'true');
    
    // Show success message briefly
    showSuccess('Login successful! Redirecting...');
    
    // Redirect to dashboard after short delay
    setTimeout(() => {
        window.location.href = 'http://192.168.20.10:8888/?login=success';
    }, 1000);
}

// Fix auth check - use session cookies instead of token
async function checkAuthStatus() {
    try {
        const response = await fetch('http://192.168.20.10:7812/api/v2/auth/verify', {
            method: 'GET',
            credentials: 'include', // Use session cookies
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.authenticated) {
                // Update stored user data
                localStorage.setItem('taskflow-user', JSON.stringify(data.user));
                localStorage.setItem('taskflow-user-role', data.user.role);
                localStorage.setItem('taskflow-clickup-connected', data.clickupConnected || 'false');
                localStorage.setItem('taskflow-authenticated', 'true');
                return true;
            }
        }
        
        // Session is invalid, clear stored data
        localStorage.removeItem('taskflow-user');
        localStorage.removeItem('taskflow-user-role');
        localStorage.removeItem('taskflow-clickup-connected');
        localStorage.removeItem('taskflow-authenticated');
        return false;
        
    } catch (error) {
        console.error('Auth check error:', error);
        // Clear stored data on error
        localStorage.removeItem('taskflow-user');
        localStorage.removeItem('taskflow-user-role');
        localStorage.removeItem('taskflow-clickup-connected');
        localStorage.removeItem('taskflow-authenticated');
        return false;
    }
}