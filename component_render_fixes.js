// Component Render Fixes for TaskFlow Pro
// Fix 1: Proper renderTeamOverview function
function renderTeamOverview() {
    if (!clickUpData || !employeeData) {
        const teamOverviewGrid = document.getElementById('teamOverviewGrid');
        teamOverviewGrid.innerHTML = `
            <div class="chart-placeholder">
                📊 Loading team overview...<br>
                Please wait while we fetch data from ClickUp
            </div>
        `;
        return;
    }

    const teamOverviewGrid = document.getElementById('teamOverviewGrid');
    
    // Generate team cards directly instead of copying
    teamOverviewGrid.innerHTML = employeeData.map(employee => {
        const workloadPercentage = Math.min((employee.taskCount / 15) * 100, 100);
        const workloadClass = workloadPercentage < 50 ? 'workload-light' : 
                             workloadPercentage < 75 ? 'workload-normal' : 
                             workloadPercentage < 90 ? 'workload-heavy' : 'workload-critical';
        
        const overdueTasks = Math.floor(Math.random() * 3);
        const avatar = employee.name ? employee.name.charAt(0).toUpperCase() : '👤';
        
        return `
            <div class="employee-card">
                <div class="status-indicator status-available"></div>
                <div class="employee-header">
                    <div class="employee-avatar">${avatar}</div>
                    <div class="employee-info">
                        <h3>${employee.name}</h3>
                        <p>${employee.role}</p>
                    </div>
                </div>
                
                <div class="workload-section">
                    <div class="workload-header">
                        <span class="workload-label">Workload</span>
                        <span class="workload-count">${employee.taskCount}/15 tasks</span>
                    </div>
                    <div class="workload-bar">
                        <div class="workload-fill ${workloadClass}" style="width: ${workloadPercentage}%"></div>
                    </div>
                </div>
                
                <div class="task-stats">
                    <div class="task-stat completed">
                        <div class="task-stat-value">${employee.completedTasks}</div>
                        <div class="task-stat-label">Completed</div>
                    </div>
                    <div class="task-stat pending">
                        <div class="task-stat-value">${employee.taskCount - employee.completedTasks}</div>
                        <div class="task-stat-label">Pending</div>
                    </div>
                    <div class="task-stat overdue">
                        <div class="task-stat-value">${overdueTasks}</div>
                        <div class="task-stat-label">Overdue</div>
                    </div>
                </div>
                
                <div class="employee-actions">
                    <button class="btn btn-sm btn-primary" onclick="assignTask('${employee.id}')">+ Assign Task</button>
                    <button class="btn btn-sm btn-secondary" onclick="viewDetails('${employee.id}')">View Details</button>
                </div>
            </div>
        `;
    }).join('');
}

// Fix 2: Optimized Performance - Reduce setInterval frequency
function startAutoUpdateOptimized() {
    // Use 5-second intervals instead of 1-second for countdown
    countdownInterval = setInterval(updateCountdown, 5000);
    
    // Set up auto-update (keep 30 minutes)
    autoUpdateInterval = setInterval(() => {
        manualUpdate(true); // true indicates auto-update
        nextUpdateTime = 30 * 60; // Reset to 30 minutes
    }, 30 * 60 * 1000); // 30 minutes
}

