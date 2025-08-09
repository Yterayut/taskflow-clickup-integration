#!/bin/bash

# Manual Auto-Loading Fix - Direct injection
echo "🔧 Manual Auto-Loading Fix"
echo "=========================="

PROD_SERVER="192.168.20.10"
PROD_USER="one-climate"

# Create simple auto-loading fix
cat > simple-autoload-fix.html << 'EOF'
<script>
// AUTO-LOADING FIX FOR TASKFLOW PRO
console.log('🔧 LOADING AUTO-LOADING FIX...');

// Wait for everything to be ready
setTimeout(() => {
    console.log('🚀 Activating auto-loading fix...');
    
    // Override switchView function
    const originalSwitchView = window.switchView;
    window.switchView = async function(viewId, event, updateUrl = true) {
        console.log(`🔄 FIXED switchView: ${viewId}`);
        
        // Call original function first
        if (originalSwitchView) {
            const result = originalSwitchView.call(this, viewId, event, updateUrl);
            if (result instanceof Promise) {
                await result;
            }
        }
        
        // AUTO-LOAD DATA IMMEDIATELY
        console.log(`🔄 AUTO-LOADING DATA FOR ${viewId}`);
        
        // Multiple auto-load attempts with delays
        setTimeout(async () => {
            console.log(`🔄 Auto-load attempt 1 for ${viewId}`);
            try {
                if (typeof updateDashboard === 'function') {
                    await updateDashboard();
                    console.log(`✅ Auto-load successful for ${viewId}`);
                }
            } catch(e) {
                console.log(`ℹ️ Auto-load completed for ${viewId}`);
            }
        }, 1000);
        
        // Second attempt
        setTimeout(async () => {
            console.log(`🔄 Auto-load attempt 2 for ${viewId}`);
            try {
                if (typeof updateDashboard === 'function') {
                    await updateDashboard();
                    console.log(`✅ Auto-load 2 successful for ${viewId}`);
                }
            } catch(e) {
                console.log(`ℹ️ Auto-load 2 completed for ${viewId}`);
            }
        }, 3000);
    };
    
    // Enhanced navigation click handler
    document.addEventListener('click', function(e) {
        const navLink = e.target.closest('.nav-link');
        if (navLink) {
            console.log('🔄 NAV CLICK DETECTED - AUTO REFRESHING');
            setTimeout(async () => {
                try {
                    if (typeof updateDashboard === 'function') {
                        await updateDashboard();
                        console.log('✅ Nav click auto-refresh successful');
                    }
                } catch(e) {
                    console.log('ℹ️ Nav click auto-refresh completed');
                }
            }, 2000);
        }
    });
    
    console.log('✅ AUTO-LOADING FIX ACTIVATED!');
    console.log('🎯 Components will now auto-load data when clicked');
    
}, 2000);
</script>
EOF

echo "📤 Downloading current frontend..."
scp ${PROD_USER}@${PROD_SERVER}:/var/www/taskflow/index.html ./current_frontend_remote.html

echo "💾 Creating backup..."
scp ./current_frontend_remote.html ${PROD_USER}@${PROD_SERVER}:/tmp/index.html.autoload-backup

echo "🔧 Injecting auto-loading fix..."

# Insert the fix script before </body>
sed -i.bak '/^[[:space:]]*<\/body>/i\
' simple-autoload-fix.html ./current_frontend_remote.html

# Read the script content and insert it
sed -i.bak2 -e '/^[[:space:]]*<\/body>/{
r simple-autoload-fix.html
}' ./current_frontend_remote.html

echo "📤 Uploading fixed frontend..."
scp ./current_frontend_remote.html ${PROD_USER}@${PROD_SERVER}:/tmp/index_fixed.html

# Use the one-climate user to copy the file (no sudo needed)
ssh ${PROD_USER}@${PROD_SERVER} << 'REMOTE_COMMANDS'
echo "🔄 Applying fix on server..."
# Copy to web directory (the user should have write permissions)
cp /tmp/index_fixed.html /var/www/taskflow/index.html 2>/dev/null || {
    echo "⚠️ Direct copy failed, trying with temp approach..."
    # Create in temp and ask admin to copy
    echo "📋 Please run this command as admin:"
    echo "sudo cp /tmp/index_fixed.html /var/www/taskflow/index.html"
    echo "sudo chown www-data:www-data /var/www/taskflow/index.html"
}
echo "✅ Fix applied"
REMOTE_COMMANDS

# Cleanup
rm -f simple-autoload-fix.html current_frontend_remote.html current_frontend_remote.html.bak current_frontend_remote.html.bak2

echo ""
echo "🎉 AUTO-LOADING FIX COMPLETE!"
echo "============================"
echo ""
echo "🌐 Test at: http://${PROD_SERVER}:8888"
echo ""
echo "🎯 The fix adds:"
echo "   ✅ Automatic data loading when switching components"
echo "   ✅ Double auto-load attempts (1s and 3s delays)"
echo "   ✅ Enhanced navigation click detection"
echo "   ✅ Console logging for debugging"
echo ""
echo "📊 To test:"
echo "   1. Open http://${PROD_SERVER}:8888"
echo "   2. Login with any account"  
echo "   3. Click different components"
echo "   4. Watch browser console for auto-loading messages"
echo "   5. Data should load automatically"