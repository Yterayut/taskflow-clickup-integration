const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import services
const ClickUpService = require('./services/clickupService');
const AuthService = require('./services/authService');
const DataSyncService = require('./services/dataSyncService');

const app = express();
const PORT = 777;

// Redis client setup (optional, fallback to memory if not available)
let redisClient = null;
try {
    const redis = require('redis');
    if (process.env.REDIS_URL) {
        redisClient = redis.createClient({
            url: process.env.REDIS_URL,
            password: process.env.REDIS_PASSWORD
        });
        redisClient.connect().catch(err => console.log('Redis connection failed:', err.message));
    }
} catch (error) {
    console.log('Redis not available, using memory storage');
}

// Initialize services
const clickupService = new ClickUpService();
const authService = new AuthService(redisClient);
const dataSyncService = new DataSyncService(authService, redisClient);

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // Allow inline scripts for demo
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_REQUESTS) || 100,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
    origin: process.env.APP_URL || 'http://192.168.20.10:555',
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'TaskFlow Backend with ClickUp Integration',
    port: PORT.toString(),
    timestamp: new Date().toISOString(),
    version: '2.0.0-production',
    features: ['ClickUp API', 'OAuth2', 'Real-time Sync'],
    redis: redisClient ? 'connected' : 'disabled'
  });
});

// API v1 routes
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'TaskFlow API v1 with ClickUp',
    timestamp: new Date().toISOString(),
    authenticated: !!req.headers.authorization
  });
});

