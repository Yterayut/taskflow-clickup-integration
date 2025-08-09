// OAuth Loop Fix for Master User
// Add this to current_frontend.html after loadUserProfile function

// Enhanced OAuth detection and handling
async function handleMasterUserOAuth() {
    console.log('🔍 Checking master user OAuth requirements...');
    
    // Check if current user is master user
    if (currentUser && currentUser.email === 'yterayut@gmail.com') {
        console.log('👑 Master user detected - checking OAuth status');
        
        // Check if OAuth setup is required from backend
        if (currentUser.capabilities && currentUser.capabilities.canUseClickUpOAuth) {
            console.log('✅ Master user has OAuth capability - checking setup status');
            
            // Check if OAuth is already completed
            try {
                const oauthResponse = await fetch(`${API_BASE_URL}/api/v2/auth/oauth-status`, {
                    method: 'GET',
                    credentials: 'include'
                });
                
                if (oauthResponse.ok) {
                    const oauthData = await oauthResponse.json();
                    console.log('🔐 OAuth status:', oauthData);
                    
                    if (oauthData.requiresOAuth) {
                        console.log('🔄 OAuth setup required - redirecting to OAuth flow');
                        window.location.href = '/auth/clickup';
                        return true; // OAuth redirect initiated
                    } else {
                        console.log('✅ OAuth setup complete - loading dashboard');
                        return false; // No OAuth needed, continue normal flow
                    }
                }
            } catch (error) {
                console.error('❌ Error checking OAuth status:', error);
            }
        }
    }
    
    return false; // No OAuth handling needed
}

// Enhanced user profile loading with OAuth handling
async function loadUserProfileWithOAuth() {
    const profileLoaded = await loadUserProfile();
    
    if (profileLoaded) {
        // Check if master user needs OAuth setup
        const needsOAuth = await handleMasterUserOAuth();
        
        if (needsOAuth) {
            console.log('🔄 OAuth redirect initiated - stopping further processing');
            return false;
        }
        
        console.log('✅ User profile loaded and OAuth check complete');
        return true;
    }
    
    return false;
}

// Replace the original loadUserProfile calls with OAuth-aware version
console.log('🔧 Installing OAuth loop fix...');