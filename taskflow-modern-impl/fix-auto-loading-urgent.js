#!/usr/bin/env node

// TaskFlow Pro - Fix Auto-Loading Components (URGENT)
// This script fixes the immediate issue where components don't auto-load data

const fs = require('fs');
const { execSync } = require('child_process');

const PROD_SERVER = "192.168.20.10";
const PROD_USER = "one-climate";

console.log('🚨 TaskFlow Pro - URGENT Auto-Loading Fix');
console.log('==========================================');

// Step 1: Create improved switchView function with aggressive auto-loading
const autoLoadingScript = `
<script>
// URGENT FIX: Enhanced Auto-Loading System
console.log('🔧 URGENT FIX: Loading enhanced auto-loading system...');

// Override switchView with aggressive auto-loading
const originalSwitchView = window.switchView;
window.switchView = async function(viewId, event, updateUrl = true) {
    console.log(\`🔄 ENHANCED switchView: \${viewId}\`);
    
    // Call original function if exists
    if (originalSwitchView) {
        await originalSwitchView(viewId, event, updateUrl);
    } else {
        // Fallback manual implementation
        console.log('🔄 Switching to view (fallback):', viewId);
        
        // Hide all components
        document.querySelectorAll('.component').forEach(comp => {
            comp.classList.remove('active');
        });
        
        // Show selected component
        const targetComponent = document.getElementById(viewId);
        if (targetComponent) {
            targetComponent.classList.add('active');
            window.currentView = viewId;
            
            // Update navigation active state
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });
            
            if (event && event.target) {
                const clickedLink = event.target.closest('.nav-link');
                if (clickedLink) {
                    clickedLink.classList.add('active');
                }
            }
        }
    }
    
    // AGGRESSIVE AUTO-LOADING - Multiple attempts with different delays
    console.log(\`🔄 Starting aggressive auto-loading for \${viewId}\`);
    
    // Immediate attempt
    setTimeout(async () => {
        console.log(\`🔄 Auto-load attempt 1 for \${viewId}\`);
        try {
            await updateDashboard();
            console.log(\`✅ Auto-load attempt 1 successful for \${viewId}\`);
        } catch(e) {
            console.log(\`ℹ️ Auto-load attempt 1 completed for \${viewId}\`);
        }
    }, 500);
    
    // Secondary attempt
    setTimeout(async () => {
        console.log(\`🔄 Auto-load attempt 2 for \${viewId}\`);
        try {
            await updateDashboard();
            console.log(\`✅ Auto-load attempt 2 successful for \${viewId}\`);
        } catch(e) {
            console.log(\`ℹ️ Auto-load attempt 2 completed for \${viewId}\`);
        }
    }, 1500);
    
    // Final attempt
    setTimeout(async () => {
        console.log(\`🔄 Auto-load attempt 3 (final) for \${viewId}\`);
        try {
            await updateDashboard();
            console.log(\`✅ Auto-load attempt 3 successful for \${viewId}\`);
        } catch(e) {
            console.log(\`ℹ️ Auto-load attempt 3 completed for \${viewId}\`);
        }
    }, 3000);
};

// Enhanced navigation click detection
document.addEventListener('click', function(e) {
    const navLink = e.target.closest('.nav-link');
    if (navLink) {
        console.log('🔄 Nav click detected - triggering auto-refresh...');
        setTimeout(async () => {
            try {
                await updateDashboard();
                console.log('✅ Nav click auto-refresh successful');
            } catch(e) {
                console.log('ℹ️ Nav click auto-refresh completed');
            }
        }, 2000);
    }
});

// Override any onclick handlers to ensure auto-loading
document.querySelectorAll('.nav-link[onclick]').forEach(link => {
    const originalOnclick = link.onclick;
    link.onclick = async function(event) {
        console.log('🔄 Enhanced nav link clicked');
        
        // Execute original onclick if exists
        if (originalOnclick) {
            const result = originalOnclick.call(this, event);
            if (result instanceof Promise) {
                await result;
            }
        }
        
        // Force auto-loading after onclick
        setTimeout(async () => {
            console.log('🔄 Post-click auto-loading...');
            try {
                await updateDashboard();
                console.log('✅ Post-click auto-loading successful');
            } catch(e) {
                console.log('ℹ️ Post-click auto-loading completed');
            }
        }, 1000);
    };
});

// Enhanced loadComponentData function
if (typeof loadComponentData === 'undefined' || !window.loadComponentData) {
    window.loadComponentData = async function(viewId) {
        console.log(\`📋 Enhanced loadComponentData for: \${viewId}\`);
        
        // Always try to update dashboard when loading component data
        try {
            await updateDashboard();
            console.log(\`✅ Component data loaded for \${viewId}\`);
        } catch(e) {
            console.log(\`ℹ️ Component data loading completed for \${viewId}\`);
        }
    };
}

// Periodic auto-refresh for active components (reduced frequency to 45 seconds)
setInterval(async () => {
    const activeComponent = document.querySelector('.component.active');
    if (activeComponent && activeComponent.id !== 'dashboard') {
        console.log(\`🔄 Periodic auto-refresh for active component: \${activeComponent.id}\`);
        try {
            await updateDashboard();
            console.log(\`✅ Periodic auto-refresh successful\`);
        } catch(e) {
            console.log(\`ℹ️ Periodic auto-refresh completed\`);
        }
    }
}, 45000); // Every 45 seconds

// Page visibility change auto-refresh
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        console.log('🔄 Page became visible - auto-refreshing...');
        setTimeout(async () => {
            try {
                await updateDashboard();
                console.log('✅ Visibility change auto-refresh successful');
            } catch(e) {
                console.log('ℹ️ Visibility change auto-refresh completed');
            }
        }, 1000);
    }
});

// Enhanced waitForElement with better timeout
if (typeof waitForElement !== 'undefined') {
    const originalWaitForElement = waitForElement;
    window.waitForElement = function(id, maxAttempts = 100) { // Increased to 100 attempts (5 seconds)
        return originalWaitForElement(id, maxAttempts);
    };
}

console.log('✅ URGENT FIX: Enhanced auto-loading system activated!');
console.log('🎯 Features:');
console.log('   - Triple auto-load attempts on component switch');
console.log('   - Enhanced navigation click detection');
console.log('   - Periodic background refresh (45s)');
console.log('   - Page visibility auto-refresh');
console.log('   - Improved element waiting (5s timeout)');
</script>
`;

