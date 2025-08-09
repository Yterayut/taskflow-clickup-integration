const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 777;

// CORS configuration
app.use(cors({
    origin: 'http://192.168.20.10:555',
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'TaskFlow Backend - ClickUp Integration',
    port: PORT.toString(),
    timestamp: new Date().toISOString(),
    version: '2.0.0-clickup'
  });
});

// API v1 routes
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'TaskFlow API v1 with ClickUp',
    timestamp: new Date().toISOString()
  });
});

// OAuth2 Authentication Routes
app.get('/api/v1/auth/clickup/auth-url', async (req, res) => {
  try {
    const client_id = 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL';
    const redirect_uri = 'http://192.168.20.10:777/api/v1/auth/clickup/callback';
    const state = Math.random().toString(36).substring(2);
    
    const authUrl = `https://app.clickup.com/api?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${state}`;
    
    res.json({
      authorization_url: authUrl,
      state: state,
      message: 'Redirect user to authorization_url to complete ClickUp authentication'
    });
  } catch (error) {
    console.error('OAuth authorization error:', error);
    res.status(500).json({ 
      error: 'Failed to generate authorization URL',
      message: error.message 
    });
  }
});

app.get('/api/v1/auth/clickup/authorize', async (req, res) => {
  try {
    const client_id = 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL';
    const redirect_uri = 'http://192.168.20.10:777/api/v1/auth/clickup/callback';
    const state = Math.random().toString(36).substring(2);
    
    const authUrl = `https://app.clickup.com/api?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${state}`;
    
    // Redirect directly to ClickUp OAuth
    res.redirect(authUrl);
  } catch (error) {
    console.error('OAuth authorization error:', error);
    res.status(500).json({ 
      error: 'Failed to generate authorization URL',
      message: error.message 
    });
  }
});

app.get('/api/v1/auth/clickup/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code not provided' });
    }

    // Exchange code for access token
    const client_id = 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL';
    const client_secret = 'BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX';
    
    const tokenResponse = await axios.post('https://api.clickup.com/api/v2/oauth/token', {
      client_id: client_id,
      client_secret: client_secret,
      code: code
    });
    
    const { access_token } = tokenResponse.data;
    
    // Redirect to frontend with success
    const redirectUrl = `http://192.168.20.10:555?auth=success&token=${access_token}`;
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    const redirectUrl = `http://192.168.20.10:555?auth=error&message=${encodeURIComponent(error.message)}`;
    res.redirect(redirectUrl);
  }
});

app.get('/api/v1/auth/status', async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) {
      return res.json({ authenticated: false });
    }
    
    // Verify token with ClickUp API
    const userResponse = await axios.get('https://api.clickup.com/api/v2/user', {
      headers: { 'Authorization': token }
    });
    
    res.json({
      authenticated: true,
      user: userResponse.data.user,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({ authenticated: false, error: error.message });
  }
});

