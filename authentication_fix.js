// AUTHENTICATION FIX - CRITICAL SOLUTION FOR LIMITED ACCESS ISSUE
console.log('🔧 Authentication Fix loading...');

// Override the problematic default currentUser
if (typeof window !== 'undefined') {
    // Fix API URL
    window.API_BASE_URL = 'http://192.168.20.10:7812';
    
    // Get authentication token from cookies
    function getAuthToken() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'taskflow_token' || name === 'auth_token') {
                return decodeURIComponent(value);
            }
        }
        return null;
    }

    // Load user profile from backend authentication
    async function loadUserProfile() {
        console.log('🔄 Loading user profile from backend...');
        
        try {
            const response = await fetch(`${window.API_BASE_URL}/auth/status`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const statusData = await response.json();
                console.log('✅ User profile loaded:', statusData);
                
                // Update currentUser with backend data
                if (statusData.authenticated && statusData.user) {
                    const userData = statusData.user;
                    
                    // Map role to proper display name (use backend role directly)
                    const roleDisplayMap = {
                        'Manager': 'Manager',
                        'Team Lead': 'Team Lead',
                        'Employee': 'Employee'
                    };
                    
                    const userRole = roleDisplayMap[userData.role] || userData.role || 'Employee';
                    
                    window.currentUser = {
                        role: userRole,
                        name: userData.username || userData.email,
                        email: userData.email,
                        capabilities: getCapabilitiesForRole(userRole),
                        navigation: getNavigationForRole(userRole),
                        displayName: getDisplayNameForRole(userRole)
                    };
                    
                    console.log('👤 Current user set:', window.currentUser);
                    
                    // Update UI with real user data
                    updateUserDisplay();
                    
                    // Update navigation based on real role
                    renderNavigationForRole(window.currentUser.role, window.currentUser.capabilities);
                    
                    // Trigger the main navigation rendering function
                    if (typeof window.renderNavigation === 'function') {
                        window.renderNavigation();
                    }
                    
                    return true;
                }
            } else {
                console.error('❌ Failed to load user profile:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ Error loading user profile:', error);
            return false;
        }
    }

    // Helper functions for role mapping
    function getCapabilitiesForRole(role) {
        const capabilities = {
            'master': { canUseClickUpOAuth: true, canManageSystem: true, canViewAllTasks: true },
            'manager': { canUseClickUpOAuth: false, canManageSystem: false, canViewAllTasks: true },
            'team_lead': { canUseClickUpOAuth: false, canViewTeamTasks: true, canManageTeamMembers: true },
            'employee': { canUseClickUpOAuth: false, canViewOwnTasks: true, canUpdateTaskStatus: true }
        };
        return capabilities[role] || capabilities['employee'];
    }

    function getNavigationForRole(role) {
        const navigation = {
            'Manager': ['Dashboard', 'My Tasks', 'Team Overview', 'Employee Management', 'Team Ranking', 'Projects', 'Reports', 'Calendar', 'Settings'],
            'Team Lead': ['Dashboard', 'My Tasks', 'Team Overview', 'Team Members', 'Team Ranking', 'Projects', 'Calendar'],
            'Employee': ['Dashboard', 'My Tasks', 'My Profile', 'Knowledge Management']
        };
        return navigation[role] || navigation['Employee'];
    }

    function getDisplayNameForRole(role) {
        const displayNames = {
            'Manager': 'Manager',
            'Team Lead': 'Team Lead',
            'Employee': 'Employee'
        };
        return displayNames[role] || 'Employee';
    }

    // Update user display in UI
    function updateUserDisplay() {
        if (!window.currentUser) return;
        
        const userInfo = {
            name: window.currentUser.name || window.currentUser.email,
            role: window.currentUser.displayName || window.currentUser.role,
            initials: getInitials(window.currentUser.name || window.currentUser.email)
        };
        
        console.log('✅ User display updated:', userInfo);
        
        // Update user avatar initials
        const userInitials = document.getElementById('userInitials');
        if (userInitials && userInfo.initials) {
            userInitials.textContent = userInfo.initials;
        }
        
        // Update user menu info
        const userName = document.getElementById('userName');
        const userRole = document.getElementById('userRole');
        
        if (userName) {
            userName.textContent = userInfo.name;
        }
        
        if (userRole) {
            userRole.textContent = userInfo.role;
        }
        
        // Update any user display elements
        const userElements = document.querySelectorAll('[data-user-display]');
        userElements.forEach(element => {
            element.textContent = `${userInfo.name} - ${userInfo.role}`;
        });
    }

    // Get user initials
    function getInitials(name) {
        if (!name) return '👤';
        const words = name.split(' ');
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name[0].toUpperCase();
    }

    // Render navigation based on role
    function renderNavigationForRole(role, capabilities) {
        console.log('🧭 Rendering navigation for role:', role, 'capabilities:', capabilities);
        
        // Use backend navigation data if available
        if (window.currentUser && window.currentUser.navigation && window.currentUser.navigation.length > 0) {
            console.log('✅ Using backend navigation data:', window.currentUser.navigation);
            updateNavigationUI(window.currentUser.navigation);
        } else {
            console.log('⚠️ Backend navigation not available, using frontend fallback for role:', role);
            
            // Frontend fallback based on role
            const roleNavigation = {
                'master': [
                    'Dashboard', 'All Tasks', 'Team Overview', 'Analytics', 
                    'Employee Management', 'Team Ranking', 'Reports', 'Team Attendance', 'Settings'
                ],
                'manager': [
                    'Dashboard', 'All Tasks', 'Team Overview', 'Analytics', 
                    'Employee Management', 'Team Ranking', 'Reports', 'Team Attendance', 'Settings'
                ],
                'team_lead': [
                    'My Team Dashboard', 'My Team Members', 'Team Tasks', 'Team Analytics', 'Team Attendance'
                ],
                'employee': [
                    'My Dashboard', 'My Tasks', 'My Profile', 'Knowledge Management'
                ]
            };
            
            const navigation = roleNavigation[role] || roleNavigation['employee'];
            updateNavigationUI(navigation);
        }
        
        console.log('✅ Navigation rendered with', window.currentUser?.navigation?.length || 0, 'items for role:', role);
    }

    // Update navigation UI
    function updateNavigationUI(navigationItems) {
        const navMenu = document.getElementById('navMenu');
        if (!navMenu) return;
        
        navMenu.innerHTML = navigationItems.map(item => `
            <li class="nav-item">
                <a href="#" class="nav-link" onclick="switchView('${item.toLowerCase().replace(/\s+/g, '-')}')">
                    ${item}
                </a>
            </li>
        `).join('');
    }

    // Initialize authentication on page load
    async function initializeAuthentication() {
        console.log('🚀 Initializing authentication...');
        
        // Check if we're on login success page
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('login') === 'success') {
            console.log('✅ Regular login successful - loading user profile');
            await loadUserProfile();
        } else {
            // Try to load profile from existing session
            const profileLoaded = await loadUserProfile();
            if (!profileLoaded) {
                console.log('❌ No valid session - redirect to login');
                // Could redirect to login page here
            }
        }
    }

    // Enhanced loadDataBasedOnCapabilities function
    window.loadDataBasedOnCapabilities = async function() {
        console.log('🔍 SAFE: Checking user capabilities and role...');
        
        if (!window.currentUser || !window.currentUser.capabilities) {
            console.log('⚠️ No user capabilities loaded, attempting to load profile...');
            await loadUserProfile();
        }
        
        if (window.currentUser && window.currentUser.capabilities) {
            // Only master users need ClickUp OAuth
            if (window.currentUser.role === 'master' && window.currentUser.capabilities.canUseClickUpOAuth) {
                console.log('✅ Master user with ClickUp OAuth - loading ClickUp data');
                if (typeof loadClickUpData === 'function') {
                    await loadClickUpData();
                }
            } else {
                console.log(`✅ User ${window.currentUser.displayName || window.currentUser.role} - showing role-based content`);
                if (typeof showContentWithoutClickUp === 'function') {
                    showContentWithoutClickUp();
                }
            }
        }
    };

    // Start authentication when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAuthentication);
    } else {
        initializeAuthentication();
    }
}

console.log('✅ Authentication Fix loaded successfully');