// ClickUp OAuth2 Authentication Routes
app.get('/api/v1/auth/clickup/authorize', async (req, res) => {
  try {
    const state = authService.generateOAuthState();
    await authService.storeOAuthState(state);
    
    // Force create new ClickUpService instance to avoid cache
    const ClickUpService = require('./services/clickupService');
    const freshClickupService = new ClickUpService();
    const authUrl = freshClickupService.getAuthorizationUrl(state);
    
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

// Demo authentication endpoint (for testing without real ClickUp OAuth)
app.get('/api/v1/auth/demo', async (req, res) => {
  try {
    const demoUserId = 'demo_user_12345';
    const demoUserData = {
      user: {
        id: demoUserId,
        username: 'demo_user',
        email: 'demo@taskflow.com',
        color: '#2563eb',
        profilePicture: 'https://attachments.clickup.com/demo.jpg'
      }
    };
    
    // Generate demo session token
    const sessionToken = authService.generateSessionToken(demoUserId, demoUserData);
    
    // Store demo session in memory
    await authService.storeUserSession(demoUserId, {
      user: demoUserData.user,
      created_at: Date.now()
    });
    
    // Redirect to frontend with success
    res.redirect(`http://192.168.20.10:555?auth=success&token=${sessionToken}&demo=true`);
  } catch (error) {
    console.error('Demo authentication error:', error);
    res.redirect(`http://192.168.20.10:555?auth=error&message=Demo authentication failed`);
  }
});

// Real ClickUp API endpoints (using OAuth Access Token)
app.get('/api/v1/test/clickup-data', async (req, res) => {
  try {
    // Use real OAuth access token from successful flow
    // TODO: Replace with dynamic token from OAuth flow or environment variable
    const CLICKUP_TOKEN = process.env.CLICKUP_ACCESS_TOKEN || '282686567_c5e69fe6e401704bc5ea0761cb568b5d271c0778db54bb7862315f8e1e81a2a8';
    
    if (CLICKUP_TOKEN) {
      // Fetch real data from ClickUp API
      const axios = require('axios');
      const clickupApi = axios.create({
        baseURL: 'https://api.clickup.com/api/v2',
        headers: {
          'Authorization': CLICKUP_TOKEN,
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

        // Get all tasks from all spaces and lists
        let allTasks = [];
        if (teams.length > 0) {
          const teamId = teams[0].id;
          
          // Get team tasks directly (this gives us more tasks)
          try {
            const teamTasksResponse = await clickupApi.get(`/team/${teamId}/task?archived=false&subtasks=true&include_closed=true`);
            allTasks = allTasks.concat(teamTasksResponse.data.tasks || []);
          } catch (error) {
            console.log('Team tasks error:', error.message);
          }

          // Also get tasks from spaces
          try {
            const spacesResponse = await clickupApi.get(`/team/${teamId}/space?archived=false`);
            const spaces = spacesResponse.data.spaces || [];
            
            for (const space of spaces) {
              // Get tasks from each space
              try {
                const spaceTasksResponse = await clickupApi.get(`/space/${space.id}/task?archived=false&subtasks=true&include_closed=true`);
                allTasks = allTasks.concat(spaceTasksResponse.data.tasks || []);
              } catch (error) {
                console.log(`Space ${space.name} tasks error:`, error.message);
              }

              // Get folders in space
              try {
                const foldersResponse = await clickupApi.get(`/space/${space.id}/folder?archived=false`);
                const folders = foldersResponse.data.folders || [];
                
                for (const folder of folders) {
                  // Get lists in folder
                  try {
                    const listsResponse = await clickupApi.get(`/folder/${folder.id}/list?archived=false`);
                    const lists = listsResponse.data.lists || [];
                    
                    for (const list of lists) {
                      // Get tasks from each list
                      try {
                        const listTasksResponse = await clickupApi.get(`/list/${list.id}/task?archived=false&subtasks=true&include_closed=true`);
                        allTasks = allTasks.concat(listTasksResponse.data.tasks || []);
                      } catch (error) {
                        console.log(`List ${list.name} tasks error:`, error.message);
                      }
                    }
                  } catch (error) {
                    console.log(`Folder ${folder.name} lists error:`, error.message);
                  }
                }
              } catch (error) {
                console.log(`Space ${space.name} folders error:`, error.message);
              }
            }
          } catch (error) {
            console.log('Spaces error:', error.message);
          }
        }

        // Remove duplicates based on task ID
        const uniqueTasks = [];
        const seenIds = new Set();
        for (const task of allTasks) {
          if (!seenIds.has(task.id)) {
            seenIds.add(task.id);
            uniqueTasks.push(task);
          }
        }
        
        const tasks = uniqueTasks;

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
            totalTasks: tasks.length,
            completedTasks: tasks.filter(t => {
              const status = t.status?.status?.toLowerCase() || '';
              return status.includes('complete') || status.includes('done') || status.includes('closed');
            }).length,
            inProgressTasks: tasks.filter(t => {
              const status = t.status?.status?.toLowerCase() || '';
              return status.includes('progress') || status.includes('doing') || status.includes('active');
            }).length,
            todoTasks: tasks.filter(t => {
              const status = t.status?.status?.toLowerCase() || '';
              return status.includes('to do') || status.includes('todo') || status.includes('open') || status.includes('pending');
            }).length,
            overdueTasks: tasks.filter(t => t.due_date && parseInt(t.due_date) < Date.now()).length
          }
        };

        res.json({
          success: true,
          data: realClickUpData,
          source: "real_clickup_api",
          timestamp: new Date().toISOString()
        });
        return;
      } catch (apiError) {
        console.error('ClickUp API Error:', apiError.response?.data || apiError.message);
      }
    }

    // Fallback to mock data if API fails
    const mockClickUpData = {
      user: {
        id: 90181167380,
        username: "TaskFlow Demo User", 
        email: "demo@taskflow.com",
        color: "#2563eb",
        profilePicture: "https://attachments.clickup.com/90181167380/avatar.jpg"
      },
      teams: [{
        id: "90181167380",
        name: "TaskFlow Team",
        color: "#2563eb",
        avatar: "https://attachments.clickup.com/90181167380/team.jpg"
      }],
      tasks: [
        {
          id: "901808353632",
          name: "Implement ClickUp Integration",
          status: { status: "in progress", color: "#2563eb" },
          priority: { priority: "2", color: "#ff6b35" },
          assignees: [{ username: "TaskFlow Demo User", id: 90181167380 }],
          due_date: Date.now() + 86400000,
          time_estimate: 14400000
        },
        {
          id: "901808354618",
          name: "Setup Team Management Dashboard", 
          status: { status: "completed", color: "#00d26b" },
          priority: { priority: "1", color: "#ff3d71" },
          assignees: [{ username: "TaskFlow Demo User", id: 90181167380 }],
          due_date: Date.now() - 3600000,
          time_estimate: 21600000
        }
      ],
      workload: {
        totalTasks: 15,
        completedTasks: 8,
        inProgressTasks: 5,
        overdueTasks: 2
      }
    };

    res.json({
      success: true,
      data: mockClickUpData,
      source: "mock_data",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test ClickUp data error:', error);
    res.status(500).json({
      error: 'Failed to get test data',
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

    // Verify OAuth state
    if (state) {
      const stateValid = await authService.verifyOAuthState(state);
      if (!stateValid) {
        return res.status(400).json({ error: 'Invalid or expired OAuth state' });
      }
    }

    // Exchange code for access token
    const tokenData = await clickupService.getAccessToken(code);
    
    // Get user info from ClickUp
    clickupService.setAccessToken(tokenData.access_token);
    const userData = await clickupService.getCurrentUser();
    
    const userId = userData.user.id;
    
    // Store tokens and session
    await authService.storeClickUpTokens(userId, tokenData);
    await authService.storeUserSession(userId, {
      user: userData.user,
      created_at: Date.now()
    });
    
    // Generate session token
    const sessionToken = authService.generateSessionToken(userId, {
      username: userData.user.username,
      email: userData.user.email
    });

    // Start auto-sync for the user
    dataSyncService.startAutoSync(userId, 30); // Every 30 minutes

    // Redirect to frontend with success
    const redirectUrl = `${process.env.APP_URL}?auth=success&token=${sessionToken}`;
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    const redirectUrl = `${process.env.APP_URL}?auth=error&message=${encodeURIComponent(error.message)}`;
    res.redirect(redirectUrl);
  }
});

app.get('/api/v1/auth/status', authService.requireAuth(), async (req, res) => {
  try {
    const authStatus = await authService.getUserAuthStatus(req.userId);
    const lastSync = await dataSyncService.getLastSyncResult(req.userId);
    
    res.json({
      authenticated: authStatus.authenticated,
      user_id: req.userId,
      last_sync: lastSync?.timestamp,
      sync_status: lastSync ? 'completed' : 'pending'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get auth status' });
  }
});

app.post('/api/v1/auth/logout', authService.requireAuth(), async (req, res) => {
  try {
    await authService.removeUserSession(req.userId);
    await authService.removeClickUpTokens(req.userId);
    dataSyncService.stopAutoSync(req.userId);
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// Data Sync Routes
app.post('/api/v1/sync', authService.requireAuth(), async (req, res) => {
  try {
    const syncResult = await dataSyncService.syncUserData(req.userId);
    res.json({
      message: 'Sync completed successfully',
      result: syncResult
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ 
      error: 'Sync failed',
      message: error.message 
    });
  }
});

app.get('/api/v1/sync/status', authService.requireAuth(), async (req, res) => {
  try {
    const lastSync = await dataSyncService.getLastSyncResult(req.userId);
    
    if (!lastSync) {
      return res.json({
        status: 'no_sync',
        message: 'No sync performed yet'
      });
    }

    res.json({
      status: 'completed',
      last_sync: lastSync.timestamp,
      total_tasks: lastSync.totalTasks,
      total_members: lastSync.totalMembers,
      teams: lastSync.teams.length,
      errors: lastSync.errors
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// Data Routes (Protected)
app.get('/api/v1/tasks', authService.requireAuth(), async (req, res) => {
  try {
    const dashboardData = await dataSyncService.getDashboardData(req.userId);
    res.json({ 
      tasks: dashboardData.tasks,
      last_sync: dashboardData.lastSync 
    });
  } catch (error) {
    console.error('Tasks error:', error);
    res.status(500).json({ 
      error: 'Failed to get tasks',
      message: error.message 
    });
  }
});

app.get('/api/v1/team', authService.requireAuth(), async (req, res) => {
  try {
    const dashboardData = await dataSyncService.getDashboardData(req.userId);
    res.json({ 
      team: dashboardData.team,
      last_sync: dashboardData.lastSync 
    });
  } catch (error) {
    console.error('Team error:', error);
    res.status(500).json({ 
      error: 'Failed to get team data',
      message: error.message 
    });
  }
});

app.get('/api/v1/dashboard', authService.requireAuth(), async (req, res) => {
  try {
    const dashboardData = await dataSyncService.getDashboardData(req.userId);
    res.json(dashboardData);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ 
      error: 'Failed to get dashboard data',
      message: error.message 
    });
  }
});

// ClickUp Webhooks (for real-time updates)
app.post('/api/webhooks/clickup', async (req, res) => {
  try {
    const { event, task_id, team_id, webhook_id } = req.body;
    
    // Verify webhook signature if configured
    const signature = req.headers['x-signature'];
    if (process.env.WEBHOOK_SECRET && signature) {
      // TODO: Verify webhook signature
    }

    console.log(`ClickUp webhook received: ${event} for task ${task_id}`);
    
    // TODO: Process webhook event and update cached data
    // For now, just acknowledge receipt
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Fallback routes for demo compatibility
app.get('/api/v1/tasks/demo', (req, res) => {
  const demoTasks = [
    {
      id: 'demo-1',
      title: 'Connect to ClickUp',
      description: 'Authenticate with ClickUp to see real tasks',
      priority: 'high',
      status: 'pending',
      assignee: 'System',
      created_at: new Date(),
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  ];
  res.json({ 
    tasks: demoTasks,
    demo_mode: true,
    message: 'This is demo data. Authenticate with ClickUp to see real tasks.'
  });
});

app.get('/api/v1/team/demo', (req, res) => {
  const demoTeam = [
    {
      id: 'demo-1',
      name: 'Demo User',
      role: 'Team Member',
      avatar: 'DU',
      status: 'available',
      current_tasks: 1,
      max_tasks: 8,
      workload_percentage: 12.5
    }
  ];
  res.json({ 
    team: demoTeam,
    demo_mode: true,
    message: 'This is demo data. Authenticate with ClickUp to see real team members.'
  });
});

// OAuth callback handler on root path
app.get("/", async (req, res) => {
  const { code, state } = req.query;
  if (code && state) {
    try {
      const tokenResponse = await clickupService.getAccessToken(code);
      if (tokenResponse.access_token) {
        res.redirect(`http://192.168.20.10:555?auth=success&token=${tokenResponse.access_token}&source=clickup`);
      } else {
        res.redirect(`http://192.168.20.10:555?auth=error&message=Failed to get access token`);
      }
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`http://192.168.20.10:555?auth=error&message=${encodeURIComponent(error.message)}`);
    }
  } else {
    res.json({
      status: 'TaskFlow Backend with ClickUp Integration',
      message: 'Use /health for health check or authenticate via ClickUp OAuth',
      oauth_url: '/api/v1/auth/clickup/authorize'
    });
  }
});

// Start server on all interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TaskFlow Backend starting on port ${PORT}...`);
  console.log(`🌐 Listening on all interfaces (0.0.0.0:${PORT})`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Backend server shutting down gracefully');
  process.exit(0);
});