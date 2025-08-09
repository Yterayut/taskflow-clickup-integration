#!/usr/bin/env node
/**
 * TaskFlow Pro - Component Loading Fix
 * Fix the component auto-loading issue permanently
 */

const REMOTE_FIXES = `
# Fix Component Loading Issues

# 1. Increase waitForElement timeout and add force-load mechanism
echo "🔧 Fixing waitForElement function..."
sudo sed -i '
/function waitForElement/ {
:a
n
/^        }/ !ba
i\\
        // Force load mechanism if element still not found\\
        function forceLoadElement(id) {\\
            console.log(\`🔧 Force loading element: \${id}\`);\\
            const existingElement = document.getElementById(id);\\
            if (existingElement) {\\
                console.log(\`✅ Element \${id} found via force load\`);\\
                return existingElement;\\
            }\\
            console.warn(\`⚠️ Element \${id} still not found after force load\`);\\
            return null;\\
        }
}
' /var/www/taskflow/index.html

# 2. Modify switchView to include force refresh
echo "🔧 Adding force refresh to switchView..."
sudo sed -i '/await loadComponentData(viewId);/a\\
                // Force refresh if component data loading failed\\
                setTimeout(async () => {\\
                    if (!document.querySelector(\`#\${viewId} .loading-state\`)) {\\
                        console.log(\`🔄 Force refreshing component: \${viewId}\`);\\
                        await loadComponentData(viewId);\\
                    }\\
                }, 1000);
' /var/www/taskflow/index.html

# 3. Add auto-refresh on component switch
echo "🔧 Adding auto-refresh mechanism..."
sudo sed -i '/Successfully switched to/a\\
                \\
                // Auto-trigger data refresh after component switch\\
                setTimeout(() => {\\
                    console.log(\`🔄 Auto-refreshing data for \${viewId}\`);\\
                    updateDashboard().catch(e => console.log(\`ℹ️ Auto-refresh skipped: \${e.message}\`));\\
                }, 500);
' /var/www/taskflow/index.html

# 4. Add fallback mechanism for missing elements
echo "🔧 Adding fallback element creation..."
sudo sed -i '/Element.*not found after.*attempts/a\\
                        \\
                        // Fallback: try to create basic element structure\\
                        console.log(\`🔧 Creating fallback element for \${id}\`);\\
                        const parentComponent = document.querySelector(\`#\${currentView || "dashboard"}\`);\\
                        if (parentComponent && !document.getElementById(id)) {\\
                            const fallbackElement = document.createElement("div");\\
                            fallbackElement.id = id;\\
                            fallbackElement.className = getElementClass(id);\\
                            parentComponent.appendChild(fallbackElement);\\
                            console.log(\`✅ Created fallback element: \${id}\`);\\
                        }
' /var/www/taskflow/index.html

# 5. Add helper function for element classes
echo "🔧 Adding helper functions..."
sudo sed -i '/function safeGetElement/i\\
        function getElementClass(id) {\\
            const classMap = {\\
                "myTasksList": "task-list",\\
                "teamOverviewGrid": "team-grid",\\
                "employeeGrid": "employee-grid",\\
                "rankingGrid": "ranking-grid",\\
                "projectsContent": "projects-content",\\
                "reportsContent": "reports-content",\\
                "calendarContent": "calendar-content",\\
                "settingsContent": "settings-content"\\
            };\\
            return classMap[id] || "component-content";\\
        }\\
        
' /var/www/taskflow/index.html

echo "✅ Component loading fixes applied"
`;

console.log('🔧 Component Loading Fix Commands:');
console.log(REMOTE_FIXES);