// TaskFlow Pro SPA - Optimized Production Bundle
// Enhanced with performance optimizations

console.log('🚀 TaskFlow Pro SPA Loading...');

// Register service worker for caching
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('📦 Service Worker registered successfully:', registration.scope);
            })
            .catch(function(error) {
                console.log('📦 Service Worker registration failed:', error);
            });
    });
}

// Performance optimization: Preload critical resources
const preloadCriticalResources = () => {
    const criticalAPIs = [
        '/api/v2/system/health',
        '/api/v2/auth/me'
    ];
    
    criticalAPIs.forEach(url => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = url;
        link.as = 'fetch';
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
    });
};

// API Response caching for better performance
class APICache {
    constructor() {
        this.cache = new Map();
        this.ttl = 5 * 60 * 1000; // 5 minutes
    }

    set(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    get(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        if (Date.now() - cached.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    clear() {
        this.cache.clear();
    }
}

const apiCache = new APICache();

// Enhanced fetch with caching
const enhancedFetch = async (url, options = {}) => {
    const cacheKey = `${url}:${JSON.stringify(options)}`;
    
    // Check cache first for GET requests
    if (!options.method || options.method === 'GET') {
        const cached = apiCache.get(cacheKey);
        if (cached) {
            console.log('📦 Cache hit:', url);
            return Promise.resolve(cached);
        }
    }
    
    const startTime = performance.now();
    
    try {
        const response = await fetch(url, options);
        const endTime = performance.now();
        
        console.log(`📊 API Response: ${url} (${(endTime - startTime).toFixed(2)}ms)`);
        
        if (response.ok) {
            const data = await response.json();
            
            // Cache successful GET requests
            if (!options.method || options.method === 'GET') {
                apiCache.set(cacheKey, {
                    ok: true,
                    status: response.status,
                    json: () => Promise.resolve(data)
                });
            }
            
            return {
                ok: true,
                status: response.status,
                json: () => Promise.resolve(data)
            };
        }
        
        return response;
    } catch (error) {
        console.error(`❌ API Error: ${url}`, error);
        throw error;
    }
};

// Initialize app with performance monitoring
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ TaskFlow Pro SPA Ready');
    
    // Preload critical resources
    preloadCriticalResources();
    
    // Remove loading screen with animation
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
    } else {
        initializeApp();
    }
});

function initializeApp() {
    // Check authentication with enhanced fetch
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
            <div style="background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: 400px; animation: fadeIn 0.3s ease;">
                <h2 style="text-align: center; color: #1890ff; margin-bottom: 1rem;">TaskFlow Pro</h2>
                <p style="text-align: center; color: #666; margin-bottom: 2rem;">Sign in to your account</p>
                <form id="loginForm">
                    <div style="margin-bottom: 1rem;">
                        <input type="email" id="email" placeholder="Email" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; font-size: 16px;" required>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <input type="password" id="password" placeholder="Password" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; font-size: 16px;" required>
                    </div>
                    <button type="submit" id="loginButton" style="width: 100%; padding: 0.75rem; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; transition: all 0.3s ease;">
                        Sign In
                    </button>
                </form>
                <div id="loginError" style="margin-top: 1rem; color: red; text-align: center; display: none;"></div>
            </div>
        </div>
        <style>
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        </style>
    `;
    
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    const loginButton = document.getElementById('loginButton');
    
    // Show loading state
    loginButton.textContent = 'Signing in...';
    loginButton.disabled = true;
    errorDiv.style.display = 'none';
    
    try {
        const response = await enhancedFetch('/api/v2/auth/login', {
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
            
            // Preload dashboard data
            preloadDashboardData();
            
            loadDashboard(data.user);
        } else {
            errorDiv.style.display = 'block';
            errorDiv.textContent = data.error || 'Login failed';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.style.display = 'block';
        errorDiv.textContent = 'Network error. Please try again.';
    } finally {
        loginButton.textContent = 'Sign In';
        loginButton.disabled = false;
    }
}

async function preloadDashboardData() {
    const preloadAPIs = [
        '/api/v2/dashboard/config',
        '/api/v2/dashboard/tasks',
        '/api/v2/system/health'
    ];
    
    preloadAPIs.forEach(async (url) => {
        try {
            await enhancedFetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('taskflow_token')}`
                },
                credentials: 'include'
            });
        } catch (error) {
            console.log(`Preload failed for ${url}:`, error);
        }
    });
}

