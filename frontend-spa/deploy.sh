#!/bin/bash

# TaskFlow Pro SPA - Quick Deploy Script
# Deploy React SPA to production without full npm install

echo "🚀 TaskFlow Pro SPA - Quick Deploy"
echo "================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run from frontend-spa directory."
    exit 1
fi

# Create dist directory if it doesn't exist
mkdir -p dist

# Copy HTML file as base
cp index.html dist/

# Create minimal production bundle
echo "📦 Creating production bundle..."

# Create bundled JavaScript (simplified approach)
cat > dist/main.js << 'EOF'
// TaskFlow Pro SPA - Production Bundle
// This is a simplified version for quick deployment

console.log('🚀 TaskFlow Pro SPA Loading...');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ TaskFlow Pro SPA Ready');
    
    // Remove loading screen
    const loadingScreen = document.querySelector('.loading-screen');
    if (loadingScreen) {
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            loadingScreen.style.transition = 'opacity 0.5s ease';
            setTimeout(() => {
                loadingScreen.remove();
                initializeApp();
            }, 500);
        }, 1000);
    }
});

function initializeApp() {
    // Check authentication
    const token = localStorage.getItem('taskflow_token') || 
                 sessionStorage.getItem('taskflow_token');
    
    if (!token) {
        showLoginForm();
    } else {
        // Validate token and load dashboard
        validateTokenAndLoadDashboard();
    }
}

function showLoginForm() {
    const root = document.getElementById('root');
    root.innerHTML = `
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <div style="background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: 400px;">
                <h2 style="text-align: center; color: #1890ff; margin-bottom: 1rem;">TaskFlow Pro</h2>
                <p style="text-align: center; color: #666; margin-bottom: 2rem;">Sign in to your account</p>
                <form id="loginForm">
                    <div style="margin-bottom: 1rem;">
                        <input type="email" id="email" placeholder="Email" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;" required>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <input type="password" id="password" placeholder="Password" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;" required>
                    </div>
                    <button type="submit" style="width: 100%; padding: 0.75rem; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Sign In
                    </button>
                </form>
                <div id="loginError" style="margin-top: 1rem; color: red; text-align: center; display: none;"></div>
            </div>
        </div>
    `;
    
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
        const response = await fetch('/api/v2/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('taskflow_token', data.token);
            localStorage.setItem('taskflow_user', JSON.stringify(data.user));
            loadDashboard(data.user);
        } else {
            errorDiv.style.display = 'block';
            errorDiv.textContent = data.error || 'Login failed';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.style.display = 'block';
        errorDiv.textContent = 'Network error. Please try again.';
    }
}

