// Frontend Data Integration - Enhanced component rendering with real data
class DataIntegrationService {
    constructor() {
        this.apiBaseUrl = 'http://192.168.20.10:7812';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    // Generic API call with error handling
    async apiCall(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API call failed for ${endpoint}:`, error);
            throw error;
        }
    }

    // Cache management
    getCachedData(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    setCachedData(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    // Enhanced Dashboard renderer with real data
    async renderDashboard() {
        const dashboardElement = document.getElementById('dashboard');
        if (!dashboardElement) return;

        // Show loading state
        dashboardElement.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                Loading dashboard data...
            </div>
        `;

        try {
            // Get user role
            const userRole = currentUser?.role || 'Employee';
            
            // Check cache first
            const cacheKey = `dashboard_${userRole}`;
            let dashboardData = this.getCachedData(cacheKey);
            
            if (!dashboardData) {
                // Fetch data from API
                const response = await this.apiCall(`/api/v2/dashboard/summary/${userRole}`);
                dashboardData = response.data;
                this.setCachedData(cacheKey, dashboardData);
            }

            // Render dashboard with real data
            dashboardElement.innerHTML = `
                <div class="page-header">
                    <h1 class="page-title">Dashboard</h1>
                    <p class="page-subtitle">Welcome back, ${currentUser?.name || 'User'}!</p>
                </div>
                
                <div class="kpi-grid">
                    ${this.renderKPICards(dashboardData.kpi, userRole)}
                </div>
                
                <div class="dashboard-sections">
                    ${this.renderDashboardSections(dashboardData, userRole)}
                </div>
            `;

        } catch (error) {
            console.error('Dashboard rendering error:', error);
            dashboardElement.innerHTML = `
                <div class="error-message">
                    <h3>Failed to load dashboard</h3>
                    <p>${error.message}</p>
                    <button onclick="dataService.renderDashboard()" class="btn btn-primary">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    // Enhanced My Tasks renderer
    async renderMyTasks() {
        const myTasksElement = document.getElementById('my-tasks');
        if (!myTasksElement) return;

        // Show loading state
        myTasksElement.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                Loading your tasks...
            </div>
        `;

        try {
            const userId = currentUser?.id || 'current';
            const cacheKey = `my_tasks_${userId}`;
            let tasksData = this.getCachedData(cacheKey);
            
            if (!tasksData) {
                const response = await this.apiCall(`/api/v2/dashboard/my-tasks/${userId}`);
                tasksData = response.data;
                this.setCachedData(cacheKey, tasksData);
            }

            myTasksElement.innerHTML = `
                <div class="page-header">
                    <h1 class="page-title">My Tasks</h1>
                    <p class="page-subtitle">Your assigned tasks and progress</p>
                </div>
                
                <div class="task-summary">
                    <div class="task-stats">
                        <div class="stat-item">
                            <span class="stat-value">${tasksData.total || 0}</span>
                            <span class="stat-label">Total Tasks</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${tasksData.completed || 0}</span>
                            <span class="stat-label">Completed</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${tasksData.pending || 0}</span>
                            <span class="stat-label">Pending</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${tasksData.overdue || 0}</span>
                            <span class="stat-label">Overdue</span>
                        </div>
                    </div>
                </div>
                
                <div class="tasks-list">
                    ${this.renderTasksList(tasksData.tasks || [])}
                </div>
            `;

        } catch (error) {
            console.error('My Tasks rendering error:', error);
            myTasksElement.innerHTML = `
                <div class="error-message">
                    <h3>Failed to load tasks</h3>
                    <p>${error.message}</p>
                    <button onclick="dataService.renderMyTasks()" class="btn btn-primary">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    // Enhanced Team Overview renderer
    async renderTeamOverview() {
        const teamOverviewElement = document.getElementById('team-overview');
        if (!teamOverviewElement) return;

        // Show loading state
        teamOverviewElement.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                Loading team overview...
            </div>
        `;

        try {
            const userId = currentUser?.id || 'current';
            const cacheKey = `team_overview_${userId}`;
            let teamData = this.getCachedData(cacheKey);
            
            if (!teamData) {
                const response = await this.apiCall(`/api/v2/dashboard/team-overview/${userId}`);
                teamData = response.data;
                this.setCachedData(cacheKey, teamData);
            }

            teamOverviewElement.innerHTML = `
                <div class="page-header">
                    <h1 class="page-title">Team Overview</h1>
                    <p class="page-subtitle">Team performance and member status</p>
                </div>
                
                <div class="team-summary">
                    <div class="team-stats">
                        <div class="stat-item">
                            <span class="stat-value">${teamData.team?.members || 0}</span>
                            <span class="stat-label">Team Members</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${teamData.team?.projects || 0}</span>
                            <span class="stat-label">Active Projects</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${teamData.team?.efficiency || 0}%</span>
                            <span class="stat-label">Team Efficiency</span>
                        </div>
                    </div>
                </div>
                
                <div class="team-members">
                    ${this.renderTeamMembers(teamData.members || [])}
                </div>
            `;

        } catch (error) {
            console.error('Team Overview rendering error:', error);
            teamOverviewElement.innerHTML = `
                <div class="error-message">
                    <h3>Failed to load team overview</h3>
                    <p>${error.message}</p>
                    <button onclick="dataService.renderTeamOverview()" class="btn btn-primary">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    // Enhanced Team Ranking renderer
    async renderTeamRanking() {
        const teamRankingElement = document.getElementById('team-ranking');
        if (!teamRankingElement) return;

        // Show loading state
        teamRankingElement.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                Loading team ranking...
            </div>
        `;

        try {
            const cacheKey = 'team_ranking';
            let rankingData = this.getCachedData(cacheKey);
            
            if (!rankingData) {
                const response = await this.apiCall('/api/v2/dashboard/team-ranking');
                rankingData = response.data;
                this.setCachedData(cacheKey, rankingData);
            }

            teamRankingElement.innerHTML = `
                <div class="page-header">
                    <h1 class="page-title">Team Ranking</h1>
                    <p class="page-subtitle">Performance ranking and scoring</p>
                </div>
                
                <div class="ranking-list">
                    ${this.renderRankingList(rankingData.rankings || [])}
                </div>
            `;

        } catch (error) {
            console.error('Team Ranking rendering error:', error);
            teamRankingElement.innerHTML = `
                <div class="error-message">
                    <h3>Failed to load team ranking</h3>
                    <p>${error.message}</p>
                    <button onclick="dataService.renderTeamRanking()" class="btn btn-primary">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    // Helper methods for rendering components
    renderKPICards(kpiData, userRole) {
        const cards = [];
        
        if (userRole === 'Manager') {
            cards.push(`
                <div class="kpi-card">
                    <div class="kpi-icon tasks">📋</div>
                    <div class="kpi-content">
                        <div class="kpi-value">${kpiData.totalTasks || 0}</div>
                        <div class="kpi-label">Total Tasks</div>
                    </div>
                </div>
            `);
        } else if (userRole === 'Team Lead') {
            cards.push(`
                <div class="kpi-card">
                    <div class="kpi-icon tasks">📋</div>
                    <div class="kpi-content">
                        <div class="kpi-value">${kpiData.teamTasks || 0}</div>
                        <div class="kpi-label">Team Tasks</div>
                    </div>
                </div>
            `);
        } else {
            cards.push(`
                <div class="kpi-card">
                    <div class="kpi-icon tasks">📋</div>
                    <div class="kpi-content">
                        <div class="kpi-value">${kpiData.myTasks || 0}</div>
                        <div class="kpi-label">My Tasks</div>
                    </div>
                </div>
            `);
        }

        cards.push(`
            <div class="kpi-card">
                <div class="kpi-icon completed">✅</div>
                <div class="kpi-content">
                    <div class="kpi-value">${kpiData.completedTasks || 0}</div>
                    <div class="kpi-label">Completed</div>
                </div>
            </div>
        `);

        return cards.join('');
    }

    renderTasksList(tasks) {
        if (!tasks || tasks.length === 0) {
            return '<div class="no-data">No tasks found</div>';
        }

        return tasks.map(task => `
            <div class="task-item">
                <div class="task-title">${task.title}</div>
                <div class="task-status status-${task.status}">${task.status}</div>
                <div class="task-priority priority-${task.priority}">${task.priority}</div>
                <div class="task-due">${task.due_date}</div>
            </div>
        `).join('');
    }

    renderTeamMembers(members) {
        if (!members || members.length === 0) {
            return '<div class="no-data">No team members found</div>';
        }

        return members.map(member => `
            <div class="member-card">
                <div class="member-avatar">${member.name.charAt(0)}</div>
                <div class="member-info">
                    <div class="member-name">${member.name}</div>
                    <div class="member-role">${member.role}</div>
                    <div class="member-stats">
                        <span>Tasks: ${member.tasks}</span>
                        <span>Completed: ${member.completed}</span>
                        <span>Efficiency: ${member.efficiency}%</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderRankingList(rankings) {
        if (!rankings || rankings.length === 0) {
            return '<div class="no-data">No ranking data available</div>';
        }

        return rankings.map(item => `
            <div class="ranking-item">
                <div class="ranking-position">#${item.rank}</div>
                <div class="ranking-user">
                    <div class="user-avatar">${item.name.charAt(0)}</div>
                    <div class="user-info">
                        <div class="user-name">${item.name}</div>
                        <div class="user-stats">
                            <span>Score: ${item.score}</span>
                            <span>Tasks: ${item.tasks}</span>
                            <span>Completed: ${item.completed}</span>
                        </div>
                    </div>
                </div>
                <div class="ranking-score">${item.score}</div>
            </div>
        `).join('');
    }

    renderDashboardSections(data, userRole) {
        // Role-specific dashboard sections
        if (userRole === 'Manager') {
            return `
                <div class="dashboard-section">
                    <h3>System Overview</h3>
                    <div class="system-stats">
                        <p>Total Team Members: ${data.team?.totalMembers || 0}</p>
                        <p>Active Projects: ${data.team?.activeProjects || 0}</p>
                        <p>Completion Rate: ${data.team?.completionRate || 0}%</p>
                    </div>
                </div>
            `;
        } else if (userRole === 'Team Lead') {
            return `
                <div class="dashboard-section">
                    <h3>Team Management</h3>
                    <div class="team-stats">
                        <p>Team Members: ${data.team?.teamMembers || 0}</p>
                        <p>Active Projects: ${data.team?.activeProjects || 0}</p>
                        <p>Completion Rate: ${data.team?.completionRate || 0}%</p>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="dashboard-section">
                    <h3>Personal Overview</h3>
                    <div class="personal-stats">
                        <p>Personal Efficiency: ${data.personal?.efficiency || 0}%</p>
                        <p>Upcoming Deadlines: ${data.personal?.upcomingDeadlines?.length || 0}</p>
                    </div>
                </div>
            `;
        }
    }
}

// Initialize data service
const dataService = new DataIntegrationService();

// Enhanced render functions that use the data service
async function renderDashboard() {
    await dataService.renderDashboard();
}

async function renderMyTasks() {
    await dataService.renderMyTasks();
}

async function renderTeamOverview() {
    await dataService.renderTeamOverview();
}

async function renderTeamRanking() {
    await dataService.renderTeamRanking();
}

// Auto-refresh data every 5 minutes
setInterval(() => {
    dataService.cache.clear();
    console.log('Data cache cleared for refresh');
}, 5 * 60 * 1000);

console.log('✅ Data Integration Service initialized');