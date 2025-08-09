// 🚨 EMERGENCY FIX: ClickUp Connection Error for Regular Users
// Date: 16 July 2025
// Issue: loadClickUpData() called for all users regardless of capabilities

console.log('🔧 ClickUp Connection Fix loading...');

// Enhanced loadClickUpData with capability checking
window.loadClickUpDataFixed = async function() {
    console.log('🔍 Enhanced loadClickUpData with capability checking...');
    
    // Check if user is authenticated and has current user data
    if (!window.currentUser) {
        console.log('❌ No current user - cannot load data');
        showLocalDataFallback();
        return;
    }
    
    console.log('👤 Current user:', window.currentUser.email, 'Role:', window.currentUser.role);
    console.log('🔑 Capabilities:', window.currentUser.capabilities);
    
    // CRITICAL CHECK: Only master users can use ClickUp OAuth
    if (window.currentUser.capabilities && window.currentUser.capabilities.canUseClickUpOAuth) {
        console.log('✅ User has ClickUp OAuth capability - loading ClickUp data');
        
        // Call original loadClickUpData for master users
        if (typeof loadClickUpDataOriginal === 'function') {
            await loadClickUpDataOriginal();
        } else {
            console.log('⚠️ Original loadClickUpData not available - using fallback');
            showLocalDataFallback();
        }
    } else {
        console.log('ℹ️ User does not have ClickUp OAuth capability - using local data');
        showLocalDataFallback();
    }
};

// Fallback data loading for regular users
window.showLocalDataFallback = function() {
    console.log('📊 Loading local/sample data for regular user...');
    
    // Hide loading state
    hideLoading();
    
    // Generate sample data based on user role
    const sampleData = generateSampleDataForUser(window.currentUser);
    
    // Update global variables with sample data
    window.clickUpData = sampleData;
    window.lastUpdated = new Date().toISOString();
    
    // Update UI with sample data
    updateLastUpdatedDisplay();
    
    // Load current view with sample data
    const currentView = getCurrentView();
    if (currentView) {
        console.log(`🔄 Refreshing current view: ${currentView} with sample data`);
        switchView(currentView, null, false);
    }
    
    console.log('✅ Local data loaded successfully');
};

// Generate appropriate sample data based on user role
window.generateSampleDataForUser = function(user) {
    const baseData = {
        user: {
            id: user.id || 1,
            username: user.name || user.email,
            email: user.email,
            role: user.role
        },
        team: {
            id: "local_team",
            name: "Local Team"
        },
        tasks: [],
        workspaces: [],
        spaces: []
    };
    
    // Role-based sample tasks
    switch (user.role.toLowerCase()) {
        case 'master':
        case 'manager':
            baseData.tasks = [
                {
                    id: "task_1",
                    name: "Sample Management Task",
                    status: { status: "in progress" },
                    assignees: [{ username: user.name }],
                    priority: { priority: "high" },
                    due_date: Date.now() + 86400000 // Tomorrow
                },
                {
                    id: "task_2", 
                    name: "Team Review Meeting",
                    status: { status: "to do" },
                    assignees: [{ username: user.name }],
                    priority: { priority: "normal" },
                    due_date: Date.now() + 172800000 // Day after tomorrow
                }
            ];
            break;
            
        case 'team_lead':
        case 'team lead':
            baseData.tasks = [
                {
                    id: "task_1",
                    name: "Team Coordination Task",
                    status: { status: "in progress" },
                    assignees: [{ username: user.name }],
                    priority: { priority: "high" },
                    due_date: Date.now() + 86400000
                }
            ];
            break;
            
        default: // employee
            baseData.tasks = [
                {
                    id: "task_1",
                    name: "My Personal Task",
                    status: { status: "to do" },
                    assignees: [{ username: user.name }],
                    priority: { priority: "normal" },
                    due_date: Date.now() + 86400000
                }
            ];
    }
    
    return baseData;
};

// Helper function to get current view
window.getCurrentView = function() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('view') || 'dashboard';
};

// Enhanced logout button fix
window.ensureLogoutButtonVisible = function() {
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.style.display = 'block';
        logoutButton.style.visibility = 'visible';
        console.log('✅ Logout button visibility ensured');
    } else {
        console.log('⚠️ Logout button not found in DOM');
    }
};

// Override original loadClickUpData function
window.addEventListener('DOMContentLoaded', function() {
    // Backup original function if it exists
    if (typeof loadClickUpData === 'function') {
        window.loadClickUpDataOriginal = loadClickUpData;
        console.log('💾 Original loadClickUpData function backed up');
    }
    
    // Replace with fixed version
    window.loadClickUpData = loadClickUpDataFixed;
    
    // Ensure logout button is visible
    setTimeout(ensureLogoutButtonVisible, 1000);
    
    console.log('✅ ClickUp Connection Fix applied successfully');
});

console.log('🔧 ClickUp Connection Fix loaded successfully');