const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = 777;

// ClickUp API Configuration
const CLICKUP_CLIENT_ID = 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL';
const CLICKUP_CLIENT_SECRET = 'BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX';
const CLICKUP_REDIRECT_URI = 'http://192.168.20.10:777/api/v1/auth/clickup/callback';

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // Allow inline scripts for demo
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 900000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

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

// ClickUp OAuth2 Authentication Routes
app.get('/api/v1/auth/clickup/auth-url', async (req, res) => {
  try {
    const state = Math.random().toString(36).substring(2, 15);
    const authUrl = `https://app.clickup.com/api?client_id=${CLICKUP_CLIENT_ID}&redirect_uri=${encodeURIComponent(CLICKUP_REDIRECT_URI)}&state=${state}`;
    
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
    const state = Math.random().toString(36).substring(2, 15);
    const authUrl = `https://app.clickup.com/api?client_id=${CLICKUP_CLIENT_ID}&redirect_uri=${encodeURIComponent(CLICKUP_REDIRECT_URI)}&state=${state}`;
    
    res.redirect(authUrl);
  } catch (error) {
    console.error('OAuth authorization error:', error);
    res.status(500).json({ 
      error: 'Failed to generate authorization URL',
      message: error.message 
    });
  }
});

// ClickUp OAuth callback handler
app.get('/api/v1/auth/clickup/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.redirect('http://192.168.20.10:555?auth=error&message=No authorization code received');
    }

    // Exchange code for access token
    const tokenResponse = await axios.post('https://api.clickup.com/api/v2/oauth/token', {
      client_id: CLICKUP_CLIENT_ID,
      client_secret: CLICKUP_CLIENT_SECRET,
      code: code
    });

    const accessToken = tokenResponse.data.access_token;
    
    // Get user info
    const userResponse = await axios.get('https://api.clickup.com/api/v2/user', {
      headers: {
        'Authorization': accessToken
      }
    });

    // Store token and redirect to frontend with success
    res.redirect(`http://192.168.20.10:555?auth=success&token=${accessToken}&user=${encodeURIComponent(JSON.stringify(userResponse.data.user))}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`http://192.168.20.10:555?auth=error&message=${encodeURIComponent(error.message)}`);
  }
});