async function validateTokenAndLoadDashboard() {
    try {
        const response = await fetch('/api/v2/auth/me', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('taskflow_token')}`
            },
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                loadDashboard(data.data);
            } else {
                showLoginForm();
            }
        } else {
            showLoginForm();
        }
    } catch (error) {
        console.error('Token validation error:', error);
        showLoginForm();
    }
}

function loadDashboard(user) {
    const root = document.getElementById('root');
    
    // Get role-based dashboard config
    const dashboardConfig = getRoleBasedConfig(user.role);
    
    root.innerHTML = `
        <div style="min-height: 100vh; display: flex;">
            <!-- Sidebar -->
            <div style="width: 250px; background: #001529; color: white; padding: 1rem;">
                <h3 style="color: #1890ff; margin-bottom: 2rem;">TaskFlow Pro</h3>
                <div style="margin-bottom: 1rem;">
                    <strong>${user.name}</strong><br>
                    <small style="color: #ccc;">${user.role}</small>
                </div>
                <nav>
                    ${dashboardConfig.navigation.map(item => `
                        <div style="padding: 0.5rem 0; cursor: pointer; border-radius: 4px; margin-bottom: 0.25rem;" 
                             onclick="loadComponent('${item.key}')" 
                             onmouseover="this.style.background='#1890ff'" 
                             onmouseout="this.style.background='transparent'">
                            ${item.label}
                        </div>
                    `).join('')}
                </nav>
                <div style="position: absolute; bottom: 1rem;">
                    <button onclick="logout()" style="background: #ff4d4f; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">
                        Logout
                    </button>
                </div>
            </div>
            
            <!-- Main Content -->
            <div style="flex: 1; padding: 2rem;">
                <div id="dashboard-content">
                    <h2>Welcome, ${user.name}!</h2>
                    <p>Role: ${user.role}</p>
                    <div id="component-content">
                        ${getDashboardOverview(user)}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Initialize WebSocket connection
    initializeWebSocket();
}

function getRoleBasedConfig(role) {
    const configs = {
        'Master': {
            navigation: [
                { key: 'dashboard', label: 'Dashboard Overview' },
                { key: 'all-tasks', label: 'All Tasks' },
                { key: 'team-overview', label: 'Team Overview' },
                { key: 'analytics', label: 'Analytics' },
                { key: 'employee-management', label: 'Employee Management' },
                { key: 'ranking', label: 'Team Ranking' },
                { key: 'reports', label: 'Reports' },
                { key: 'attendance', label: 'Attendance' },
                { key: 'settings', label: 'Settings' }
            ]
        },
        'Manager': {
            navigation: [
                { key: 'dashboard', label: 'Dashboard Overview' },
                { key: 'all-tasks', label: 'All Tasks' },
                { key: 'team-overview', label: 'Team Overview' },
                { key: 'analytics', label: 'Analytics' },
                { key: 'employee-management', label: 'Employee Management' },
                { key: 'ranking', label: 'Team Ranking' },
                { key: 'reports', label: 'Reports' }
            ]
        },
        'Team Lead': {
            navigation: [
                { key: 'team-dashboard', label: 'My Team Dashboard' },
                { key: 'members', label: 'Team Members' },
                { key: 'tasks', label: 'Team Tasks' },
                { key: 'analytics', label: 'Team Analytics' },
                { key: 'attendance', label: 'Attendance' }
            ]
        },
        'Employee': {
            navigation: [
                { key: 'my-dashboard', label: 'My Dashboard' },
                { key: 'my-tasks', label: 'My Tasks' },
                { key: 'my-profile', label: 'My Profile' },
                { key: 'knowledge', label: 'Knowledge Management' }
            ]
        }
    };
    
    return configs[role] || configs['Employee'];
}

function getDashboardOverview(user) {
    return `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin-top: 2rem;">
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h3 style="color: #1890ff; margin-bottom: 1rem;">System Status</h3>
                <div id="system-status">Loading...</div>
            </div>
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h3 style="color: #1890ff; margin-bottom: 1rem;">Recent Activity</h3>
                <div id="recent-activity">Loading...</div>
            </div>
        </div>
    `;
}

function loadComponent(key) {
    const content = document.getElementById('component-content');
    
    switch(key) {
        case 'dashboard':
            content.innerHTML = getDashboardOverview(JSON.parse(localStorage.getItem('taskflow_user')));
            break;
        case 'all-tasks':
            content.innerHTML = '<h3>All Tasks</h3><p>Tasks management interface loading...</p>';
            loadTasks();
            break;
        case 'my-tasks':
            content.innerHTML = '<h3>My Tasks</h3><p>Personal tasks loading...</p>';
            loadMyTasks();
            break;
        default:
            content.innerHTML = `<h3>${key}</h3><p>Component loading...</p>`;
    }
}

async function loadTasks() {
    try {
        const response = await fetch('/api/v2/dashboard/tasks', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('taskflow_token')}`
            },
            credentials: 'include'
        });
        
        const data = await response.json();
        if (data.success) {
            displayTasks(data.data.tasks);
        }
    } catch (error) {
        console.error('Load tasks error:', error);
    }
}

function displayTasks(tasks) {
    const content = document.getElementById('component-content');
    content.innerHTML = `
        <h3>Tasks (${tasks.length})</h3>
        <div style="display: grid; gap: 1rem;">
            ${tasks.map(task => `
                <div style="background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <h4>${task.name}</h4>
                    <p>Status: ${task.status}</p>
                    <p>Assignee: ${task.assignee?.name || 'Unassigned'}</p>
                </div>
            `).join('')}
        </div>
    `;
}

function initializeWebSocket() {
    const ws = new WebSocket('ws://192.168.20.10:7813');
    
    ws.onopen = function() {
        console.log('✅ WebSocket connected');
        ws.send(JSON.stringify({ 
            type: 'authenticate',
            token: localStorage.getItem('taskflow_token')
        }));
    };
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        console.log('📡 WebSocket message:', data);
        
        // Handle real-time updates
        if (data.type === 'dashboard_update') {
            // Update dashboard in real-time
            console.log('📊 Dashboard update received');
        }
    };
    
    ws.onclose = function() {
        console.log('❌ WebSocket disconnected');
        // Reconnect logic
        setTimeout(initializeWebSocket, 5000);
    };
}

function logout() {
    localStorage.removeItem('taskflow_token');
    localStorage.removeItem('taskflow_user');
    sessionStorage.removeItem('taskflow_token');
    
    fetch('/api/v2/auth/logout', {
        method: 'POST',
        credentials: 'include'
    });
    
    showLoginForm();
}

// Load system status
async function loadSystemStatus() {
    try {
        const response = await fetch('/api/v2/system/health');
        const data = await response.json();
        
        const statusDiv = document.getElementById('system-status');
        if (statusDiv) {
            statusDiv.innerHTML = `
                <div>Service: ${data.service}</div>
                <div>Status: ${data.status}</div>
                <div>Version: ${data.version}</div>
            `;
        }
    } catch (error) {
        console.error('System status error:', error);
    }
}

// Initialize periodic updates
setInterval(loadSystemStatus, 30000); // Update every 30 seconds
EOF

# Update HTML to use the bundled JS
sed -i '' 's|<script type="module" src="/src/main.tsx"></script>|<script src="main.js"></script>|g' dist/index.html

# Copy any additional assets
mkdir -p dist/assets
if [ -d "src/assets" ]; then
    cp -r src/assets/* dist/assets/
fi

# Create .env file for production
cat > dist/.env << 'EOF'
VITE_API_BASE_URL=/api/v2
VITE_WS_URL=ws://192.168.20.10:7813
EOF

echo "✅ Build complete! Files created in dist/"
echo "📁 Contents:"
ls -la dist/

echo ""
echo "🚀 To deploy to production:"
echo "1. Copy dist/* to /var/www/taskflow-spa/"
echo "2. Update nginx configuration to serve from /var/www/taskflow-spa/"
echo "3. Test at http://192.168.20.10:8889/"