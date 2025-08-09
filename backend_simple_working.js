const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 777;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'TaskFlow Backend - Simple Working',
        version: '1.0.0-simple'
    });
});

// Mock ClickUp data endpoint
app.get('/api/v1/test/clickup-data', async (req, res) => {
    try {
        // Return mock data that matches the structure expected by frontend
        const mockData = {
            success: true,
            data: {
                source: 'Mock Data (API Integration Ready)',
                user: {
                    id: 'user-001',
                    username: 'TaskFlow Manager',
                    email: 'manager@taskflow.com',
                    profilePicture: null
                },
                teams: [
                    {
                        id: 'team-001',
                        name: 'Development Team',
                        color: '#2563eb'
                    },
                    {
                        id: 'team-002', 
                        name: 'Design Team',
                        color: '#059669'
                    }
                ],
                tasks: [
                    {
                        id: 'task-001',
                        name: 'ออกแบบระบบ Dashboard',
                        status: { status: 'in progress', color: '#f59e0b' },
                        priority: { priority: 'high' },
                        assignees: [
                            { id: 'emp-001', username: 'กิตติพงษ์ สมศรี', email: 'kitt@company.com' }
                        ],
                        due_date: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days from now
                    },
                    {
                        id: 'task-002',
                        name: 'พัฒนา API Authentication',
                        status: { status: 'complete', color: '#059669' },
                        priority: { priority: 'high' },
                        assignees: [
                            { id: 'emp-002', username: 'นภัสสร จันทร์เพ็ญ', email: 'naphat@company.com' }
                        ],
                        due_date: Date.now() - (2 * 24 * 60 * 60 * 1000) // 2 days ago
                    },
                    {
                        id: 'task-003',
                        name: 'ทดสอบระบบ Login',
                        status: { status: 'in progress', color: '#f59e0b' },
                        priority: { priority: 'medium' },
                        assignees: [
                            { id: 'emp-003', username: 'สมชาย วงษ์ใหญ่', email: 'somchai@company.com' }
                        ],
                        due_date: Date.now() + (3 * 24 * 60 * 60 * 1000) // 3 days from now
                    },
                    {
                        id: 'task-004',
                        name: 'สร้างฐานข้อมูล Users',
                        status: { status: 'complete', color: '#059669' },
                        priority: { priority: 'high' },
                        assignees: [
                            { id: 'emp-004', username: 'อรุณ ใจดี', email: 'arun@company.com' }
                        ],
                        due_date: Date.now() - (5 * 24 * 60 * 60 * 1000) // 5 days ago
                    },
                    {
                        id: 'task-005',
                        name: 'อัพเดท UI/UX Design',
                        status: { status: 'to do', color: '#6b7280' },
                        priority: { priority: 'medium' },
                        assignees: [
                            { id: 'emp-005', username: 'มานี เก่งมาก', email: 'manee@company.com' }
                        ],
                        due_date: Date.now() + (10 * 24 * 60 * 60 * 1000) // 10 days from now
                    },
                    {
                        id: 'task-006',
                        name: 'เขียนเอกสาร API',
                        status: { status: 'to do', color: '#6b7280' },
                        priority: { priority: 'low' },
                        assignees: [
                            { id: 'emp-006', username: 'วิภา ช่วยเหลือ', email: 'wippa@company.com' }
                        ],
                        due_date: Date.now() + (14 * 24 * 60 * 60 * 1000) // 14 days from now
                    },
                    {
                        id: 'task-007',
                        name: 'ทดสอบระบบ Task Management',
                        status: { status: 'in progress', color: '#f59e0b' },
                        priority: { priority: 'medium' },
                        assignees: [
                            { id: 'emp-001', username: 'กิตติพงษ์ สมศรี', email: 'kitt@company.com' }
                        ],
                        due_date: Date.now() + (5 * 24 * 60 * 60 * 1000) // 5 days from now
                    },
                    {
                        id: 'task-008',
                        name: 'สร้างระบบ Notification',
                        status: { status: 'to do', color: '#6b7280' },
                        priority: { priority: 'low' },
                        assignees: [
                            { id: 'emp-003', username: 'สมชาย วงษ์ใหญ่', email: 'somchai@company.com' }
                        ],
                        due_date: Date.now() + (21 * 24 * 60 * 60 * 1000) // 21 days from now
                    }
                ],
                workload: {
                    totalTasks: 8,
                    completedTasks: 2,
                    inProgressTasks: 3,
                    overdueTasks: 1
                }
            }
        };

        console.log(`[${new Date().toISOString()}] ClickUp data requested - returning mock data`);
        res.json(mockData);

    } catch (error) {
        console.error('Error serving ClickUp data:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 TaskFlow Backend (Simple Working) running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 ClickUp Data: http://localhost:${PORT}/api/v1/test/clickup-data`);
    console.log(`⚡ Ready to serve mock data to frontend!`);
});

module.exports = app;