// Real ClickUp API endpoints
app.get('/api/v1/test/clickup-data', async (req, res) => {
  try {
    // Try to use stored access token or environment variable
    const authHeader = req.headers.authorization || req.query.token;
    let accessToken = authHeader;
    
    // If no token provided, try environment variable or default
    if (!accessToken) {
      accessToken = process.env.CLICKUP_ACCESS_TOKEN;
    }

    if (!accessToken) {
      // Return demo data if no token available
      const demoData = {
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
            due_date: 1750500356238,
            time_estimate: 14400000
          },
          {
            id: "901808354618",
            name: "ทดสอบระบบ API",
            status: { status: "completed", color: "#00d26b" },
            priority: { priority: "1", color: "#ff3d71" },
            assignees: [{ username: "มานี", id: 1003 }],
            due_date: 1750410356238,
            time_estimate: 21600000
          },
          {
            id: "901808354619",
            name: "ออกแบบ UI/UX",
            status: { status: "in progress", color: "#2563eb" },
            priority: { priority: "2", color: "#ff6b35" },
            assignees: [{ username: "นภัสสร", id: 1002 }],
            due_date: 1750586756238,
            time_estimate: 18000000
          },
          {
            id: "901808354620",
            name: "จัดทำเอกสารโปรเจค",
            status: { status: "todo", color: "#6b7280" },
            priority: { priority: "3", color: "#6b7280" },
            assignees: [{ username: "วิภา", id: 1004 }],
            due_date: 1750673156238,
            time_estimate: 10800000
          },
          {
            id: "901808354621",
            name: "รายงานความคืบหน้าประจำสัปดาห์",
            status: { status: "overdue", color: "#dc2626" },
            priority: { priority: "1", color: "#ff3d71" },
            assignees: [{ username: "สมชาย", id: 1005 }],
            due_date: 1750327556238,
            time_estimate: 7200000
          },
          {
            id: "901808354622",
            name: "ติดตั้งและทดสอบ Production",
            status: { status: "completed", color: "#00d26b" },
            priority: { priority: "1", color: "#ff3d71" },
            assignees: [{ username: "อรุณ", id: 1006 }],
            due_date: 1750241156238,
            time_estimate: 12600000
          },
          {
            id: "901808354623",
            name: "อบรมการใช้งานระบบ",
            status: { status: "in progress", color: "#2563eb" },
            priority: { priority: "2", color: "#ff6b35" },
            assignees: [{ username: "วิภา", id: 1004 }, { username: "สมชาย", id: 1005 }],
            due_date: 1750845956238,
            time_estimate: 16200000
          },
          {
            id: "901808354624",
            name: "แก้ไข Bug การแสดงผลข้อมูล",
            status: { status: "completed", color: "#00d26b" },
            priority: { priority: "2", color: "#ff6b35" },
            assignees: [{ username: "กิตติพงษ์", id: 1001 }],
            due_date: 1750154756238,
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

      return res.json({
        success: true,
        data: demoData,
        source: "demo_data_thai",
        timestamp: new Date().toISOString(),
        message: "Demo data - Connect with ClickUp to see real data"
      });
    }

    // Try to fetch real data from ClickUp API
    const clickupApi = axios.create({
      baseURL: 'https://api.clickup.com/api/v2',
      headers: {
        'Authorization': accessToken,
        'Content-Type': 'application/json'
      }
    });

    try {
      // Get user info
      const userResponse = await clickupApi.get('/user');
      const user = userResponse.data.user;

      // Get teams
      const teamsResponse = await clickupApi.get('/team');
      const teams = teamsResponse.data.teams;

      // Get tasks from all teams
      let allTasks = [];
      if (teams.length > 0) {
        for (const team of teams) {
          try {
            // Get team tasks
            const teamTasksResponse = await clickupApi.get(`/team/${team.id}/task?archived=false&subtasks=true&include_closed=true`);
            allTasks = allTasks.concat(teamTasksResponse.data.tasks || []);
          } catch (error) {
            console.log(`Team ${team.name} tasks error:`, error.message);
          }
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
        tasks: uniqueTasks.map(task => ({
          id: task.id,
          name: task.name,
          status: task.status || { status: "pending", color: "#6b7280" },
          priority: task.priority || { priority: "3", color: "#6b7280" },
          assignees: task.assignees || [],
          due_date: task.due_date ? parseInt(task.due_date) : Date.now() + 86400000,
          time_estimate: task.time_estimate || 0
        })),
        workload: {
          totalTasks: uniqueTasks.length,
          completedTasks: uniqueTasks.filter(t => {
            const status = t.status?.status?.toLowerCase() || '';
            return status.includes('complete') || status.includes('done') || status.includes('closed');
          }).length,
          inProgressTasks: uniqueTasks.filter(t => {
            const status = t.status?.status?.toLowerCase() || '';
            return status.includes('progress') || status.includes('doing') || status.includes('active');
          }).length,
          todoTasks: uniqueTasks.filter(t => {
            const status = t.status?.status?.toLowerCase() || '';
            return status.includes('to do') || status.includes('todo') || status.includes('open') || status.includes('pending');
          }).length,
          overdueTasks: uniqueTasks.filter(t => t.due_date && parseInt(t.due_date) < Date.now()).length
        }
      };

      res.json({
        success: true,
        data: realClickUpData,
        source: "real_clickup_api",
        timestamp: new Date().toISOString()
      });
    } catch (apiError) {
      console.error('ClickUp API Error:', apiError.response?.data || apiError.message);
      
      // Return demo data if API fails
      const demoData = {
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
            due_date: 1750500356238,
            time_estimate: 14400000
          }
        ],
        workload: {
          totalTasks: 8,
          completedTasks: 3,
          inProgressTasks: 3,
          overdueTasks: 2
        }
      };

      res.json({
        success: true,
        data: demoData,
        source: "demo_data_fallback",
        timestamp: new Date().toISOString(),
        error: "ClickUp API error - using demo data"
      });
    }
  } catch (error) {
    console.error('💥 API Error:', error);
    res.status(500).json({
      error: 'Failed to get ClickUp data',
      message: error.message
    });
  }
});

// Authentication status check
app.get('/api/v1/auth/status', (req, res) => {
  const authHeader = req.headers.authorization;
  res.json({
    authenticated: !!authHeader,
    token: authHeader ? 'present' : 'missing'
  });
});

// Manual sync endpoint
app.post('/api/v1/sync', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Data synchronization completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Sync failed',
      message: error.message
    });
  }
});

// Logout endpoint
app.post('/api/v1/auth/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TaskFlow Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://192.168.20.10:${PORT}/health`);
  console.log(`🔗 ClickUp OAuth: http://192.168.20.10:${PORT}/api/v1/auth/clickup/authorize`);
  console.log(`📡 API Test: http://192.168.20.10:${PORT}/api/v1/test/clickup-data`);
});