/**
 * CRITICAL FIX: Frontend Infinite Loop Prevention
 * This script fixes the infinite loop issue in team-overview component
 */

// Circuit breaker to prevent infinite loops
let componentLoadCount = {};
let loadingBlocker = {};

// Override problematic functions with circuit breaker protection
function preventInfiniteLoop() {
    console.log('🛡️ CRITICAL FIX: Installing infinite loop prevention...');
    
    // Circuit breaker for loadComponentData
    const originalLoadComponentData = window.loadComponentData;
    if (originalLoadComponentData) {
        window.loadComponentData = async function(viewId) {
            console.log(`📋 [CIRCUIT-BREAKER] Loading component data for: ${viewId}`);
            
            // Circuit breaker check
            if (!componentLoadCount[viewId]) componentLoadCount[viewId] = 0;
            componentLoadCount[viewId]++;
            
            if (componentLoadCount[viewId] > 3) {
                console.warn(`🚫 [CIRCUIT-BREAKER] Infinite loop prevented for ${viewId}`);
                return;
            }
            
            // Reset circuit breaker after 30 seconds
            setTimeout(() => {
                componentLoadCount[viewId] = 0;
            }, 30000);
            
            // Safe execution
            try {
                await originalLoadComponentData(viewId);
            } catch (error) {
                console.error(`❌ [CIRCUIT-BREAKER] Error in ${viewId}:`, error);
            }
        };
    }
    
    // Override loadDataBasedOnCapabilities to prevent loop
    const originalLoadDataBasedOnCapabilities = window.loadDataBasedOnCapabilities;
    if (originalLoadDataBasedOnCapabilities) {
        window.loadDataBasedOnCapabilities = async function() {
            console.log('🔍 [CIRCUIT-BREAKER] Checking user capabilities...');
            
            if (loadingBlocker.dataBasedOnCapabilities) {
                console.warn('🚫 [CIRCUIT-BREAKER] Blocked duplicate loadDataBasedOnCapabilities call');
                return;
            }
            
            loadingBlocker.dataBasedOnCapabilities = true;
            
            try {
                if (window.currentUser && window.currentUser.capabilities && window.currentUser.capabilities.canUseClickUpOAuth) {
                    console.log('✅ [CIRCUIT-BREAKER] User has ClickUp OAuth capability');
                    if (window.loadClickUpData) {
                        await window.loadClickUpData();
                    }
                } else {
                    console.log('📱 [CIRCUIT-BREAKER] Loading in limited mode');
                    if (window.showContentWithoutClickUp) {
                        window.showContentWithoutClickUp();
                    }
                }
            } catch (error) {
                console.error('❌ [CIRCUIT-BREAKER] Error in loadDataBasedOnCapabilities:', error);
            } finally {
                setTimeout(() => {
                    loadingBlocker.dataBasedOnCapabilities = false;
                }, 5000);
            }
        };
    }
    
    // Override renderTeamOverview to prevent retry loop
    const originalRenderTeamOverview = window.renderTeamOverview;
    if (originalRenderTeamOverview) {
        window.renderTeamOverview = function() {
            console.log('👥 [CIRCUIT-BREAKER] Rendering Team Overview (Safe)...');
            
            const teamOverviewGrid = document.getElementById('teamOverviewGrid');
            if (!teamOverviewGrid) {
                console.error('❌ [CIRCUIT-BREAKER] Team overview grid not found');
                return;
            }
            
            // Safe rendering without retry button
            if (window.currentUser && window.currentUser.capabilities && window.currentUser.capabilities.canUseClickUpOAuth) {
                if (window.clickUpData && window.clickUpData.teams) {
                    originalRenderTeamOverview();
                } else {
                    teamOverviewGrid.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: #6b7280;">
                            <h3 style="color: #f59e0b; margin-bottom: 16px;">⏳ Loading Team Data...</h3>
                            <p style="margin-bottom: 24px;">Please wait while we fetch your team information.</p>
                            <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #f59e0b; border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite;"></div>
                        </div>
                        <style>
                        @keyframes spin { to { transform: rotate(360deg); } }
                        </style>
                    `;
                }
            } else {
                teamOverviewGrid.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #6b7280;">
                        <h3 style="color: #f59e0b; margin-bottom: 16px;">👤 Limited Access</h3>
                        <p style="margin-bottom: 16px;">Team management features are not available for your account.</p>
                        <div style="padding: 16px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                            <p style="color: #92400e; margin: 0; font-size: 14px;">
                                ℹ️ Contact your administrator to enable ClickUp integration.
                            </p>
                        </div>
                    </div>
                `;
            }
        };
    }
    
    console.log('✅ CRITICAL FIX: Infinite loop prevention installed successfully');
}

// Auto-apply fix when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preventInfiniteLoop);
} else {
    preventInfiniteLoop();
}

// Apply fix every 10 seconds as safety net
setInterval(() => {
    if (componentLoadCount['team-overview'] > 5) {
        console.warn('🚨 EMERGENCY: Resetting infinite loop counter for team-overview');
        componentLoadCount['team-overview'] = 0;
        loadingBlocker = {};
    }
}, 10000);

console.log('🛡️ CRITICAL FIX: Infinite loop prevention script loaded');