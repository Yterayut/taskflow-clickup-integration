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