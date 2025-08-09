/**
 * Navigation Fix Validation Test
 * Tests the navigation mapping between backend and frontend
 */

// Test data that matches what the backend returns
const testUsers = {
    teamLead: {
        navigation: ["My Team Dashboard", "My Team Members", "Team Tasks", "Team Analytics", "Team Attendance"],
        role: "team_lead"
    },
    employee: {
        navigation: ["My Dashboard", "My Tasks", "My Profile", "Knowledge Management"],
        role: "employee"
    },
    manager: {
        navigation: ["Dashboard", "All Tasks", "Team Overview", "Team Analytics", "Employee Management", "Team Ranking", "Reports", "Team Attendance", "System Settings"],
        role: "master"
    }
};

// Navigation mapping function (same as in frontend)
function createNavigationItem(navLabel, role) {
    const navMapping = {
        // Master/Manager navigation
        'Dashboard': { id: 'dashboard', icon: '📊' },
        'All Tasks': { id: 'my-tasks', icon: '📋' },
        'Team Overview': { id: 'team-overview', icon: '👥' },
        'Team Analytics': { id: 'team-analytics', icon: '📈' },
        'Employee Management': { id: 'employee-management', icon: '👨‍💼' },
        'Team Ranking': { id: 'team-ranking', icon: '🏆' },
        'Reports': { id: 'reports', icon: '📊' },
        'Team Attendance': { id: 'team-attendance', icon: '📅' },
        'System Settings': { id: 'settings', icon: '⚙️' },
        
        // Team Lead navigation
        'My Team Dashboard': { id: 'dashboard', icon: '📊' },
        'My Team Members': { id: 'team-overview', icon: '👥' },
        'Team Tasks': { id: 'my-tasks', icon: '📋' },
        
        // Employee navigation
        'My Dashboard': { id: 'dashboard', icon: '📊' },
        'My Tasks': { id: 'my-tasks', icon: '📋' },
        'My Profile': { id: 'employee-profile', icon: '👤' },
        'Knowledge Management': { id: 'knowledge-management', icon: '📚' }
    };
    
    const mapping = navMapping[navLabel];
    if (mapping) {
        return {
            id: mapping.id,
            label: navLabel,
            icon: mapping.icon
        };
    } else {
        console.warn('⚠️ No mapping found for navigation item:', navLabel);
        return {
            id: navLabel.toLowerCase().replace(/\s+/g, '-'),
            label: navLabel,
            icon: '📄'
        };
    }
}

// Test function
function testNavigationMapping() {
    console.log('🧪 Testing Navigation Mapping Fix...\n');
    
    Object.entries(testUsers).forEach(([userType, userData]) => {
        console.log(`\n📋 Testing ${userType.toUpperCase()} (${userData.role}):`);
        console.log('Backend Navigation:', userData.navigation);
        
        const frontendNav = userData.navigation.map(navItem => 
            createNavigationItem(navItem, userData.role)
        );
        
        console.log('Frontend Navigation:');
        frontendNav.forEach(item => {
            console.log(`  - ${item.icon} ${item.label} (id: ${item.id})`);
        });
        
        // Validate all items have proper mapping
        const unmappedItems = frontendNav.filter(item => item.icon === '📄');
        if (unmappedItems.length > 0) {
            console.error('❌ Unmapped items found:', unmappedItems.map(item => item.label));
        } else {
            console.log('✅ All navigation items properly mapped');
        }
    });
    
    console.log('\n🎯 Navigation Fix Validation Complete!');
}

// Run the test
testNavigationMapping();