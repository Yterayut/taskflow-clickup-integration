        // Load local/mock data for regular users (non-OAuth)
        function loadLocalData() {
            console.log('Loading local data for regular user...');
            
            // Create mock ClickUp data structure
            const mockClickUpData = {
                source: 'Local Data - Team Management System',
                user: {
                    id: 'local_user',
                    username: 'Team User',
                    email: 'user@company.com'
                },
                teams: [{
                    id: 'local_team',
                    name: 'One Climate Development Team',
                    members: []
                }],
                tasks: [],
                workload: {
                    totalTasks: 0,
                    completedTasks: 0,
                    inProgressTasks: 0,
                    overdueTasks: 0
                },
                analytics: {
                    completion_rate: 0,
                    tasks_by_status: {
                        complete: 0,
                        'in progress': 0,
                        'to do': 0
                    },
                    tasks_by_priority: {
                        high: 0,
                        normal: 0,
                        low: 0,
                        urgent: 0,
                        'no priority': 0
                    }
                },
                fetched_at: new Date().toISOString()
            };
            
            // Set global data
            clickUpData = mockClickUpData;
            
            // Process employee data from users_config
            processEmployeeDataLocal();
            
            // Populate UI with local data
            populateKPIsLocal(mockClickUpData);
            populateTeamDataLocal(mockClickUpData);
            populateActivityFeedLocal(mockClickUpData);
            updateLastUpdated();
            
            showContent();
            
            console.log('Local data loaded successfully');
        }
        
        // Process employee data for local users
        function processEmployeeDataLocal() {
            employeeData = [
                {
                    id: 'emp_1',
                    name: 'ชัยวุฒิ ไวเชิงค้า',
                    role: 'Team Lead',
                    department: 'Development',
                    email: 'chaiwutwck@gmail.com',
                    taskCount: 8,
                    completedTasks: 6,
                    pendingTasks: 2,
                    overdueTasks: 0
                },
                {
                    id: 'emp_2', 
                    name: 'Athakorn NATUNG',
                    role: 'Developer',
                    department: 'Development',
                    email: 'atthakorn.na@ku.th',
                    taskCount: 12,
                    completedTasks: 8,
                    pendingTasks: 4,
                    overdueTasks: 1
                },
                {
                    id: 'emp_3',
                    name: 'มัทนพร แก้วอำไพ',
                    role: 'Developer',
                    department: 'Development', 
                    email: 'primshi1719@gmail.com',
                    taskCount: 10,
                    completedTasks: 7,
                    pendingTasks: 3,
                    overdueTasks: 0
                },
                {
                    id: 'emp_4',
                    name: 'PANUWAT PROMRAKSA',
                    role: 'Developer',
                    department: 'Development',
                    email: 'panuwantung@gmail.com',
                    taskCount: 6,
                    completedTasks: 4,
                    pendingTasks: 2,
                    overdueTasks: 0
                },
                {
                    id: 'emp_5',
                    name: 'Thammakit Ch',
                    role: 'Developer',
                    department: 'Development',
                    email: 'jthammakit2546@gmail.com',
                    taskCount: 9,
                    completedTasks: 5,
                    pendingTasks: 3,
                    overdueTasks: 1
                }
            ];
        }
        
        // Populate KPIs with local data
        function populateKPIsLocal(data) {
            const totalTasks = employeeData.reduce((sum, emp) => sum + emp.taskCount, 0);
            const completedTasks = employeeData.reduce((sum, emp) => sum + emp.completedTasks, 0);
            const overdueTasks = employeeData.reduce((sum, emp) => sum + emp.overdueTasks, 0);
            const efficiency = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            
            document.getElementById('totalTasks').textContent = totalTasks;
            document.getElementById('completedTasks').textContent = completedTasks;
            document.getElementById('overdueTasks').textContent = overdueTasks;
            document.getElementById('teamEfficiency').textContent = efficiency + '%';
            
            // Update data source indicators
            document.querySelectorAll('.kpi-card .kpi-label').forEach(label => {
                if (label.textContent.includes('ClickUp')) {
                    label.innerHTML = '📊 From Local Data';
                    label.style.color = '#059669';
                }
            });
        }
        
        // Populate team data with local employee data
        function populateTeamDataLocal(data) {
            const teamGrid = document.getElementById('teamGrid');
            
            teamGrid.innerHTML = employeeData.map(employee => {
                const workloadPercentage = Math.min((employee.taskCount / 15) * 100, 100);
                const workloadClass = workloadPercentage < 50 ? 'workload-light' : 
                                     workloadPercentage < 75 ? 'workload-normal' : 
                                     workloadPercentage < 90 ? 'workload-heavy' : 'workload-critical';
                
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
                                <div class="task-stat-value">${employee.pendingTasks}</div>
                                <div class="task-stat-label">Pending</div>
                            </div>
                            <div class="task-stat overdue">
                                <div class="task-stat-value">${employee.overdueTasks}</div>
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
        
        // Populate activity feed with local data
        function populateActivityFeedLocal(data) {
            const activities = [
                { icon: 'completed', text: 'มัทนพร แก้วอำไพ completed "API Integration"', time: '2 minutes ago' },
                { icon: 'assigned', text: 'New task assigned to ชัยวุฒิ ไวเชิงค้า', time: '15 minutes ago' },
                { icon: 'completed', text: 'PANUWAT PROMRAKSA completed "Database Setup"', time: '1 hour ago' },
                { icon: 'assigned', text: 'Thammakit Ch started working on "Frontend Development"', time: '2 hours ago' },
                { icon: 'completed', text: 'Athakorn NATUNG completed "Code Review"', time: '3 hours ago' }
            ];
            
            const activityFeed = document.getElementById('activityFeed');
            if (activityFeed) {
                activityFeed.innerHTML = activities.map(activity => `
                    <div class="activity-item">
                        <div class="activity-icon ${activity.icon}">
                            ${activity.icon === 'completed' ? '✅' : activity.icon === 'assigned' ? '📋' : '🔄'}
                        </div>
                        <div class="activity-content">
                            <div class="activity-text">${activity.text}</div>
                            <div class="activity-time">${activity.time}</div>
                        </div>
                    </div>
                `).join('');
            }
        }