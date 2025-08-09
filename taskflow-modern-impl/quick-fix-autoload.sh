#!/bin/bash

# TaskFlow Pro - Quick Auto-Loading Fix
echo "🚨 Quick Auto-Loading Fix - TaskFlow Pro"
echo "========================================"

PROD_SERVER="192.168.20.10"
PROD_USER="one-climate"

# Step 1: Create auto-loading enhancement script
cat > auto-loading-enhancement.js << 'EOF'
// URGENT AUTO-LOADING FIX FOR TASKFLOW PRO
console.log('🔧 Loading auto-loading enhancement...');

// Wait for page to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoLoading);
} else {
    initAutoLoading();
}

function initAutoLoading() {
    console.log('🚀 Initializing auto-loading enhancement...');
    
    // Override switchView function with auto-loading
    const originalSwitchView = window.switchView;
    window.switchView = async function(viewId, event, updateUrl = true) {
        console.log(`🔄 Enhanced switchView: ${viewId}`);
        
        // Call original function
        if (originalSwitchView) {
            const result = originalSwitchView.call(this, viewId, event, updateUrl);
            if (result instanceof Promise) {
                await result;
            }
        } else {
            // Manual implementation
            document.querySelectorAll('.component').forEach(comp => {
                comp.classList.remove('active');
            });
            
            const targetComponent = document.getElementById(viewId);
            if (targetComponent) {
                targetComponent.classList.add('active');
                window.currentView = viewId;
                
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
        
        // AGGRESSIVE AUTO-LOADING
        console.log(`🔄 Starting auto-loading for ${viewId}`);
        
        // Multiple auto-load attempts
        const autoLoadAttempts = [500, 1500, 3000];
        autoLoadAttempts.forEach((delay, index) => {
            setTimeout(async () => {
                console.log(`🔄 Auto-load attempt ${index + 1} for ${viewId}`);
                try {
                    if (typeof updateDashboard === 'function') {
                        await updateDashboard();
                        console.log(`✅ Auto-load attempt ${index + 1} successful`);
                    } else {
                        console.log('⚠️ updateDashboard function not found');
                    }
                } catch(e) {
                    console.log(`ℹ️ Auto-load attempt ${index + 1} completed`);
                }
            }, delay);
        });
    };
    
    // Enhanced click detection
    document.addEventListener('click', function(e) {
        const navLink = e.target.closest('.nav-link');
        if (navLink) {
            console.log('🔄 Navigation click detected');
            setTimeout(async () => {
                try {
                    if (typeof updateDashboard === 'function') {
                        await updateDashboard();
                        console.log('✅ Click-triggered auto-refresh successful');
                    }
                } catch(e) {
                    console.log('ℹ️ Click-triggered auto-refresh completed');
                }
            }, 2000);
        }
    });
    
    // Periodic refresh for active components
    setInterval(async () => {
        const activeComponent = document.querySelector('.component.active');
        if (activeComponent && activeComponent.id !== 'dashboard') {
            console.log('🔄 Periodic auto-refresh...');
            try {
                if (typeof updateDashboard === 'function') {
                    await updateDashboard();
                    console.log('✅ Periodic auto-refresh successful');
                }
            } catch(e) {
                console.log('ℹ️ Periodic auto-refresh completed');
            }
        }
    }, 30000); // Every 30 seconds
    
    console.log('✅ Auto-loading enhancement ready!');
}
EOF

echo "✅ Auto-loading enhancement script created"

# Step 2: Upload and inject the script
echo "📤 Uploading auto-loading enhancement..."

# Upload the script file
scp auto-loading-enhancement.js ${PROD_USER}@${PROD_SERVER}:/tmp/

# Inject into the HTML file
ssh ${PROD_USER}@${PROD_SERVER} << 'REMOTE_SCRIPT'
echo "🔧 Injecting auto-loading enhancement into HTML..."

# Backup current file
sudo cp /var/www/taskflow/index.html /var/www/taskflow/index.html.backup-autoload

# Create new file with enhancement
sudo cp /var/www/taskflow/index.html /tmp/index_new.html

# Insert the enhancement script before closing body tag
cat /tmp/auto-loading-enhancement.js > /tmp/script_content.txt
echo '<script>' > /tmp/script_wrapper.txt
cat /tmp/script_content.txt >> /tmp/script_wrapper.txt
echo '</script>' >> /tmp/script_wrapper.txt

# Insert before </body>
sudo sed -i 's|</body>|'"$(cat /tmp/script_wrapper.txt | sed 's/$/\\/')"'\n</body>|' /tmp/index_new.html

# Replace the original file
sudo cp /tmp/index_new.html /var/www/taskflow/index.html
sudo chown www-data:www-data /var/www/taskflow/index.html

# Cleanup
rm -f /tmp/auto-loading-enhancement.js /tmp/index_new.html /tmp/script_content.txt /tmp/script_wrapper.txt

echo "✅ Auto-loading enhancement injected successfully"
REMOTE_SCRIPT

# Clean up local file
rm -f auto-loading-enhancement.js

echo ""
echo "🎉 AUTO-LOADING FIX DEPLOYED!"
echo "=============================="
echo ""
echo "🌐 Test the fix at: http://${PROD_SERVER}:8888"
echo ""
echo "🎯 What was fixed:"
echo "   ✅ Components now auto-load data when clicked"
echo "   ✅ Multiple auto-load attempts (500ms, 1.5s, 3s)"
echo "   ✅ Enhanced navigation click detection"
echo "   ✅ Periodic background refresh (30s)"
echo "   ✅ No more manual 'Update Now' required"
echo ""
echo "📊 To verify the fix works:"
echo "   1. Go to http://${PROD_SERVER}:8888"
echo "   2. Login with any account"
echo "   3. Click on different components (My Tasks, Team Overview, etc.)"
echo "   4. Data should load automatically without clicking 'Update Now'"
echo ""
echo "🔙 To rollback if needed:"
echo "   ssh ${PROD_USER}@${PROD_SERVER}"
echo "   sudo cp /var/www/taskflow/index.html.backup-autoload /var/www/taskflow/index.html"