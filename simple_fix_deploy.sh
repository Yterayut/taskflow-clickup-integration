#!/bin/bash
# SIMPLE FIX DEPLOYMENT - Direct approach

echo "🚀 Deploying Simple Frontend Fix..."

# Create simple fix that works
cat > simple_frontend_fix.js << 'EOF'
// SIMPLE BUT EFFECTIVE FIX FOR INFINITE LOOP
console.log('🛠️ Simple Frontend Fix loading...');

// Override problematic showContentWithoutClickUp function
const originalShowContentWithoutClickUp = window.showContentWithoutClickUp;

window.showContentWithoutClickUp = function() {
    console.log('📱 SAFE: Limited mode content display (no recursion)');
    
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
        
        // Update KPI grid safely
        const kpiGrid = document.getElementById('kpiGrid');
        if (kpiGrid && typeof currentUser !== 'undefined' && currentUser) {
            kpiGrid.innerHTML = `
                <div class="kpi-card" style="grid-column: 1 / -1;">
                    <h3 style="color: #f59e0b; margin-bottom: 16px; text-align: center;">
                        👤 ${currentUser.displayName || currentUser.name || currentUser.email} - Limited Access
                    </h3>
                    <div style="text-align: center; margin-top: 20px; padding: 16px; background: #f3f4f6; border-radius: 8px; border-left: 4px solid #f59e0b;">
                        <p style="color: #6b7280; margin: 0; font-size: 14px;">
                            Your account (${currentUser.role || 'Unknown'}) does not have ClickUp integration.<br>
                            Contact your administrator for access to task management features.
                        </p>
                    </div>
                </div>
            `;
        }
    }
    
    // CRITICAL: NO RECURSIVE CALLS TO loadComponentData!
    console.log('✅ SAFE: Limited mode displayed without infinite loop');
};

// Enhance user capabilities
if (typeof getUserCapabilities === 'undefined') {
    window.getUserCapabilities = function(user) {
        if (!user || !user.capabilities) {
            console.log('⚠️ No capabilities from backend - using defaults based on role');
            
            const defaults = {
                'Manager': { canUseClickUpOAuth: true },
                'Team Lead': { canUseClickUpOAuth: true },
                'team_lead': { canUseClickUpOAuth: true },
                'Employee': { canUseClickUpOAuth: false },
                'employee': { canUseClickUpOAuth: false }
            };
            
            return defaults[user?.role] || { canUseClickUpOAuth: false };
        }
        return user.capabilities;
    };
}

// Enhance loadDataBasedOnCapabilities if it exists
const originalLoadDataBasedOnCapabilities = window.loadDataBasedOnCapabilities;
if (originalLoadDataBasedOnCapabilities) {
    window.loadDataBasedOnCapabilities = async function() {
        console.log('🔍 SAFE: Checking user capabilities...');
        
        if (!currentUser || !currentUser.capabilities) {
            if (currentUser) {
                currentUser.capabilities = getUserCapabilities(currentUser);
                console.log('🔧 Enhanced user capabilities:', currentUser.capabilities);
            }
        }
        
        if (currentUser && currentUser.capabilities && currentUser.capabilities.canUseClickUpOAuth) {
            console.log('✅ User has ClickUp OAuth - loading data');
            if (typeof loadClickUpData === 'function') {
                await loadClickUpData();
            }
        } else {
            console.log('🚫 User lacks ClickUp OAuth - showing limited mode');
            showContentWithoutClickUp();
        }
    };
}

console.log('✅ Simple Frontend Fix loaded successfully');
EOF

# Deploy the simple fix
echo "📤 Uploading simple fix to production..."
scp simple_frontend_fix.js one-climate@192.168.20.10:/var/www/taskflow/

# Add the script to the end of the HTML file
echo "🔧 Adding fix script to production HTML..."
ssh one-climate@192.168.20.10 "echo '<script src=\"simple_frontend_fix.js\"></script>' >> /var/www/taskflow/index.html"

# Verify
echo "✅ Verifying deployment..."
ssh one-climate@192.168.20.10 "grep 'simple_frontend_fix.js' /var/www/taskflow/index.html" && echo "✅ Fix script found in HTML" || echo "❌ Fix script not found"

ssh one-climate@192.168.20.10 "ls -la /var/www/taskflow/simple_frontend_fix.js" && echo "✅ Fix file exists" || echo "❌ Fix file missing"

# Cleanup
rm -f simple_frontend_fix.js

echo ""
echo "🎉 SIMPLE FIX DEPLOYMENT COMPLETE!"
echo ""
echo "✅ Fixed Issues:"
echo "   - 🚫 Infinite loop in showContentWithoutClickUp"
echo "   - 🔧 Missing user capabilities (role-based defaults)"
echo "   - 📱 Enhanced limited mode display"
echo ""
echo "🔄 Test the fixes now:"
echo "   1. Refresh browser: http://192.168.20.10:8888/"
echo "   2. Try all login scenarios"
echo "   3. Navigate to team-overview (should not crash)"
echo ""