async function validateTokenAndLoadDashboard() {
    try {
        const response = await enhancedFetch('/api/v2/auth/me', {
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
        <div style="min-height: 100vh; display: flex; animation: slideIn 0.5s ease;">
            <!-- Sidebar -->
            <div id="sidebar" style="width: 250px; background: #001529; color: white; padding: 1rem; transition: all 0.3s ease;">
                <div style="display: flex; align-items: center; margin-bottom: 2rem;">
                    <h3 style="color: #1890ff; margin: 0;">TaskFlow Pro</h3>
                    <button id="sidebarToggle" style="background: none; border: none; color: white; margin-left: auto; cursor: pointer; font-size: 16px;">☰</button>
                </div>
                <div style="margin-bottom: 2rem; padding: 1rem; background: rgba(255,255,255,0.1); border-radius: 8px;">
                    <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                        <div style="width: 40px; height: 40px; background: #1890ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 1rem;">
                            ${user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <strong style="display: block;">${user.name}</strong>
                            <small style="color: #ccc;">${user.role}</small>
                        </div>
                    </div>
                    <div id="connectionStatus" style="font-size: 12px; color: #ccc;">
                        <span id="connectionIndicator">🔴</span> Connecting...
                    </div>
                </div>
                <nav id="navigation">
                    ${dashboardConfig.navigation.map(item => `
                        <div class="nav-item" style="padding: 0.75rem 1rem; cursor: pointer; border-radius: 4px; margin-bottom: 0.5rem; transition: all 0.3s ease;" 
                             onclick="loadComponent('${item.key}')" 
                             data-key="${item.key}">
                            ${item.icon || '📊'} ${item.label}
                        </div>
                    `).join('')}
                </nav>
                <div style="position: absolute; bottom: 1rem; left: 1rem; right: 1rem;">
                    <button onclick="logout()" style="width: 100%; background: #ff4d4f; color: white; border: none; padding: 0.75rem; border-radius: 4px; cursor: pointer; transition: all 0.3s ease;">
                        🚪 Logout
                    </button>
                </div>
            </div>
            
            <!-- Main Content -->
            <div style="flex: 1; padding: 2rem; background: #f0f2f5;">
                <div id="dashboard-content">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                        <h1 style="margin: 0; color: #1890ff;">Welcome, ${user.name}!</h1>
                        <div style="display: flex; gap: 1rem;">
                            <button onclick="refreshDashboard()" style="background: #52c41a; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">
                                🔄 Refresh
                            </button>
                            <button onclick="showPerformanceReport()" style="background: #1890ff; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">
                                📊 Performance
                            </button>
                        </div>
                    </div>
                    <div id="component-content">
                        ${getDashboardOverview(user)}
                    </div>
                </div>
            </div>
        </div>
        
        <style>
            @keyframes slideIn {
                from { transform: translateX(-20px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            .nav-item:hover {
                background: #1890ff !important;
                transform: translateX(5px);
            }
            
            .nav-item.active {
                background: #1890ff !important;
            }
        </style>
    `;
    
    // Initialize sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
    
    // Initialize WebSocket connection
    initializeWebSocket();
    
    // Load initial component
    loadComponent('dashboard');
    
    // Auto-refresh dashboard data
    setInterval(refreshDashboardData, 30000);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const isCollapsed = sidebar.style.width === '60px';
    
    if (isCollapsed) {
        sidebar.style.width = '250px';
        sidebar.querySelectorAll('.nav-item').forEach(item => {
            item.style.fontSize = '14px';
        });
    } else {
        sidebar.style.width = '60px';
        sidebar.querySelectorAll('.nav-item').forEach(item => {
            item.style.fontSize = '0px';
        });
    }
}

function getRoleBasedConfig(role) {
    const configs = {
        'Master': {
            navigation: [
                { key: 'dashboard', label: 'Dashboard', icon: '📊' },
                { key: 'all-tasks', label: 'All Tasks', icon: '📋' },
                { key: 'team-overview', label: 'Team Overview', icon: '👥' },
                { key: 'analytics', label: 'Analytics', icon: '📈' },
                { key: 'employee-management', label: 'Employee Management', icon: '👤' },
                { key: 'ranking', label: 'Team Ranking', icon: '🏆' },
                { key: 'reports', label: 'Reports', icon: '📄' },
                { key: 'attendance', label: 'Attendance', icon: '⏰' },
                { key: 'settings', label: 'Settings', icon: '⚙️' }
            ]
        },
        'Manager': {
            navigation: [
                { key: 'dashboard', label: 'Dashboard', icon: '📊' },
                { key: 'all-tasks', label: 'All Tasks', icon: '📋' },
                { key: 'team-overview', label: 'Team Overview', icon: '👥' },
                { key: 'analytics', label: 'Analytics', icon: '📈' },
                { key: 'employee-management', label: 'Employee Management', icon: '👤' },
                { key: 'ranking', label: 'Team Ranking', icon: '🏆' },
                { key: 'reports', label: 'Reports', icon: '📄' }
            ]
        },
        'Team Lead': {
            navigation: [
                { key: 'team-dashboard', label: 'Team Dashboard', icon: '📊' },
                { key: 'members', label: 'Team Members', icon: '👥' },
                { key: 'tasks', label: 'Team Tasks', icon: '📋' },
                { key: 'analytics', label: 'Analytics', icon: '📈' },
                { key: 'attendance', label: 'Attendance', icon: '⏰' }
            ]
        },
        'Employee': {
            navigation: [
                { key: 'my-dashboard', label: 'My Dashboard', icon: '📊' },
                { key: 'my-tasks', label: 'My Tasks', icon: '📋' },
                { key: 'my-profile', label: 'My Profile', icon: '👤' },
                { key: 'knowledge', label: 'Knowledge', icon: '📚' }
            ]
        }
    };
    
    return configs[role] || configs['Employee'];
}

function getDashboardOverview(user) {
    return `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
            <div class="dashboard-card" style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.3s ease;">
                <h3 style="color: #1890ff; margin-bottom: 1rem; display: flex; align-items: center;">
                    🔧 System Status
                    <span id="systemStatusIndicator" style="margin-left: auto; color: #faad14;">⏳</span>
                </h3>
                <div id="system-status">Loading...</div>
            </div>
            
            <div class="dashboard-card" style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.3s ease;">
                <h3 style="color: #1890ff; margin-bottom: 1rem; display: flex; align-items: center;">
                    📊 Performance
                    <span id="performanceIndicator" style="margin-left: auto; color: #52c41a;">✅</span>
                </h3>
                <div id="performance-metrics">
                    <div>Page Load: <span id="pageLoadTime">-</span>ms</div>
                    <div>API Response: <span id="apiResponseTime">-</span>ms</div>
                    <div>Memory Usage: <span id="memoryUsage">-</span>MB</div>
                </div>
            </div>
            
            <div class="dashboard-card" style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.3s ease;">
                <h3 style="color: #1890ff; margin-bottom: 1rem; display: flex; align-items: center;">
                    🔄 Real-time Status
                    <span id="realtimeIndicator" style="margin-left: auto; color: #faad14;">⏳</span>
                </h3>
                <div id="realtime-status">Connecting...</div>
            </div>
        </div>
        
        <style>
            .dashboard-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 16px rgba(0,0,0,0.15);
            }
        </style>
    `;
}

function loadComponent(key) {
    const content = document.getElementById('component-content');
    const navItems = document.querySelectorAll('.nav-item');
    
    // Update active navigation
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.key === key) {
            item.classList.add('active');
        }
    });
    
    // Show loading state
    content.innerHTML = '<div style="text-align: center; padding: 2rem;"><div style="font-size: 20px;">Loading...</div></div>';
    
    switch(key) {
        case 'dashboard':
            content.innerHTML = getDashboardOverview(JSON.parse(localStorage.getItem('taskflow_user')));
            loadSystemStatus();
            loadPerformanceMetrics();
            break;
        case 'all-tasks':
            content.innerHTML = '<h3 style="color: #1890ff; margin-bottom: 1rem;">📋 All Tasks</h3><div id="tasks-container">Loading tasks...</div>';
            loadTasks();
            break;
        case 'my-tasks':
            content.innerHTML = '<h3 style="color: #1890ff; margin-bottom: 1rem;">📋 My Tasks</h3><div id="tasks-container">Loading personal tasks...</div>';
            loadMyTasks();
            break;
        case 'analytics':
            content.innerHTML = '<h3 style="color: #1890ff; margin-bottom: 1rem;">📈 Analytics</h3><div>Analytics dashboard coming soon...</div>';
            break;
        default:
            content.innerHTML = `<h3 style="color: #1890ff; margin-bottom: 1rem;">${key.replace('-', ' ').toUpperCase()}</h3><div>Component loading...</div>`;
    }
}

async function loadTasks() {
    try {
        const response = await enhancedFetch('/api/v2/dashboard/tasks', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('taskflow_token')}`
            },
            credentials: 'include'
        });
        
        const data = await response.json();
        if (data.success) {
            displayTasks(data.data.tasks);
        } else {
            document.getElementById('tasks-container').innerHTML = '<div style="color: #ff4d4f;">Failed to load tasks</div>';
        }
    } catch (error) {
        console.error('Load tasks error:', error);
        document.getElementById('tasks-container').innerHTML = '<div style="color: #ff4d4f;">Network error loading tasks</div>';
    }
}

async function loadMyTasks() {
    // Similar to loadTasks but filtered for current user
    await loadTasks();
}

function displayTasks(tasks) {
    const container = document.getElementById('tasks-container');
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #666;">No tasks found</div>';
        return;
    }
    
    container.innerHTML = `
        <div style="display: grid; gap: 1rem; margin-top: 1rem;">
            ${tasks.map(task => `
                <div class="task-card" style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 4px solid ${getStatusColor(task.status)}; transition: all 0.3s ease;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                        <h4 style="margin: 0; color: #1890ff;">${task.name}</h4>
                        <span style="background: ${getStatusColor(task.status)}; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 12px;">
                            ${task.status}
                        </span>
                    </div>
                    ${task.description ? `<p style="color: #666; margin-bottom: 1rem;">${task.description}</p>` : ''}
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>Assignee:</strong> ${task.assignee?.name || 'Unassigned'}
                        </div>
                        <div style="color: #666; font-size: 12px;">
                            ${task.due_date ? `Due: ${new Date(task.due_date).toLocaleDateString()}` : 'No due date'}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <style>
            .task-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 16px rgba(0,0,0,0.15);
            }
        </style>
    `;
}

function getStatusColor(status) {
    const colors = {
        'todo': '#faad14',
        'in_progress': '#1890ff',
        'review': '#722ed1',
        'done': '#52c41a',
        'cancelled': '#ff4d4f',
        'blocked': '#ff7875'
    };
    return colors[status] || '#666';
}

function initializeWebSocket() {
    try {
        const ws = new WebSocket('ws://192.168.20.10:7813');
        
        ws.onopen = function() {
            console.log('✅ WebSocket connected');
            updateConnectionStatus('🟢 Connected', '#52c41a');
            
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
                refreshDashboardData();
            }
            
            if (data.type === 'notification') {
                showNotification(data.data);
            }
        };
        
        ws.onclose = function() {
            console.log('❌ WebSocket disconnected');
            updateConnectionStatus('🔴 Disconnected', '#ff4d4f');
            
            // Reconnect after 5 seconds
            setTimeout(() => {
                updateConnectionStatus('🟡 Reconnecting...', '#faad14');
                initializeWebSocket();
            }, 5000);
        };
        
        ws.onerror = function(error) {
            console.error('WebSocket error:', error);
            updateConnectionStatus('🔴 Error', '#ff4d4f');
        };
        
    } catch (error) {
        console.error('WebSocket initialization error:', error);
        updateConnectionStatus('🔴 Error', '#ff4d4f');
    }
}

function updateConnectionStatus(status, color) {
    const indicator = document.getElementById('connectionIndicator');
    const statusText = document.getElementById('connectionStatus');
    
    if (indicator) {
        indicator.textContent = status.split(' ')[0];
    }
    
    if (statusText) {
        statusText.innerHTML = `<span style="color: ${color}">${status}</span>`;
    }
    
    const realtimeIndicator = document.getElementById('realtimeIndicator');
    const realtimeStatus = document.getElementById('realtime-status');
    
    if (realtimeIndicator) {
        realtimeIndicator.textContent = status.split(' ')[0];
    }
    
    if (realtimeStatus) {
        realtimeStatus.innerHTML = `<span style="color: ${color}">${status}</span>`;
    }
}

function showNotification(data) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 1rem;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideInRight 0.3s ease;
        border-left: 4px solid #1890ff;
    `;
    
    notification.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 0.5rem;">${data.title}</div>
        <div style="color: #666;">${data.message}</div>
        <button onclick="this.parentElement.remove()" style="position: absolute; top: 5px; right: 5px; background: none; border: none; cursor: pointer; font-size: 16px;">&times;</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Load system status
async function loadSystemStatus() {
    try {
        const response = await enhancedFetch('/api/v2/system/health');
        const data = await response.json();
        
        const statusDiv = document.getElementById('system-status');
        const indicator = document.getElementById('systemStatusIndicator');
        
        if (statusDiv) {
            const isHealthy = data.status === 'healthy';
            
            statusDiv.innerHTML = `
                <div style="margin-bottom: 0.5rem;">
                    <strong>Service:</strong> ${data.service || 'TaskFlow Backend'}
                </div>
                <div style="margin-bottom: 0.5rem;">
                    <strong>Version:</strong> ${data.version || 'Unknown'}
                </div>
                <div style="margin-bottom: 0.5rem;">
                    <strong>Status:</strong> <span style="color: ${isHealthy ? '#52c41a' : '#ff4d4f'}">${data.status}</span>
                </div>
                <div style="font-size: 12px; color: #666;">
                    Last updated: ${new Date().toLocaleTimeString()}
                </div>
            `;
            
            if (indicator) {
                indicator.textContent = isHealthy ? '✅' : '❌';
            }
        }
    } catch (error) {
        console.error('System status error:', error);
        const statusDiv = document.getElementById('system-status');
        const indicator = document.getElementById('systemStatusIndicator');
        
        if (statusDiv) {
            statusDiv.innerHTML = '<div style="color: #ff4d4f;">Unable to load system status</div>';
        }
        if (indicator) {
            indicator.textContent = '❌';
        }
    }
}

// Load performance metrics
function loadPerformanceMetrics() {
    const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
    const pageLoadTimeElement = document.getElementById('pageLoadTime');
    const apiResponseTimeElement = document.getElementById('apiResponseTime');
    const memoryUsageElement = document.getElementById('memoryUsage');
    
    if (pageLoadTimeElement) {
        pageLoadTimeElement.textContent = loadTime;
    }
    
    // Calculate average API response time
    if (window.apiResponseTimes && window.apiResponseTimes.length > 0) {
        const avgResponse = window.apiResponseTimes.reduce((sum, time) => sum + time, 0) / window.apiResponseTimes.length;
        if (apiResponseTimeElement) {
            apiResponseTimeElement.textContent = avgResponse.toFixed(2);
        }
    }
    
    // Memory usage
    if (performance.memory && memoryUsageElement) {
        const memoryMB = performance.memory.usedJSHeapSize / 1024 / 1024;
        memoryUsageElement.textContent = memoryMB.toFixed(2);
    }
}

function refreshDashboard() {
    console.log('🔄 Refreshing dashboard...');
    
    // Clear cache
    apiCache.clear();
    
    // Reload current component
    const activeNavItem = document.querySelector('.nav-item.active');
    if (activeNavItem) {
        loadComponent(activeNavItem.dataset.key);
    }
    
    // Reload system status
    loadSystemStatus();
    loadPerformanceMetrics();
    
    // Show success message
    showNotification({
        title: 'Dashboard Refreshed',
        message: 'All data has been updated successfully'
    });
}

function refreshDashboardData() {
    // Auto-refresh background data
    loadSystemStatus();
    loadPerformanceMetrics();
}

function showPerformanceReport() {
    const report = {
        timestamp: new Date().toISOString(),
        pageLoadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        memoryUsage: performance.memory ? performance.memory.usedJSHeapSize / 1024 / 1024 : 'N/A',
        cacheSize: apiCache.cache.size,
        connectionStatus: document.getElementById('connectionStatus')?.textContent || 'Unknown'
    };
    
    alert(`Performance Report\n\nPage Load: ${report.pageLoadTime}ms\nMemory Usage: ${report.memoryUsage}MB\nCache Size: ${report.cacheSize} items\nConnection: ${report.connectionStatus}`);
}

function logout() {
    localStorage.removeItem('taskflow_token');
    localStorage.removeItem('taskflow_user');
    sessionStorage.removeItem('taskflow_token');
    
    // Clear cache
    apiCache.clear();
    
    enhancedFetch('/api/v2/auth/logout', {
        method: 'POST',
        credentials: 'include'
    });
    
    showLoginForm();
}

// Initialize periodic updates
setInterval(refreshDashboardData, 30000); // Update every 30 seconds

// Track performance
window.apiResponseTimes = [];

console.log('✅ Enhanced TaskFlow Pro SPA loaded with performance optimizations');