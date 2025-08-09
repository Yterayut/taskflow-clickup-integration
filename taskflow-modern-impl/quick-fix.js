// Quick fix for auto-loading component data
const autoLoadScript = `
// Auto-load data when switching components
document.addEventListener('DOMContentLoaded', function() {
    // Override switchView to auto-load data
    const originalSwitchView = window.switchView;
    window.switchView = async function(view) {
        await originalSwitchView(view);
        // Auto-trigger update after switching
        setTimeout(async () => {
            try {
                await updateDashboard();
                console.log('✅ Auto-refreshed data for', view);
            } catch (error) {
                console.log('⚠️ Auto-refresh skipped for', view);
            }
        }, 1000);
    };
    
    // Auto-load on page load
    setTimeout(async () => {
        try {
            await updateDashboard();
            console.log('✅ Initial data loaded');
        } catch (error) {
            console.log('⚠️ Initial load skipped');
        }
    }, 2000);
});
`;

console.log('Auto-load script:', autoLoadScript);