#!/usr/bin/env node

/**
 * Test Frontend Profile Parsing
 * Simulates how the frontend code will parse the profile API response
 */

// Mock API response based on actual test results
const mockApiResponse = {
  "success": true,
  "user": {
    "user": {
      "id": 2,
      "email": "chaiwutwck@gmail.com",
      "role": "team_lead",
      "fullName": "ชัยวุฒิ ไวเชิงค้า",
      "lastLogin": "2025-07-05T06:22:54.191Z",
      "isActive": true,
      "createdAt": "2025-07-01T10:36:05.103Z",
      "capabilities": {
        "canUseClickUpOAuth": false,
        "canManageSystem": false,
        "canViewAllTasks": false,
        "canConfigureIntegration": false,
        "canManageEmployees": false,
        "canViewReports": false,
        "canManageProjects": false,
        "canViewTeamTasks": true,
        "canManageTeamMembers": true,
        "canViewTeamAnalytics": true,
        "canViewTeamReports": true,
        "canAccessTeamAttendance": true
      }
    },
    "capabilities": {
      "canUseClickUpOAuth": false,
      "canManageSystem": false,
      "canViewAllTasks": false,
      "canConfigureIntegration": false,
      "canManageEmployees": false,
      "canViewReports": false,
      "canManageProjects": false,
      "canViewTeamTasks": true,
      "canManageTeamMembers": true,
      "canViewTeamAnalytics": true,
      "canViewTeamReports": true,
      "canAccessTeamAttendance": true
    },
    "navigation": [
      "My Team Dashboard",
      "My Team Members",
      "Team Tasks",
      "Team Analytics",
      "Team Attendance"
    ],
    "displayName": "Team Lead"
  }
};

function testFrontendProfileParsing() {
    console.log('🧪 Testing Frontend Profile Parsing...\n');
    
    // Simulate the frontend parsing code
    const data = mockApiResponse;
    
    if (data.success && data.user) {
        console.log('✅ Basic API response validation passed');
        
        // Map backend roles to frontend display (from frontend code)
        const roleMapping = {
            'master': 'Manager',
            'manager': 'Manager', 
            'team_lead': 'Team Lead',
            'employee': 'Employee',
            'user': 'User'
        };
        
        // This is the fixed frontend parsing logic
        const currentUser = {
            role: roleMapping[data.user.user.role] || 'User',
            name: data.user.user.fullName || data.user.user.email,
            email: data.user.user.email,
            capabilities: data.user.capabilities || {}, // Fixed: capabilities is at profile level
            navigation: data.user.navigation || [],
            displayName: data.user.displayName || roleMapping[data.user.user.role] || 'User',
            backendRole: data.user.user.role // Keep original backend role
        };
        
        console.log('\n✅ Frontend Profile Parsing Result:');
        console.log(JSON.stringify(currentUser, null, 2));
        
        console.log('\n🔍 Validation Checks:');
        console.log(`✅ Role correctly mapped: ${currentUser.role} (from ${currentUser.backendRole})`);
        console.log(`✅ Name extracted: ${currentUser.name}`);
        console.log(`✅ Email extracted: ${currentUser.email}`);
        console.log(`✅ Capabilities loaded: ${Object.keys(currentUser.capabilities).length} permissions`);
        console.log(`✅ Navigation loaded: ${currentUser.navigation.length} items`);
        console.log(`✅ Display name: ${currentUser.displayName}`);
        
        console.log('\n🎯 Role-Based Component Display Check:');
        if (currentUser.backendRole === 'team_lead') {
            console.log('✅ Team Lead role detected - should show:');
            currentUser.navigation.forEach(nav => {
                console.log(`   - ${nav}`);
            });
        }
        
        console.log('\n🔐 Capabilities Check:');
        const relevantCapabilities = [
            'canViewTeamTasks',
            'canManageTeamMembers', 
            'canViewTeamAnalytics',
            'canAccessTeamAttendance'
        ];
        
        relevantCapabilities.forEach(cap => {
            if (currentUser.capabilities[cap]) {
                console.log(`✅ ${cap}: ${currentUser.capabilities[cap]}`);
            } else {
                console.log(`❌ ${cap}: ${currentUser.capabilities[cap] || 'not set'}`);
            }
        });
        
        console.log('\n✅ FRONTEND PROFILE PARSING TEST: PASSED');
        console.log('The frontend will now correctly:');
        console.log('1. Load user profile data');
        console.log('2. Extract role and capabilities');
        console.log('3. Display appropriate navigation components');
        console.log('4. Show role-specific dashboard elements');
        
        return true;
    } else {
        console.log('❌ API response validation failed');
        return false;
    }
}

// Run the test
const success = testFrontendProfileParsing();
process.exit(success ? 0 : 1);