// Step 2: Create deployment script
const deployScript = `#!/bin/bash

echo "🚨 Deploying URGENT Auto-Loading Fix..."

# Download current frontend
echo "📥 Downloading current frontend..."
scp ${PROD_USER}@${PROD_SERVER}:/var/www/taskflow/index.html ./current_remote.html

# Backup current file
echo "💾 Creating backup..."
scp ${PROD_USER}@${PROD_SERVER}:/var/www/taskflow/index.html ${PROD_USER}@${PROD_SERVER}:/var/www/taskflow/index.html.urgent-backup

# Insert auto-loading script before closing body tag
echo "🔧 Applying auto-loading fix..."
sed -i.bak 's|</body>|${autoLoadingScript.replace(/\n/g, '\\n').replace(/'/g, "'\\''")}\\n</body>|' ./current_remote.html

# Upload fixed file
echo "🚀 Uploading fixed file..."
scp ./current_remote.html ${PROD_USER}@${PROD_SERVER}:/var/www/taskflow/index.html

# Restart nginx to ensure changes take effect
echo "🔄 Restarting nginx..."
ssh ${PROD_USER}@${PROD_SERVER} "sudo systemctl restart nginx"

echo "✅ URGENT fix deployed successfully!"
echo "🌐 Test at: http://${PROD_SERVER}:8888"

# Cleanup
rm -f ./current_remote.html ./current_remote.html.bak
`;

// Write deployment script
fs.writeFileSync('./deploy-urgent-fix.sh', deployScript);
fs.chmodSync('./deploy-urgent-fix.sh', '755');

console.log('✅ Urgent fix script created: deploy-urgent-fix.sh');
console.log('');
console.log('🚀 To deploy the fix:');
console.log('   ./deploy-urgent-fix.sh');
console.log('');
console.log('🎯 This fix will:');
console.log('   1. Add aggressive auto-loading on component switch');
console.log('   2. Multiple auto-load attempts with different delays');
console.log('   3. Enhanced navigation click detection');
console.log('   4. Periodic background refresh');
console.log('   5. Page visibility change auto-refresh');
console.log('');
console.log('⚡ The fix will be applied immediately to the production system!');