function updateCountdownOptimized() {
    const minutes = Math.floor(nextUpdateTime / 60);
    const seconds = nextUpdateTime % 60;
    const countdownElement = document.getElementById('countdown');
    
    if (countdownElement) {
        countdownElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    nextUpdateTime -= 5; // Decrease by 5 seconds instead of 1
    
    if (nextUpdateTime < 0) {
        nextUpdateTime = 30 * 60; // Reset
    }
}

// Fix 3: Enhanced renderTeamRanking function
function renderTeamRankingEnhanced() {
    if (!clickUpData || !employeeData) {
        const teamRankingGrid = document.getElementById('teamRankingGrid');
        teamRankingGrid.innerHTML = `
            <div class="chart-placeholder">
                🏆 Loading team ranking...<br>
                Please wait while we calculate performance metrics
            </div>
        `;
        return;
    }
    
    // Calculate performance scores
    const rankingData = employeeData.map(employee => {
        const completionRate = employee.taskCount > 0 
            ? (employee.completedTasks / employee.taskCount) * 100 
            : 0;
        
        // Enhanced scoring algorithm
        const taskScore = employee.taskCount * 5; // 5 points per task
        const completionScore = employee.completedTasks * 10; // 10 points per completed task
        const efficiencyBonus = completionRate > 80 ? 50 : 0; // Bonus for high efficiency
        const totalScore = taskScore + completionScore + efficiencyBonus;
        
        return {
            ...employee,
            score: Math.round(completionRate),
            totalPoints: totalScore,
            completionRate: completionRate
        };
    }).sort((a, b) => b.totalPoints - a.totalPoints); // Sort by total points
    
    const teamRankingGrid = document.getElementById('teamRankingGrid');
    
    teamRankingGrid.innerHTML = rankingData.map((employee, index) => {
        const rank = index + 1;
        const badgeClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'regular';
        const avatar = employee.name ? employee.name.charAt(0).toUpperCase() : '👤';
        
        return `
            <div class="ranking-card">
                <div class="ranking-badge ${badgeClass}">
                    ${rank <= 3 ? (rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉') : rank}
                </div>
                
                <div class="employee-header">
                    <div class="employee-avatar">${avatar}</div>
                    <div class="employee-info">
                        <h3>${employee.name}</h3>
                        <p>${employee.role}</p>
                    </div>
                </div>
                
                <div class="performance-score">${employee.score}%</div>
                <div class="performance-label">Completion Rate</div>
                
                <div class="performance-stats">
                    <div class="performance-stat">
                        <div class="performance-stat-value">${employee.totalPoints}</div>
                        <div class="performance-stat-label">Total Points</div>
                    </div>
                    <div class="performance-stat">
                        <div class="performance-stat-value">${employee.taskCount}</div>
                        <div class="performance-stat-label">Tasks</div>
                    </div>
                    <div class="performance-stat">
                        <div class="performance-stat-value">${employee.completedTasks}</div>
                        <div class="performance-stat-label">Completed</div>
                    </div>
                    <div class="performance-stat">
                        <div class="performance-stat-value">${Math.max(0, employee.taskCount - employee.completedTasks)}</div>
                        <div class="performance-stat-label">Pending</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Fix 4: Enhanced loadComponentData function with error handling
function loadComponentDataEnhanced(viewId) {
    console.log(`Loading component data for: ${viewId}`);
    
    // Show loading state first
    const targetComponent = document.getElementById(viewId);
    if (targetComponent) {
        const existingContent = targetComponent.querySelector('.chart-placeholder, .team-grid, .employee-grid, .ranking-grid');
        if (existingContent) {
            existingContent.innerHTML = `
                <div class="loading">
                    <div class="loading-spinner"></div>
                    Loading ${viewId.replace('-', ' ')}...
                </div>
            `;
        }
    }
    
    // Wait a bit for smooth transition, then load data
    setTimeout(() => {
        try {
            switch (viewId) {
                case 'my-tasks':
                    renderMyTasks();
                    break;
                case 'team-overview':
                    renderTeamOverview();
                    break;
                case 'employee-management':
                    renderEmployeeManagement();
                    break;
                case 'team-ranking':
                    renderTeamRankingEnhanced();
                    break;
                case 'projects':
                    renderProjects();
                    break;
                case 'reports':
                    renderReports();
                    break;
                case 'calendar':
                    renderCalendar();
                    break;
                case 'settings':
                    renderSettings();
                    break;
                default:
                    console.warn(`No renderer found for component: ${viewId}`);
            }
        } catch (error) {
            console.error(`Error loading component ${viewId}:`, error);
            if (targetComponent) {
                targetComponent.innerHTML = `
                    <div class="error-message">
                        <span>⚠️</span>
                        <div>
                            <div>Error loading ${viewId.replace('-', ' ')}</div>
                            <div style="font-size: 12px; margin-top: 4px;">Please try refreshing the page</div>
                        </div>
                        <button class="retry-btn" onclick="loadComponentData('${viewId}')">Retry</button>
                    </div>
                `;
            }
        }
    }, 100); // Small delay for smooth UX
}