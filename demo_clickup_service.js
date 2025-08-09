// Demo ClickUp API Service - สำหรับกรณีที่ไม่มี token จริง
// จะจำลอง API response ที่เหมือนจริงแต่ใช้ข้อมูลจริงจากโปรเจคอื่นๆ

const axios = require('axios');

class DemoClickUpService {
    constructor() {
        this.demoData = {
            teams: [
                {
                    id: "team_12345",
                    name: "TaskFlow Development Team",
                    color: "#2563eb",
                    members: [
                        {
                            user: {
                                id: "user_001",
                                username: "yterayut",
                                email: "yterayut@gmail.com", 
                                color: "#6366f1",
                                initials: "TY"
                            },
                            role: 1
                        },
                        {
                            user: {
                                id: "user_002", 
                                username: "chaiwut",
                                email: "chaiwutwck@gmail.com",
                                color: "#10b981",
                                initials: "CW"
                            },
                            role: 2
                        }
                    ]
                }
            ],
            spaces: [
                {
                    id: "space_001",
                    name: "TaskFlow Pro Development",
                    color: "#7c3aed",
                    private: false,
                    statuses: [
                        { status: "to do", color: "#6b7280" },
                        { status: "in progress", color: "#f59e0b" },
                        { status: "review", color: "#3b82f6" },
                        { status: "complete", color: "#10b981" }
                    ]
                },
                {
                    id: "space_002", 
                    name: "System Enhancement",
                    color: "#ef4444",
                    private: false,
                    statuses: [
                        { status: "planning", color: "#8b5cf6" },
                        { status: "development", color: "#f59e0b" },
                        { status: "testing", color: "#06b6d4" },
                        { status: "deployed", color: "#10b981" }
                    ]
                }
            ],
            lists: [
                {
                    id: "list_001",
                    name: "Backend Development",
                    status: "active",
                    task_count: 12
                },
                {
                    id: "list_002", 
                    name: "Frontend Features",
                    status: "active",
                    task_count: 8
                },
                {
                    id: "list_003",
                    name: "Database Integration", 
                    status: "active",
                    task_count: 6
                }
            ],
            tasks: [
                // Backend Development Tasks
                {
                    id: "task_001",
                    list: { id: "list_001" },
                    name: "Implement Real ClickUp Data Integration",
                    description: "Create real-time sync service for ClickUp API data",
                    status: { status: "complete" },
                    priority: { id: 1 },
                    assignees: [{ id: "user_001", username: "yterayut" }],
                    due_date: Date.now() + (2 * 24 * 60 * 60 * 1000), // 2 days from now
                    time_estimate: 28800000, // 8 hours in milliseconds
                    time_spent: 25200000,    // 7 hours spent
                    tags: ["backend", "clickup", "integration"]
                },
                {
                    id: "task_002",
                    list: { id: "list_001" },
                    name: "Fix Authentication Token Issues",
                    description: "Resolve ClickUp API token authentication problems",
                    status: { status: "in progress" },
                    priority: { id: 1 },
                    assignees: [{ id: "user_001", username: "yterayut" }],
                    due_date: Date.now() + (1 * 24 * 60 * 60 * 1000),
                    time_estimate: 14400000, // 4 hours
                    time_spent: 7200000,     // 2 hours spent
                    tags: ["backend", "auth", "urgent"]
                },
                {
                    id: "task_003",
                    list: { id: "list_001" },
                    name: "Background Sync Service Implementation", 
                    description: "Smart multi-interval sync (2/10/60 minutes)",
                    status: { status: "complete" },
                    priority: { id: 2 },
                    assignees: [{ id: "user_001", username: "yterayut" }],
                    due_date: Date.now() - (1 * 24 * 60 * 60 * 1000), // 1 day ago
                    time_estimate: 21600000, // 6 hours
                    time_spent: 19800000,    // 5.5 hours spent
                    tags: ["backend", "sync", "performance"]
                },
                {
                    id: "task_004",
                    list: { id: "list_001" },
                    name: "Database Schema Enhancement",
                    description: "Add parent_id for subtasks and performance indexes",
                    status: { status: "complete" },
                    priority: { id: 2 },
                    assignees: [{ id: "user_002", username: "chaiwut" }],
                    due_date: Date.now() - (2 * 24 * 60 * 60 * 1000),
                    time_estimate: 18000000, // 5 hours
                    time_spent: 16200000,    // 4.5 hours spent
                    tags: ["database", "schema", "optimization"]
                },

                // Frontend Features Tasks  
                {
                    id: "task_005",
                    list: { id: "list_002" },
                    name: "Component-specific Data Filtering",
                    description: "Implement data filtering for My Tasks, Team Overview, Projects",
                    status: { status: "complete" },
                    priority: { id: 2 },
                    assignees: [{ id: "user_001", username: "yterayut" }],
                    due_date: Date.now() + (3 * 24 * 60 * 60 * 1000),
                    time_estimate: 25200000, // 7 hours
                    time_spent: 21600000,    // 6 hours spent
                    tags: ["frontend", "components", "filtering"]
                },
                {
                    id: "task_006",
                    list: { id: "list_002" },
                    name: "User Menu with Logout Functionality",
                    description: "Add user dropdown menu with profile and logout options",
                    status: { status: "complete" },
                    priority: { id: 3 },
                    assignees: [{ id: "user_001", username: "yterayut" }],
                    due_date: Date.now() + (1 * 24 * 60 * 60 * 1000),
                    time_estimate: 10800000, // 3 hours
                    time_spent: 9000000,     // 2.5 hours spent  
                    tags: ["frontend", "auth", "ui"]
                },
                {
                    id: "task_007",
                    list: { id: "list_002" },
                    name: "Real-time Data Source Indicator",
                    description: "Show users if data is real ClickUp or sample data",
                    status: { status: "complete" },
                    priority: { id: 3 },
                    assignees: [{ id: "user_002", username: "chaiwut" }],
                    due_date: Date.now() + (2 * 24 * 60 * 60 * 1000),
                    time_estimate: 7200000,  // 2 hours
                    time_spent: 6300000,     // 1.75 hours spent
                    tags: ["frontend", "indicator", "ux"]
                },

                // Database Integration Tasks
                {
                    id: "task_008", 
                    list: { id: "list_003" },
                    name: "SQLite Production Database Setup",
                    description: "Configure SQLite for production with ACID compliance",
                    status: { status: "complete" },
                    priority: { id: 1 },
                    assignees: [{ id: "user_002", username: "chaiwut" }],
                    due_date: Date.now() - (3 * 24 * 60 * 60 * 1000),
                    time_estimate: 32400000, // 9 hours
                    time_spent: 28800000,    // 8 hours spent
                    tags: ["database", "sqlite", "production"]
                },
                {
                    id: "task_009",
                    list: { id: "list_003" },
                    name: "Task and Subtask Separation Logic",
                    description: "Implement parent_id logic for proper task hierarchy",
                    status: { status: "complete" },
                    priority: { id: 2 },
                    assignees: [{ id: "user_001", username: "yterayut" }],
                    due_date: Date.now() - (1 * 24 * 60 * 60 * 1000),
                    time_estimate: 14400000, // 4 hours
                    time_spent: 12600000,    // 3.5 hours spent
                    tags: ["database", "logic", "hierarchy"]
                },

                // Additional tasks for realistic data
                {
                    id: "task_010",
                    list: { id: "list_001" },
                    name: "API Response Optimization",
                    description: "Optimize backend API response times to <100ms",
                    status: { status: "in progress" },
                    priority: { id: 2 },
                    assignees: [{ id: "user_002", username: "chaiwut" }],
                    due_date: Date.now() + (4 * 24 * 60 * 60 * 1000),
                    time_estimate: 18000000, // 5 hours
                    time_spent: 7200000,     // 2 hours spent
                    tags: ["backend", "performance", "optimization"]
                },
                {
                    id: "task_011",
                    list: { id: "list_002" },
                    name: "Mobile Responsive Design Enhancement",
                    description: "Improve mobile experience for TaskFlow Pro",
                    status: { status: "to do" },
                    priority: { id: 3 },
                    assignees: [{ id: "user_001", username: "yterayut" }],
                    due_date: Date.now() + (7 * 24 * 60 * 60 * 1000),
                    time_estimate: 21600000, // 6 hours
                    time_spent: 0,
                    tags: ["frontend", "mobile", "responsive"]
                },
                {
                    id: "task_012",
                    list: { id: "list_003" },
                    name: "Database Performance Monitoring",
                    description: "Add comprehensive database performance tracking",
                    status: { status: "to do" },
                    priority: { id: 3 },
                    assignees: [{ id: "user_002", username: "chaiwut" }],
                    due_date: Date.now() + (5 * 24 * 60 * 60 * 1000),
                    time_estimate: 16200000, // 4.5 hours
                    time_spent: 0,
                    tags: ["database", "monitoring", "performance"]
                }
            ]
        };
    }

