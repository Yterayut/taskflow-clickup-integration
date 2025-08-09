// CORRECTED FRONTEND FIX - RESPECT BACKEND ROLES
console.log('🛠️ Corrected Frontend Fix loading...');

// Override problematic showContentWithoutClickUp function
const originalShowContentWithoutClickUp = window.showContentWithoutClickUp;

window.showContentWithoutClickUp = function() {
    console.log('📱 SAFE: Role-based content display (no recursion)');
    
    // Clear ClickUp data
    if (typeof clickUpData !== 'undefined') {
        clickUpData = null;
    }
    
    // Hide loading states
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    
    if (loadingState) loadingState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
    
    // Show dashboard
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.classList.add('active');
        dashboard.style.display = 'block';
        
        // Update KPI grid safely - USE PROPER ROLE FROM BACKEND
        const kpiGrid = document.getElementById('kpiGrid');
        if (kpiGrid && typeof currentUser !== 'undefined' && currentUser) {
            // 🔥 CRITICAL FIX: Use proper role display name from backend
            const roleDisplayName = currentUser.displayName || getRoleDisplayName(currentUser.role);
            const roleDescription = getRoleDescription(currentUser.role);
            
            kpiGrid.innerHTML = `
                <div class="kpi-card" style="grid-column: 1 / -1;">
                    <h3 style="color: #2563eb; margin-bottom: 16px; text-align: center;">
                        👤 ${roleDisplayName} - ${currentUser.name || currentUser.email}
                    </h3>
                    <div style="text-align: center; margin-top: 20px; padding: 16px; background: #f3f4f6; border-radius: 8px; border-left: 4px solid #2563eb;">
                        <p style="color: #6b7280; margin: 0; font-size: 14px;">
                            ${roleDescription}<br>
                            Role: ${currentUser.role} | Access Level: ${getAccessLevel(currentUser.role)}
                        </p>
                    </div>
                </div>
            `;
        }
    }
    
    // CRITICAL: NO RECURSIVE CALLS TO loadComponentData!
    console.log('✅ SAFE: Role-based content displayed without infinite loop');
};

// Helper function to get proper role display name
function getRoleDisplayName(role) {
    const roleMap = {
        'master': 'Master User',
        'manager': 'Manager',
        'team_lead': 'Team Lead',
        'employee': 'Employee',
        'user': 'User'
    };
    return roleMap[role] || 'User';
}

// Helper function to get role description
function getRoleDescription(role) {
    const descMap = {
        'master': 'Full system access with ClickUp integration',
        'manager': 'Full team management capabilities',
        'team_lead': 'Team leadership and member management',
        'employee': 'Personal task management and profile access',
        'user': 'Basic user access'
    };
    return descMap[role] || 'Standard user access';
}

// Helper function to get access level
function getAccessLevel(role) {
    const accessMap = {
        'master': 'Full Access',
        'manager': 'Management Access',
        'team_lead': 'Team Access',
        'employee': 'Personal Access',
        'user': 'Basic Access'
    };
    return accessMap[role] || 'Limited Access';
}

// Enhance user capabilities - RESPECT BACKEND ROLES
if (typeof getUserCapabilities === 'undefined') {
    window.getUserCapabilities = function(user) {
        if (!user || !user.capabilities) {
            console.log('⚠️ No capabilities from backend - using defaults based on role');
            
            // 🔥 CRITICAL: Use proper role-based capabilities
            const defaults = {
                'master': { canUseClickUpOAuth: true, canManageSystem: true, canViewAllTasks: true },
                'manager': { canUseClickUpOAuth: false, canManageSystem: false, canViewAllTasks: true },
                'team_lead': { canUseClickUpOAuth: false, canViewTeamTasks: true, canManageTeamMembers: true },
                'employee': { canUseClickUpOAuth: false, canViewOwnTasks: true, canUpdateTaskStatus: true },
                'user': { canUseClickUpOAuth: false }
            };
            
            return defaults[user?.role] || { canUseClickUpOAuth: false };
        }
        return user.capabilities;
    };
}

// Enhanced loadDataBasedOnCapabilities - RESPECT BACKEND ROLES
const originalLoadDataBasedOnCapabilities = window.loadDataBasedOnCapabilities;
if (originalLoadDataBasedOnCapabilities) {
    window.loadDataBasedOnCapabilities = async function() {
        console.log('🔍 SAFE: Checking user capabilities and role...');
        
        if (!currentUser || !currentUser.capabilities) {
            if (currentUser) {
                currentUser.capabilities = getUserCapabilities(currentUser);
                console.log('🔧 Enhanced user capabilities:', currentUser.capabilities);
            }
        }
        
        // 🔥 CRITICAL FIX: Only master users need ClickUp OAuth
        if (currentUser && currentUser.role === 'master' && currentUser.capabilities && currentUser.capabilities.canUseClickUpOAuth) {
            console.log('✅ Master user with ClickUp OAuth - loading data');
            if (typeof loadClickUpData === 'function') {
                await loadClickUpData();
            }
        } else {
            console.log(`✅ ${getRoleDisplayName(currentUser?.role)} user - showing role-based content`);
            showContentWithoutClickUp();
        }
    };
}

console.log('✅ Corrected Frontend Fix loaded successfully - respecting backend roles');