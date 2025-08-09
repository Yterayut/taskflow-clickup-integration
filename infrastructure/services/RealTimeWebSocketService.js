/**
 * Real-time WebSocket Service for Phase 3
 * Provides live updates, notifications, and real-time data synchronization
 */

const EventEmitter = require('events');

class RealTimeWebSocketService extends EventEmitter {
    constructor(io, backgroundSyncService = null, cacheService = null) {
        super();
        this.io = io;
        this.backgroundSyncService = backgroundSyncService;
        this.cacheService = cacheService;
        this.connectedUsers = new Map();
        this.userSockets = new Map();
        this.rooms = new Map();
        
        // Performance metrics
        this.metrics = {
            totalConnections: 0,
            activeConnections: 0,
            messagesSent: 0,
            messagesReceived: 0,
            lastActivity: null,
            uptime: Date.now()
        };
        
        console.log('🔄 Real-time WebSocket Service initialized');
        this.setupSocketHandlers();
        this.setupBackgroundSyncIntegration();
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });
    }

    handleConnection(socket) {
        this.metrics.totalConnections++;
        this.metrics.activeConnections++;
        this.metrics.lastActivity = new Date().toISOString();
        
        console.log(`🔌 New WebSocket connection: ${socket.id}`);
        
        // User authentication and registration
        socket.on('user_authenticate', (userData) => {
            this.handleUserAuthentication(socket, userData);
        });
        
        // Dashboard subscriptions
        socket.on('subscribe_dashboard', (dashboardType) => {
            this.handleDashboardSubscription(socket, dashboardType);
        });
        
        // Task updates subscription
        socket.on('subscribe_tasks', (filters) => {
            this.handleTaskSubscription(socket, filters);
        });
        
        // Team activity subscription
        socket.on('subscribe_team_activity', () => {
            this.handleTeamActivitySubscription(socket);
        });
        
        // Sync status subscription
        socket.on('subscribe_sync_status', () => {
            this.handleSyncStatusSubscription(socket);
        });
        
        // Manual refresh request
        socket.on('request_refresh', (dataType) => {
            this.handleRefreshRequest(socket, dataType);
        });
        
        // Ping/Pong for connection health
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() });
        });
        
        // Disconnect handling
        socket.on('disconnect', () => {
            this.handleDisconnection(socket);
        });
        
        // Send initial connection status
        socket.emit('connection_established', {
            socketId: socket.id,
            timestamp: new Date().toISOString(),
            features: [
                'real_time_dashboard',
                'live_task_updates', 
                'team_activity_feed',
                'sync_status_monitoring',
                'instant_notifications'
            ]
        });
    }

    handleUserAuthentication(socket, userData) {
        const userId = userData.userId || userData.email || socket.id;
        const userRole = userData.role || 'employee';
        
        console.log(`👤 User authenticated: ${userId} (${userRole})`);
        
        // Store user data
        this.connectedUsers.set(socket.id, {
            userId: userId,
            role: userRole,
            name: userData.name || userId,
            connectedAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        });
        
        this.userSockets.set(userId, socket.id);
        
        // Join user-specific room
        socket.join(`user:${userId}`);
        socket.join(`role:${userRole.toLowerCase()}`);
        
        // Send authentication success
        socket.emit('authentication_success', {
            userId: userId,
            role: userRole,
            permissions: this.getUserPermissions(userRole)
        });
        
        // Broadcast user joined to team
        socket.broadcast.emit('user_joined', {
            userId: userId,
            name: userData.name || userId,
            role: userRole,
            timestamp: new Date().toISOString()
        });
    }

    handleDashboardSubscription(socket, dashboardType) {
        const roomName = `dashboard:${dashboardType}`;
        socket.join(roomName);
        
        console.log(`📊 Socket ${socket.id} subscribed to dashboard: ${dashboardType}`);
        
        // Send current dashboard data
        this.sendDashboardData(socket, dashboardType);
        
        socket.emit('dashboard_subscription_success', {
            dashboardType: dashboardType,
            updateFrequency: 'real-time'
        });
    }

    handleTaskSubscription(socket, filters) {
        const roomName = `tasks:${JSON.stringify(filters)}`;
        socket.join(roomName);
        socket.join('tasks:all');
        
        console.log(`📋 Socket ${socket.id} subscribed to tasks with filters:`, filters);
        
        // Send current task data
        this.sendTaskData(socket, filters);
        
        socket.emit('task_subscription_success', {
            filters: filters,
            updateFrequency: 'real-time'
        });
    }

    handleTeamActivitySubscription(socket) {
        socket.join('team:activity');
        
        console.log(`👥 Socket ${socket.id} subscribed to team activity`);
        
        // Send recent activity
        this.sendTeamActivity(socket);
        
        socket.emit('team_activity_subscription_success', {
            updateFrequency: 'real-time'
        });
    }

    handleSyncStatusSubscription(socket) {
        socket.join('sync:status');
        
        console.log(`🔄 Socket ${socket.id} subscribed to sync status`);
        
        // Send current sync status
        this.sendSyncStatus(socket);
        
        socket.emit('sync_status_subscription_success', {
            updateFrequency: 'real-time'
        });
    }

    handleRefreshRequest(socket, dataType) {
        this.metrics.messagesReceived++;
        
        console.log(`🔄 Refresh request for ${dataType} from ${socket.id}`);
        
        switch (dataType) {
            case 'dashboard':
                this.sendDashboardData(socket, 'all');
                break;
            case 'tasks':
                this.sendTaskData(socket, {});
                break;
            case 'team_activity':
                this.sendTeamActivity(socket);
                break;
            case 'sync_status':
                this.sendSyncStatus(socket);
                break;
            default:
                socket.emit('refresh_error', {
                    error: 'Unknown data type',
                    dataType: dataType
                });
        }
    }

    handleDisconnection(socket) {
        this.metrics.activeConnections--;
        
        const userData = this.connectedUsers.get(socket.id);
        if (userData) {
            console.log(`🔌 User disconnected: ${userData.userId}`);
            
            // Broadcast user left to team
            socket.broadcast.emit('user_left', {
                userId: userData.userId,
                name: userData.name,
                role: userData.role,
                timestamp: new Date().toISOString()
            });
            
            this.userSockets.delete(userData.userId);
            this.connectedUsers.delete(socket.id);
        } else {
            console.log(`🔌 Socket disconnected: ${socket.id}`);
        }
    }

    // Data sending methods
    sendDashboardData(socket, dashboardType) {
        // Generate mock dashboard data for now
        const dashboardData = {
            overview: {
                total_tasks: 15 + Math.floor(Math.random() * 5),
                completed_tasks: 12 + Math.floor(Math.random() * 3),
                in_progress_tasks: 3 + Math.floor(Math.random() * 2),
                pending_tasks: 1 + Math.floor(Math.random() * 2),
                overdue_tasks: Math.floor(Math.random() * 3)
            },
            team_performance: {
                total_members: 11,
                active_members: 9 + Math.floor(Math.random() * 2),
                completion_rate: 85.5 + Math.random() * 10,
                efficiency_score: 92.3 + Math.random() * 5
            },
            last_updated: new Date().toISOString(),
            dashboard_type: dashboardType
        };
        
        socket.emit('dashboard_data_update', dashboardData);
        this.metrics.messagesSent++;
    }

    sendTaskData(socket, filters) {
        // Generate mock task data
        const taskData = {
            tasks: [
                {
                    id: 'task_1',
                    title: 'Real-time WebSocket Implementation',
                    status: 'in_progress',
                    assignee: 'Teerayut',
                    priority: 'high',
                    updated_at: new Date().toISOString()
                },
                {
                    id: 'task_2', 
                    title: 'Dashboard Analytics Enhancement',
                    status: 'pending',
                    assignee: 'Team Lead',
                    priority: 'medium',
                    updated_at: new Date().toISOString()
                }
            ],
            filters: filters,
            total_count: 15,
            last_updated: new Date().toISOString()
        };
        
        socket.emit('task_data_update', taskData);
        this.metrics.messagesSent++;
    }

    sendTeamActivity(socket) {
        const activities = [
            {
                type: 'task_completed',
                message: 'Phase 2 Local Database Enhancement completed',
                user: 'Teerayut',
                timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
            },
            {
                type: 'user_login',
                message: 'chaiwutwck@gmail.com logged in',
                user: 'ชัยวุฒิ ไวเชิงค้า',
                timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString()
            },
            {
                type: 'sync_completed',
                message: 'Background sync completed successfully',
                user: 'System',
                timestamp: new Date().toISOString()
            }
        ];
        
        socket.emit('team_activity_update', {
            activities: activities,
            last_updated: new Date().toISOString()
        });
        this.metrics.messagesSent++;
    }

    sendSyncStatus(socket) {
        if (this.backgroundSyncService) {
            const syncStatus = this.backgroundSyncService.getStatus();
            socket.emit('sync_status_update', {
                ...syncStatus,
                real_time_enabled: true,
                last_checked: new Date().toISOString()
            });
        } else {
            socket.emit('sync_status_update', {
                isRunning: true,
                lastSyncTime: new Date().toISOString(),
                errorCount: 0,
                real_time_enabled: true,
                last_checked: new Date().toISOString()
            });
        }
        this.metrics.messagesSent++;
    }

    // Background sync integration
    setupBackgroundSyncIntegration() {
        if (this.backgroundSyncService && typeof this.backgroundSyncService.on === 'function') {
            // Listen for sync events
            this.backgroundSyncService.on('sync_started', () => {
                this.broadcastToRoom('sync:status', 'sync_event', {
                    type: 'sync_started',
                    timestamp: new Date().toISOString()
                });
            });
            
            this.backgroundSyncService.on('sync_completed', (data) => {
                this.broadcastToRoom('sync:status', 'sync_event', {
                    type: 'sync_completed',
                    data: data,
                    timestamp: new Date().toISOString()
                });
                
                // Trigger dashboard updates
                this.broadcastDashboardUpdates();
            });
            
            this.backgroundSyncService.on('sync_error', (error) => {
                this.broadcastToRoom('sync:status', 'sync_event', {
                    type: 'sync_error',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            });
            
            console.log('✅ Background Sync integration enabled');
        } else {
            console.log('ℹ️ Background Sync integration skipped (service not EventEmitter)');
        }
    }

    // Broadcast methods
    broadcastToRoom(room, event, data) {
        this.io.to(room).emit(event, data);
        this.metrics.messagesSent += this.io.sockets.adapter.rooms.get(room)?.size || 0;
    }

    broadcastDashboardUpdates() {
        // Update all dashboard subscribers
        this.io.to('dashboard:manager').emit('dashboard_refresh_needed');
        this.io.to('dashboard:team-lead').emit('dashboard_refresh_needed');
        this.io.to('dashboard:employee').emit('dashboard_refresh_needed');
    }

    // Real-time notifications
    sendNotification(userId, notification) {
        const socketId = this.userSockets.get(userId);
        if (socketId) {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit('notification', {
                    ...notification,
                    timestamp: new Date().toISOString()
                });
                this.metrics.messagesSent++;
            }
        }
    }

    broadcastNotification(notification) {
        this.io.emit('notification', {
            ...notification,
            timestamp: new Date().toISOString()
        });
        this.metrics.messagesSent += this.metrics.activeConnections;
    }

    // Utility methods
    getUserPermissions(role) {
        const permissions = {
            'manager': ['dashboard', 'analytics', 'team', 'projects', 'reports', 'settings'],
            'team lead': ['dashboard', 'analytics', 'team', 'projects', 'reports'],
            'employee': ['dashboard', 'team', 'projects']
        };
        
        return permissions[role.toLowerCase()] || permissions['employee'];
    }

    getMetrics() {
        return {
            ...this.metrics,
            uptime_seconds: Math.floor((Date.now() - this.metrics.uptime) / 1000),
            connected_users: this.connectedUsers.size,
            active_rooms: this.io.sockets.adapter.rooms.size
        };
    }

    getConnectedUsers() {
        return Array.from(this.connectedUsers.values());
    }

    // Health check
    healthCheck() {
        return {
            status: 'healthy',
            service: 'RealTimeWebSocketService',
            active_connections: this.metrics.activeConnections,
            total_connections: this.metrics.totalConnections,
            messages_sent: this.metrics.messagesSent,
            messages_received: this.metrics.messagesReceived,
            last_activity: this.metrics.lastActivity,
            uptime_seconds: Math.floor((Date.now() - this.metrics.uptime) / 1000)
        };
    }
}

module.exports = { RealTimeWebSocketService };