    // Simulate ClickUp API calls with demo data
    async simulateApiCall(endpoint, params = {}) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 300));
        
        console.log(`[${new Date().toISOString()}] 📡 Demo ClickUp API call: ${endpoint}`);
        return { data: this.getDemoDataForEndpoint(endpoint, params) };
    }

    getDemoDataForEndpoint(endpoint, params) {
        if (endpoint.includes('/team')) {
            if (endpoint.includes('/space')) {
                // Get spaces for team
                return { spaces: this.demoData.spaces };
            } else if (endpoint.endsWith('/team')) {
                // Get teams
                return { teams: this.demoData.teams };
            } else {
                // Get specific team with members
                return { 
                    team: {
                        ...this.demoData.teams[0],
                        members: this.demoData.teams[0].members
                    }
                };
            }
        }
        
        if (endpoint.includes('/space') && endpoint.includes('/list')) {
            // Get lists for space
            return { lists: this.demoData.lists };
        }
        
        if (endpoint.includes('/list') && endpoint.includes('/task')) {
            // Get tasks for list - filter by list if specified
            const listId = endpoint.match(/list\/([^\/]+)/)?.[1];
            let tasks = this.demoData.tasks;
            
            if (listId) {
                tasks = tasks.filter(task => task.list.id === listId);
            }
            
            // Add subtasks for some tasks
            const tasksWithSubtasks = tasks.map(task => {
                if (task.id === 'task_001') {
                    // Add subtasks for main task
                    task.subtasks = [
                        {
                            id: `${task.id}_sub1`,
                            list: task.list,
                            name: "Setup API Authentication",
                            status: { status: "complete" },
                            priority: { id: 2 },
                            assignees: task.assignees,
                            time_spent: 3600000 // 1 hour
                        },
                        {
                            id: `${task.id}_sub2`,
                            list: task.list,
                            name: "Implement Data Fetching",
                            status: { status: "complete" },
                            priority: { id: 2 },
                            assignees: task.assignees,
                            time_spent: 5400000 // 1.5 hours
                        }
                    ];
                }
                return task;
            });
            
            return { tasks: tasksWithSubtasks };
        }
        
        return {};
    }

    // Get comprehensive demo statistics
    getDemoStats() {
        const tasks = this.demoData.tasks;
        const teams = this.demoData.teams;
        
        return {
            teams: teams.length,
            spaces: this.demoData.spaces.length,
            lists: this.demoData.lists.length,
            tasks: tasks.length,
            subtasks: 2, // From task_001
            members: teams.reduce((sum, team) => sum + team.members.length, 0),
            lastSync: {
                high: new Date().toISOString(),
                medium: new Date().toISOString(),
                low: new Date().toISOString()
            },
            hasAccessToken: true, // Demo mode
            demoMode: true
        };
    }
}

module.exports = { DemoClickUpService };