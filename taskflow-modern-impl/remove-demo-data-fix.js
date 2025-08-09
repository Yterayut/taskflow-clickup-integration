#!/usr/bin/env node

// TaskFlow Pro - Remove Demo Data and Use Real ClickUp Data Only
// Replace all mock/demo data with real ClickUp API calls

const fs = require('fs');

console.log('🔧 TaskFlow Pro - Remove Demo Data Fix');
console.log('=====================================');

// Read current production frontend
let html = fs.readFileSync('./current_production_frontend.html', 'utf8');

console.log('🔍 Original file size:', html.length, 'characters');

// 1. Replace hardcoded demo KPI numbers with ClickUp data
console.log('📊 Removing hardcoded KPI numbers...');

// Remove hardcoded numbers and replace with ClickUp data loading
const demoKPIPattern = /\/\/ Update KPIs with demo data[\s\S]*?document\.getElementById\('teamMembers'\)\.textContent = '[^']+';/;

const realKPICode = `// Load real KPIs from ClickUp data
                await loadRealKPIs();`;

html = html.replace(demoKPIPattern, realKPICode);

// 2. Replace hardcoded recent activity with ClickUp data
console.log('📋 Removing hardcoded recent activity...');

const demoActivityPattern = /recentActivity\.innerHTML = \`[\s\S]*?\`;/;

const realActivityCode = `recentActivity.innerHTML = await loadRealRecentActivity();`;

html = html.replace(demoActivityPattern, realActivityCode);

// 3. Remove simulate API call delay
console.log('⚡ Removing simulated delays...');

html = html.replace(/\/\/ Simulate API call[\s\S]*?await new Promise\(resolve => setTimeout\(resolve, 500\)\);/, 
    '// Load real data from ClickUp API');

// 4. Add real ClickUp data loading functions
console.log('🔗 Adding real ClickUp data loading functions...');

const realDataFunctions = `
        // Real ClickUp Data Loading Functions
        async function loadRealKPIs() {
            try {
                console.log('📊 Loading real KPIs from ClickUp...');
                const response = await fetch('/api/v1/clickup-data');
                const data = await response.json();
                
                if (!data.success) {
                    console.warn('⚠️ ClickUp not authenticated:', data.message);
                    // Show authentication required
                    document.getElementById('totalTasks').textContent = '—';
                    document.getElementById('completedTasks').textContent = '—';
                    document.getElementById('pendingTasks').textContent = '—';
                    document.getElementById('teamMembers').textContent = '—';
                    
                    // Show authentication message
                    showAuthenticationRequired();
                    return;
                }
                
                // Calculate real KPIs from ClickUp data
                const tasks = data.data?.tasks || [];
                const users = data.data?.users || [];
                
                const totalTasks = tasks.length;
                const completedTasks = tasks.filter(task => 
                    task.status?.status === 'complete' || 
                    task.status?.status === 'closed'
                ).length;
                const pendingTasks = totalTasks - completedTasks;
                const teamMembers = users.length;
                
                // Update UI with real data
                document.getElementById('totalTasks').textContent = totalTasks;
                document.getElementById('completedTasks').textContent = completedTasks;
                document.getElementById('pendingTasks').textContent = pendingTasks;
                document.getElementById('teamMembers').textContent = teamMembers;
                
                console.log('✅ Real KPIs loaded successfully');
                
            } catch (error) {
                console.error('❌ Error loading real KPIs:', error);
                // Show error state
                document.getElementById('totalTasks').textContent = 'Error';
                document.getElementById('completedTasks').textContent = 'Error';
                document.getElementById('pendingTasks').textContent = 'Error';
                document.getElementById('teamMembers').textContent = 'Error';
            }
        }
        
        async function loadRealRecentActivity() {
            try {
                console.log('📋 Loading real recent activity from ClickUp...');
                const response = await fetch('/api/v1/clickup-data');
                const data = await response.json();
                
                if (!data.success) {
                    return \`<div class="auth-required">
                        <div class="auth-message">
                            <span class="auth-icon">🔐</span>
                            <span>ClickUp authentication required</span>
                            <a href="/auth/clickup" class="auth-link">Connect ClickUp</a>
                        </div>
                    </div>\`;
                }
                
                // Get recent tasks from ClickUp
                const tasks = data.data?.tasks || [];
                
                if (tasks.length === 0) {
                    return \`<div class="no-activity">
                        <span class="no-activity-icon">📝</span>
                        <span>No recent activity</span>
                    </div>\`;
                }
                
                // Sort by date_updated and get most recent
                const recentTasks = tasks
                    .filter(task => task.date_updated)
                    .sort((a, b) => new Date(b.date_updated) - new Date(a.date_updated))
                    .slice(0, 5);
                
                // Build real activity HTML
                let activityHTML = '';
                recentTasks.forEach(task => {
                    const assignees = task.assignees?.map(a => a.username).join(', ') || 'Unassigned';
                    const timeAgo = getTimeAgo(new Date(task.date_updated));
                    const statusColor = getStatusColor(task.status?.status);
                    
                    activityHTML += \`
                        <div class="task-item">
                            <div class="task-title">
                                <span class="status-indicator" style="background-color: \${statusColor}"></span>
                                \${task.name}
                            </div>
                            <div class="task-meta">
                                <span>by \${assignees}</span>
                                <span>\${timeAgo}</span>
                                <span class="task-status">\${task.status?.status || 'No status'}</span>
                            </div>
                        </div>
                    \`;
                });
                
                console.log('✅ Real recent activity loaded successfully');
                return activityHTML;
                
            } catch (error) {
                console.error('❌ Error loading real recent activity:', error);
                return \`<div class="error-state">
                    <span class="error-icon">❌</span>
                    <span>Error loading recent activity</span>
                </div>\`;
            }
        }
        
        function showAuthenticationRequired() {
            const authRequired = document.createElement('div');
            authRequired.className = 'auth-required-overlay';
            authRequired.innerHTML = \`
                <div class="auth-required-modal">
                    <div class="auth-required-content">
                        <span class="auth-required-icon">🔐</span>
                        <h3>ClickUp Authentication Required</h3>
                        <p>To view real data, please connect your ClickUp account.</p>
                        <a href="/auth/clickup" class="auth-required-button">Connect ClickUp</a>
                        <button onclick="this.parentElement.parentElement.parentElement.remove()" class="auth-required-close">×</button>
                    </div>
                </div>
            \`;
            document.body.appendChild(authRequired);
        }
        
        function getTimeAgo(date) {
            const now = new Date();
            const diffMs = now - date;
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffHours / 24);
            
            if (diffDays > 0) {
                return \`\${diffDays} day\${diffDays > 1 ? 's' : ''} ago\`;
            } else if (diffHours > 0) {
                return \`\${diffHours} hour\${diffHours > 1 ? 's' : ''} ago\`;
            } else {
                return 'Just now';
            }
        }
        
        function getStatusColor(status) {
            const statusColors = {
                'complete': '#10b981',
                'closed': '#6b7280',
                'in progress': '#3b82f6',
                'to do': '#ef4444',
                'review': '#f59e0b'
            };
            return statusColors[status?.toLowerCase()] || '#9ca3af';
        }
`;

// Insert real data functions before the closing script tag
html = html.replace(/(\s*)<\/script>\s*<\/body>/, `$1${realDataFunctions}$1</script>$1</body>`);

// 5. Add CSS for authentication required states
console.log('🎨 Adding authentication required CSS...');

const authRequiredCSS = `
        .auth-required {
            text-align: center;
            padding: 2rem;
            color: var(--text-secondary);
        }
        
        .auth-message {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }
        
        .auth-link {
            color: var(--primary-blue);
            text-decoration: none;
            font-weight: 500;
            margin-left: 0.5rem;
        }
        
        .auth-link:hover {
            text-decoration: underline;
        }
        
        .auth-required-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        
        .auth-required-modal {
            background: var(--bg-primary);
            border-radius: 8px;
            padding: 2rem;
            text-align: center;
            max-width: 400px;
            box-shadow: var(--shadow-lg);
        }
        
        .auth-required-icon {
            font-size: 3rem;
            display: block;
            margin-bottom: 1rem;
        }
        
        .auth-required-button {
            display: inline-block;
            background: var(--primary-blue);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            text-decoration: none;
            margin-top: 1rem;
            font-weight: 500;
        }
        
        .auth-required-button:hover {
            background: var(--primary-blue-dark);
        }
        
        .auth-required-close {
            position: absolute;
            top: 10px;
            right: 15px;
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: var(--text-secondary);
        }
        
        .no-activity {
            text-align: center;
            padding: 2rem;
            color: var(--text-secondary);
        }
        
        .no-activity-icon {
            display: block;
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }
        
        .error-state {
            text-align: center;
            padding: 2rem;
            color: var(--danger-red);
        }
        
        .error-icon {
            display: block;
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }
        
        .status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 0.5rem;
        }
        
        .task-status {
            background: var(--bg-tertiary);
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            text-transform: capitalize;
        }
`;

// Insert CSS before closing style tag
html = html.replace(/(\s*)<\/style>/, `$1${authRequiredCSS}$1</style>`);

// Write the fixed file
fs.writeFileSync('./frontend_clickup_only.html', html);

console.log('✅ Demo data removal complete!');
console.log('📁 Generated: frontend_clickup_only.html');
console.log('📊 New file size:', html.length, 'characters');
console.log('');
console.log('🎯 Changes made:');
console.log('   ✅ Removed hardcoded KPI numbers (42, 28, 14, 11)');
console.log('   ✅ Removed fake recent activity (John Doe, Jane Smith)');
console.log('   ✅ Removed simulated API delays');
console.log('   ✅ Added real ClickUp data loading functions');
console.log('   ✅ Added authentication required handling');
console.log('   ✅ Added error state handling');
console.log('   ✅ Added CSS for authentication states');
console.log('');
console.log('🔗 Real ClickUp integration:');
console.log('   📊 KPIs calculated from real tasks and users');
console.log('   📋 Recent activity from real task updates');
console.log('   🔐 Authentication required prompts');
console.log('   ⚡ No more fake delays or demo data');
console.log('');
console.log('📤 Ready to deploy with: ./deploy-clickup-only.sh');