app.post('/api/v1/auth/logout', async (req, res) => {
  try {
    // For now, just return success (token invalidation would be client-side)
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// Real ClickUp API endpoint
app.get('/api/v1/test/clickup-data', async (req, res) => {
  try {
    // Use real ClickUp API token
    const CLICKUP_TOKEN = '282686567_c5e69fe6e401704bc5ea0761cb568b5d271c0778db54bb7862315f8e1e81a2a8';
    
    if (CLICKUP_TOKEN) {
      // Try to fetch real data from ClickUp API
      try {
        
        const clickupApi = axios.create({
          baseURL: 'https://api.clickup.com/api/v2',
          headers: {
            'Authorization': CLICKUP_TOKEN,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });

        console.log('🔄 Fetching real ClickUp data...');

        // Get user info
        const userResponse = await clickupApi.get('/user');
        const user = userResponse.data.user;
        console.log(`👤 User: ${user.username} (${user.email})`);

        // Get teams
        const teamsResponse = await clickupApi.get('/team');
        const teams = teamsResponse.data.teams;
        console.log(`👥 Teams: ${teams.length} found`);

        // Get all tasks
        let allTasks = [];
        if (teams.length > 0) {
          const teamId = teams[0].id;
          console.log(`🔍 Searching tasks in team: ${teams[0].name}`);
          
          try {
            // Get team tasks directly
            const teamTasksResponse = await clickupApi.get(`/team/${teamId}/task?archived=false&subtasks=true&include_closed=true`);
            allTasks = allTasks.concat(teamTasksResponse.data.tasks || []);
            console.log(`📋 Team tasks: ${teamTasksResponse.data.tasks?.length || 0}`);
          } catch (error) {
            console.log('⚠️ Team tasks error:', error.message);
          }

          // Get tasks from spaces
          try {
            const spacesResponse = await clickupApi.get(`/team/${teamId}/space?archived=false`);
            const spaces = spacesResponse.data.spaces || [];
            console.log(`🏢 Spaces: ${spaces.length} found`);
            
            for (const space of spaces.slice(0, 3)) { // Limit to first 3 spaces
              try {
                const spaceTasksResponse = await clickupApi.get(`/space/${space.id}/task?archived=false&subtasks=true&include_closed=true`);
                allTasks = allTasks.concat(spaceTasksResponse.data.tasks || []);
                console.log(`📁 Space "${space.name}": ${spaceTasksResponse.data.tasks?.length || 0} tasks`);
              } catch (error) {
                console.log(`⚠️ Space ${space.name} error:`, error.message);
              }

              // Get folders and lists
              try {
                const foldersResponse = await clickupApi.get(`/space/${space.id}/folder?archived=false`);
                const folders = foldersResponse.data.folders || [];
                
                for (const folder of folders.slice(0, 2)) { // Limit folders
                  try {
                    const listsResponse = await clickupApi.get(`/folder/${folder.id}/list?archived=false`);
                    const lists = listsResponse.data.lists || [];
                    
                    for (const list of lists.slice(0, 3)) { // Limit lists
                      try {
                        const listTasksResponse = await clickupApi.get(`/list/${list.id}/task?archived=false&subtasks=true&include_closed=true`);
                        allTasks = allTasks.concat(listTasksResponse.data.tasks || []);
                        console.log(`📝 List "${list.name}": ${listTasksResponse.data.tasks?.length || 0} tasks`);
                      } catch (error) {
                        console.log(`⚠️ List ${list.name} error:`, error.message);
                      }
                    }
                  } catch (error) {
                    console.log(`⚠️ Folder ${folder.name} lists error:`, error.message);
                  }
                }
              } catch (error) {
                console.log(`⚠️ Space ${space.name} folders error:`, error.message);
              }
            }
          } catch (error) {
            console.log('⚠️ Spaces error:', error.message);
          }
        }

        // Remove duplicates
        const uniqueTasks = [];
        const seenIds = new Set();
        for (const task of allTasks) {
          if (!seenIds.has(task.id)) {
            seenIds.add(task.id);
            uniqueTasks.push(task);
          }
        }

        const tasks = uniqueTasks;
        console.log(`✅ Total unique tasks: ${tasks.length}`);

        // Calculate workload
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => {
          const status = t.status?.status?.toLowerCase() || '';
          return status.includes('complete') || status.includes('done') || status.includes('closed');
        }).length;
        
        const inProgressTasks = tasks.filter(t => {
          const status = t.status?.status?.toLowerCase() || '';
          return status.includes('progress') || status.includes('doing') || status.includes('active');
        }).length;
        
        const overdueTasks = tasks.filter(t => t.due_date && parseInt(t.due_date) < Date.now()).length;

        console.log(`📊 Stats: ${totalTasks} total, ${completedTasks} completed, ${inProgressTasks} in progress, ${overdueTasks} overdue`);

        // Transform real data
        const realClickUpData = {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            color: user.color || "#2563eb",
            profilePicture: user.profilePicture || `https://attachments.clickup.com/${user.id}/avatar.jpg`
          },
          teams: teams.map(team => ({
            id: team.id,
            name: team.name,
            color: team.color || "#2563eb",
            avatar: team.avatar || `https://attachments.clickup.com/${team.id}/team.jpg`
          })),
          tasks: tasks.map(task => ({
            id: task.id,
            name: task.name,
            status: task.status || { status: "pending", color: "#6b7280" },
            priority: task.priority || { priority: "3", color: "#6b7280" },
            assignees: task.assignees || [],
            due_date: task.due_date ? parseInt(task.due_date) : Date.now() + 86400000,
            time_estimate: task.time_estimate || 0
          })),
          workload: {
            totalTasks: totalTasks,
            completedTasks: completedTasks,
            inProgressTasks: inProgressTasks,
            todoTasks: totalTasks - completedTasks - inProgressTasks,
            overdueTasks: overdueTasks
          }
        };

        console.log(`🚀 Returning real ClickUp data`);

        res.json({
          success: true,
          data: realClickUpData,
          source: "real_clickup_api",
          timestamp: new Date().toISOString(),
          api_info: {
            total_requests: 'Multiple API calls to ClickUp',
            user: user.username,
            teams: teams.length,
            spaces_checked: Math.min(3, spaces?.length || 0)
          }
        });
        return;
        
      } catch (apiError) {
        console.error('❌ ClickUp API Error:', apiError.response?.data || apiError.message);
        console.log('🔄 Falling back to enhanced mock data...');
      }
    }

    // Fallback to enhanced mock data with Thai names
    console.log('📝 Using enhanced mock data with realistic team structure');
    
    const mockData = {
      user: {
        id: 90181167380,
        username: "ผู้จัดการทีม", 
        email: "manager@taskflow.com",
        color: "#2563eb",
        profilePicture: "https://attachments.clickup.com/90181167380/avatar.jpg"
      },
      teams: [{
        id: "90181167380",
        name: "ทีมพัฒนาระบบ TaskFlow",
        color: "#2563eb",
        avatar: "https://attachments.clickup.com/90181167380/team.jpg"
      }],
      tasks: [
        {
          id: "901808353632",
          name: "พัฒนาระบบ Dashboard",
          status: { status: "in progress", color: "#2563eb" },
          priority: { priority: "2", color: "#ff6b35" },
          assignees: [{ username: "กิตติพงษ์", id: 1001 }, { username: "นภัสสร", id: 1002 }],
          due_date: Date.now() + 86400000,
          time_estimate: 14400000
        },
        {
          id: "901808354618",
          name: "ทดสอบระบบ API", 
          status: { status: "completed", color: "#00d26b" },
          priority: { priority: "1", color: "#ff3d71" },
          assignees: [{ username: "มานี", id: 1003 }],
          due_date: Date.now() - 3600000,
          time_estimate: 21600000
        },
        {
          id: "901808354619",
          name: "ออกแบบ UI/UX",
          status: { status: "in progress", color: "#2563eb" },
          priority: { priority: "2", color: "#ff6b35" },
          assignees: [{ username: "นภัสสร", id: 1002 }],
          due_date: Date.now() + 172800000,
          time_estimate: 18000000
        },
        {
          id: "901808354620",
          name: "จัดทำเอกสารโปรเจค",
          status: { status: "todo", color: "#6b7280" },
          priority: { priority: "3", color: "#6b7280" },
          assignees: [{ username: "วิภา", id: 1004 }],
          due_date: Date.now() + 259200000,
          time_estimate: 10800000
        },
        {
          id: "901808354621",
          name: "รายงานความคืบหน้าประจำสัปดาห์",
          status: { status: "overdue", color: "#dc2626" },
          priority: { priority: "1", color: "#ff3d71" },
          assignees: [{ username: "สมชาย", id: 1005 }],
          due_date: Date.now() - 86400000,
          time_estimate: 7200000
        },
        {
          id: "901808354622",
          name: "ติดตั้งและทดสอบ Production",
          status: { status: "completed", color: "#00d26b" },
          priority: { priority: "1", color: "#ff3d71" },
          assignees: [{ username: "อรุณ", id: 1006 }],
          due_date: Date.now() - 172800000,
          time_estimate: 12600000
        },
        {
          id: "901808354623",
          name: "อบรมการใช้งานระบบ",
          status: { status: "in progress", color: "#2563eb" },
          priority: { priority: "2", color: "#ff6b35" },
          assignees: [{ username: "วิภา", id: 1004 }, { username: "สมชาย", id: 1005 }],
          due_date: Date.now() + 432000000,
          time_estimate: 16200000
        },
        {
          id: "901808354624",
          name: "แก้ไข Bug การแสดงผลข้อมูล",
          status: { status: "completed", color: "#00d26b" },
          priority: { priority: "2", color: "#ff6b35" },
          assignees: [{ username: "กิตติพงษ์", id: 1001 }],
          due_date: Date.now() - 259200000,
          time_estimate: 5400000
        }
      ],
      workload: {
        totalTasks: 22,
        completedTasks: 15,
        inProgressTasks: 5,
        overdueTasks: 2
      }
    };

    res.json({
      success: true,
      data: mockData,
      source: "enhanced_mock_data_thai",
      timestamp: new Date().toISOString(),
      fallback_reason: "ClickUp API unavailable - using realistic mock data"
    });
    
  } catch (error) {
    console.error('💥 API Error:', error);
    res.status(500).json({
      error: 'Failed to get ClickUp data',
      message: error.message
    });
  }
});

// Demo endpoints
app.get('/api/v1/tasks/demo', (req, res) => {
  const demoTasks = [
    {
      id: 'demo-1',
      title: 'TaskFlow Pro ดึงข้อมูลจาก ClickUp สำเร็จ',
      description: 'ระบบเชื่อมต่อกับ ClickUp API และแสดงข้อมูลจริง',
      priority: 'high',
      status: 'completed',
      assignee: 'System',
      created_at: new Date(),
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  ];
  res.json({ 
    tasks: demoTasks,
    clickup_integration: true,
    message: 'TaskFlow Pro backend พร้อมใช้งานกับ ClickUp API'
  });
});

app.get('/api/v1/team/demo', (req, res) => {
  const demoTeam = [
    {
      id: 'demo-1',
      name: 'ทีม TaskFlow',
      role: 'Development Team',
      avatar: 'ท',
      status: 'available',
      current_tasks: 5,
      max_tasks: 10,
      workload_percentage: 50
    }
  ];
  res.json({ 
    team: demoTeam,
    clickup_integration: true,
    message: 'ข้อมูลทีมจาก ClickUp API พร้อมใช้งาน'
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    status: 'TaskFlow Backend - ClickUp Integration',
    message: 'Backend พร้อมเชื่อมต่อ ClickUp API',
    health_check: '/health',
    clickup_data: '/api/v1/test/clickup-data',
    version: '2.0.0-clickup',
    features: ['Real ClickUp API', 'Thai Language Support', 'Team Analytics']
  });
});

// Start server on all interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TaskFlow Backend (ClickUp Integration) starting on port ${PORT}...`);
  console.log(`🌐 Listening on all interfaces (0.0.0.0:${PORT})`);
  console.log(`🔗 ClickUp API integration ready`);
  console.log(`✅ Backend service ready for TaskFlow Pro Dashboard`);
  console.log(`📊 Dashboard URL: http://192.168.20.10:555`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Backend server shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Backend server shutting down gracefully');
  process.exit(0);
});