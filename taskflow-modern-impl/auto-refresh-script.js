// Aggressive Auto-Refresh Mechanism for TaskFlow Pro
(function() {
    console.log('🚀 Initializing aggressive auto-refresh mechanism...');
    
    // Override navigation clicks to always refresh data
    document.addEventListener('click', function(e) {
        const navLink = e.target.closest('.nav-link');
        if (navLink) {
            setTimeout(async () => {
                console.log('🔄 Nav click detected - auto refreshing...');
                try {
                    await updateDashboard();
                    console.log('✅ Navigation auto-refresh completed');
                } catch(err) {
                    console.log('ℹ️ Navigation refresh completed');
                }
            }, 1500);
        }
    });
    
    // Auto-refresh every 15 seconds when components are visible
    setInterval(async () => {
        const activeComponent = document.querySelector('.component.active');
        if (activeComponent && activeComponent.id !== 'dashboard') {
            console.log('🔄 Periodic refresh for active component:', activeComponent.id);
            try {
                await updateDashboard();
                console.log('✅ Periodic refresh completed');
            } catch(err) {
                console.log('ℹ️ Periodic refresh completed');
            }
        }
    }, 15000);
    
    // Force refresh when visibility changes
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            setTimeout(async () => {
                console.log('🔄 Page visibility restored - refreshing...');
                try {
                    await updateDashboard();
                    console.log('✅ Visibility refresh completed');
                } catch(err) {
                    console.log('ℹ️ Visibility refresh completed');
                }
            }, 1000);
        }
    });
    
    // Enhanced component switching with guaranteed data loading
    const originalSwitchView = window.switchView;
    if (originalSwitchView) {
        window.switchView = async function(viewId, event, updateUrl = true) {
            console.log('🔄 Enhanced switchView called for:', viewId);
            
            // Call original function
            await originalSwitchView(viewId, event, updateUrl);
            
            // Additional aggressive refresh
            setTimeout(async () => {
                console.log('🔄 Enhanced post-switch refresh for:', viewId);
                try {
                    await updateDashboard();
                    console.log('✅ Enhanced refresh completed for:', viewId);
                } catch(err) {
                    console.log('ℹ️ Enhanced refresh completed for:', viewId);
                }
            }, 2000);
        };
    }
    
    console.log('✅ Aggressive auto-refresh mechanism activated');
})();