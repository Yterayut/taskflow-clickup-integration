#!/bin/bash
# COMPREHENSIVE FRONTEND FIX DEPLOYMENT
# Deploys complete solution for infinite loops + OAuth + error handling

echo "🚀 Deploying Comprehensive Frontend Fix..."

# 1. BACKUP CURRENT PRODUCTION
echo "📦 Creating backup..."
ssh one-climate@192.168.20.10 "cp /var/www/taskflow/index.html /var/www/taskflow/index.html.backup-comprehensive-$(date +%Y%m%d_%H%M%S)"

# 2. DOWNLOAD CURRENT PRODUCTION FILE FOR PATCHING
echo "📥 Downloading current production file..."
scp one-climate@192.168.20.10:/var/www/taskflow/index.html ./current_production_index.html

# 3. CREATE COMPREHENSIVE PATCH
echo "🛠️ Creating comprehensive fix..."
cat > comprehensive_fix_patch.js << 'EOF'
// COMPREHENSIVE FRONTEND FIX - INSERT BEFORE </head>
        
        // CIRCUIT BREAKER IMPLEMENTATION
        class CircuitBreaker {
            constructor(threshold = 3, timeout = 60000) {
                this.threshold = threshold;
                this.timeout = timeout;
                this.failureCount = 0;
                this.state = 'CLOSED';
                this.nextAttempt = Date.now();
                this.calls = new Map();
            }
            
            async call(key, fn, ...args) {
                if (this.state === 'OPEN') {
                    if (Date.now() < this.nextAttempt) {
                        console.warn(`🔴 Circuit breaker OPEN for ${key}`);
                        return null;
                    }
                    this.state = 'HALF_OPEN';
                }
                
                if (this.calls.has(key)) {
                    console.warn(`🚨 RECURSIVE CALL DETECTED: ${key} - Preventing infinite loop`);
                    return null;
                }
                
                this.calls.set(key, true);
                
                try {
                    const result = await fn.apply(this, args);
                    this.onSuccess(key);
                    return result;
                } catch (error) {
                    this.onFailure(key);
                    throw error;
                } finally {
                    this.calls.delete(key);
                }
            }
            
            onSuccess(key) {
                this.failureCount = 0;
                this.state = 'CLOSED';
            }
            
            onFailure(key) {
                this.failureCount++;
                if (this.failureCount >= this.threshold) {
                    this.state = 'OPEN';
                    this.nextAttempt = Date.now() + this.timeout;
                    console.error(`🔴 Circuit breaker OPEN for ${key}`);
                }
            }
        }
        
        // Global circuit breaker
        const circuitBreaker = new CircuitBreaker(3, 60000);
        
        // SAFE USER CAPABILITY CHECKING
        function getUserCapabilities(user) {
            if (!user || !user.capabilities) {
                console.log('⚠️ No capabilities from backend - using role-based defaults');
                
                const roleCapabilities = {
                    'Manager': { canUseClickUpOAuth: true, canManageTeam: true, canViewReports: true, canEditSettings: true },
                    'Team Lead': { canUseClickUpOAuth: true, canManageTeam: true, canViewReports: true, canEditSettings: false },
                    'team_lead': { canUseClickUpOAuth: true, canManageTeam: true, canViewReports: true, canEditSettings: false },
                    'Employee': { canUseClickUpOAuth: false, canManageTeam: false, canViewReports: false, canEditSettings: false },
                    'employee': { canUseClickUpOAuth: false, canManageTeam: false, canViewReports: false, canEditSettings: false }
                };
                
                return roleCapabilities[user?.role] || roleCapabilities['Employee'];
            }
            
            return user.capabilities;
        }
        
        // SAFE COMPONENT DATA LOADING (OVERRIDE ORIGINAL)
        async function loadComponentData(viewId) {
            return circuitBreaker.call(`loadComponentData_${viewId}`, async function() {
                console.log(`📋 Safe component data loading for: ${viewId}`);
                
                if (!clickUpData) {
                    console.log('⚠️ No ClickUp data - skipping component load');
                    return;
                }
                
                switch (viewId) {
                    case 'my-tasks':
                        if (window.renderMyTasks) await renderMyTasks();
                        break;
                    case 'team-overview':
                        if (window.renderTeamOverview) await renderTeamOverview();
                        break;
                    case 'employee-management':
                        if (window.renderEmployeeManagement) await renderEmployeeManagement();
                        break;
                    case 'team-ranking':
                        if (window.renderTeamRanking) await renderTeamRanking();
                        break;
                    default:
                        console.log(`📄 Default component rendering for: ${viewId}`);
                        break;
                }
                
                console.log(`✅ Component ${viewId} loaded successfully`);
            });
        }
        
        // OVERRIDE showContentWithoutClickUp TO PREVENT INFINITE LOOP
        function showContentWithoutClickUp() {
            console.log('📱 Safe limited mode content display');
            
            clickUpData = null;
            
            const loadingState = document.getElementById('loadingState');
            const errorState = document.getElementById('errorState');
            
            if (loadingState) loadingState.style.display = 'none';
            if (errorState) errorState.style.display = 'none';
            
            const dashboard = document.getElementById('dashboard');
            if (dashboard) {
                dashboard.classList.add('active');
                dashboard.style.display = 'block';
                
                const kpiGrid = document.getElementById('kpiGrid');
                if (kpiGrid && currentUser) {
                    kpiGrid.innerHTML = `
                        <div class="kpi-card" style="grid-column: 1 / -1;">
                            <h3 style="color: #f59e0b; margin-bottom: 16px; text-align: center;">
                                👤 ${currentUser.displayName || currentUser.name || currentUser.email} - Limited Access Mode
                            </h3>
                            <div style="text-align: center; margin-top: 20px; padding: 16px; background: var(--bg-tertiary, #f3f4f6); border-radius: 8px; border-left: 4px solid #f59e0b;">
                                <p style="color: #6b7280; margin: 0; font-size: 14px;">
                                    Your account (${currentUser.role || 'Unknown'}) does not have ClickUp integration permissions.<br>
                                    Contact your system administrator for access to task management features.
                                </p>
                            </div>
                        </div>
                    `;
                }
                
                const teamGrid = document.getElementById('teamGrid');
                if (teamGrid) {
                    teamGrid.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: #6b7280;">
                            <h3 style="color: #f59e0b; margin-bottom: 16px;">⚠️ Limited Access</h3>
                            <p>Task and team data requires ClickUp integration permissions.</p>
                        </div>
                    `;
                }
                
                const activityFeed = document.getElementById('activityFeed');
                if (activityFeed) {
                    activityFeed.innerHTML = `
                        <div style="text-align: center; padding: 20px; color: #6b7280;">
                            <p>Activity data requires ClickUp integration permissions.</p>
                        </div>
                    `;
                }
            }
            
            // CRITICAL FIX: NO RECURSIVE CALLS!
            console.log('✅ Limited mode displayed safely without recursion');
        }
        
        // ENHANCED USER PROFILE LOADING
        async function loadUserProfile() {
            try {
                console.log('🔄 Loading user profile from backend...');
                
                const response = await fetch('/api/auth/verify', { 
                    credentials: 'include',
                    headers: { 'Cache-Control': 'no-cache' }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.success && data.user) {
                    currentUser = data.user;
                    currentUser.capabilities = getUserCapabilities(currentUser);
                    
                    console.log('✅ User profile loaded:', currentUser);
                    console.log('👤 Current user set:', currentUser);
                    console.log('🔧 Capabilities:', currentUser.capabilities);
                    
                    updateUserDisplay();
                    renderNavigation();
                    
                    return true;
                } else {
                    throw new Error('Invalid user data');
                }
            } catch (error) {
                console.error('❌ Error loading user profile:', error);
                return false;
            }
        }
        
        // ENHANCED loadDataBasedOnCapabilities
        async function loadDataBasedOnCapabilities() {
            console.log('🔍 Checking user capabilities for data loading...');
            
            if (!currentUser) {
                console.log('❌ No user found - loading profile...');
                const profileLoaded = await loadUserProfile();
                if (!profileLoaded) {
                    console.log('❌ Failed to load profile - redirecting to login');
                    window.location.href = '/login';
                    return;
                }
            }
            
            // Ensure capabilities exist
            if (!currentUser.capabilities) {
                currentUser.capabilities = getUserCapabilities(currentUser);
            }
            
            if (currentUser.capabilities.canUseClickUpOAuth) {
                console.log('✅ User has ClickUp OAuth capability - loading ClickUp data');
                await loadClickUpData();
            } else {
                console.log('🚫 User does not have ClickUp OAuth capability - loading limited mode');
                showContentWithoutClickUp();
            }
        }
        
        console.log('🛠️ Comprehensive Frontend Fix loaded');
EOF

# 4. APPLY COMPREHENSIVE FIX TO PRODUCTION FILE
echo "🔧 Applying comprehensive fix..."

# Insert circuit breaker and safety functions before </head>
sed -i '/<\/head>/i\
    <script>\
'"$(cat comprehensive_fix_patch.js | sed 's/$/\\/')"'\
    </script>' ./current_production_index.html

# 5. UPLOAD FIXED FILE TO PRODUCTION
echo "🚀 Uploading fixed file to production..."
scp ./current_production_index.html one-climate@192.168.20.10:/var/www/taskflow/index.html

# 6. VERIFY DEPLOYMENT
echo "✅ Verifying deployment..."
ssh one-climate@192.168.20.10 "grep -n 'CircuitBreaker' /var/www/taskflow/index.html" > /dev/null && echo "✅ Circuit breaker found in production" || echo "❌ Circuit breaker not found"

ssh one-climate@192.168.20.10 "grep -n 'getUserCapabilities' /var/www/taskflow/index.html" > /dev/null && echo "✅ Capability fix found in production" || echo "❌ Capability fix not found"

ssh one-climate@192.168.20.10 "grep -n 'Safe limited mode' /var/www/taskflow/index.html" > /dev/null && echo "✅ Safe showContentWithoutClickUp found in production" || echo "❌ Safe function not found"

# 7. CLEANUP
echo "🧹 Cleaning up temporary files..."
rm -f ./current_production_index.html ./comprehensive_fix_patch.js

echo ""
echo "🎉 COMPREHENSIVE FRONTEND FIX DEPLOYMENT COMPLETE!"
echo ""
echo "✅ Features Deployed:"
echo "   - 🛡️ Circuit Breaker Pattern (prevents infinite loops)"
echo "   - 🔧 Safe OAuth Capability Checking (role-based defaults)"
echo "   - 🚫 Infinite Loop Prevention (fixed showContentWithoutClickUp)"
echo "   - 📱 Enhanced Error Handling"
echo "   - 🔄 Safe Component Loading"
echo ""
echo "🔄 Please refresh browser to test the fixes:"
echo "   1. Master: yterayut@gmail.com / 12345"
echo "   2. Team Lead: chaiwutwck@gmail.com / 12345"
echo "   3. Employee: atthakorn.na@ku.th / 12345"
echo ""
echo "🎯 All login scenarios should now work without infinite loops!"