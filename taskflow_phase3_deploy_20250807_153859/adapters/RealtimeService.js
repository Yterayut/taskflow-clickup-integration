/**
 * Realtime Service - WebSocket Infrastructure Adapter
 * TaskFlow Pro v2.2 - Real-time communication system
 */

const WebSocket = require('ws');
const http = require('http');
const EventEmitter = require('events');

class RealtimeService extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            port: config.port || 7813,
            heartbeatInterval: config.heartbeatInterval || 30000,
            maxConnections: config.maxConnections || 1000,
            enableCompression: config.enableCompression !== false,
            enableCors: config.enableCors !== false,
            ...config
        };

        this.wss = null;
        this.clients = new Map();
        this.rooms = new Map();
        this.isRunning = false;
        this.heartbeatTimer = null;
        this.stats = {
            connections: 0,
            messagesReceived: 0,
            messagesSent: 0,
            startTime: null
        };
    }

    /**
     * Initialize WebSocket server
     */
    async initialize() {
        if (this.isRunning) {
            throw new Error('Realtime service is already running');
        }

        try {
            // Create HTTP server for WebSocket
            this.server = http.createServer();
            
            // Create WebSocket server
            this.wss = new WebSocket.Server({
                server: this.server,
                perMessageDeflate: this.config.enableCompression ? {
                    zlibDeflateOptions: {
                        threshold: 1024,
                        chunkSize: 8 * 1024
                    }
                } : false
            });

            this.setupWebSocketHandlers();
            this.startHeartbeat();

            // Start listening
            await new Promise((resolve, reject) => {
                this.server.listen(this.config.port, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            this.isRunning = true;
            this.stats.startTime = new Date();

            console.log(`✅ Realtime service started on port ${this.config.port}`);
            this.emit('started');

        } catch (error) {
            console.error('❌ Failed to initialize realtime service:', error);
            throw error;
        }
    }

    /**
     * Setup WebSocket event handlers
     */
    setupWebSocketHandlers() {
        this.wss.on('connection', (ws, request) => {
            this.handleConnection(ws, request);
        });

        this.wss.on('error', (error) => {
            console.error('WebSocket server error:', error);
            this.emit('error', error);
        });
    }

    /**
     * Handle new WebSocket connection
     */
    handleConnection(ws, request) {
        const clientId = this.generateClientId();
        const clientInfo = {
            id: clientId,
            ws,
            ip: request.socket.remoteAddress,
            userAgent: request.headers['user-agent'],
            connectedAt: new Date(),
            lastPing: new Date(),
            authenticated: false,
            userId: null,
            userRole: null,
            rooms: new Set()
        };

        this.clients.set(clientId, clientInfo);
        this.stats.connections++;

        console.log(`🔌 New WebSocket connection: ${clientId} from ${clientInfo.ip}`);

        // Setup client event handlers
        ws.on('message', (data) => {
            this.handleMessage(clientId, data);
        });

        ws.on('close', (code, reason) => {
            this.handleDisconnection(clientId, code, reason);
        });

        ws.on('error', (error) => {
            console.error(`WebSocket client error ${clientId}:`, error);
            this.handleDisconnection(clientId);
        });

        ws.on('pong', () => {
            const client = this.clients.get(clientId);
            if (client) {
                client.lastPing = new Date();
            }
        });

        // Send welcome message
        this.sendToClient(clientId, {
            type: 'welcome',
            clientId,
            timestamp: new Date().toISOString()
        });

        this.emit('connection', clientInfo);
    }

    /**
     * Handle WebSocket message
     */
    handleMessage(clientId, data) {
        try {
            const message = JSON.parse(data.toString());
            this.stats.messagesReceived++;

            const client = this.clients.get(clientId);
            if (!client) return;

            // Handle different message types
            switch (message.type) {
                case 'authenticate':
                    this.handleAuthentication(clientId, message);
                    break;
                
                case 'join_room':
                    this.handleJoinRoom(clientId, message);
                    break;
                
                case 'leave_room':
                    this.handleLeaveRoom(clientId, message);
                    break;
                
                case 'ping':
                    this.sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
                    break;
                
                case 'dashboard_update':
                    this.handleDashboardUpdate(clientId, message);
                    break;
                
                default:
                    console.log(`Unknown message type from ${clientId}:`, message.type);
            }

            this.emit('message', { clientId, message });

        } catch (error) {
            console.error(`Error parsing message from ${clientId}:`, error);
            this.sendToClient(clientId, {
                type: 'error',
                message: 'Invalid message format'
            });
        }
    }

    /**
     * Handle client authentication
     */
    handleAuthentication(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client) return;

        // In production, verify JWT token here
        const { token, userId, userRole } = message;
        
        // TODO: Verify JWT token with AuthenticationService
        // For now, accept any token for demo purposes
        if (token && userId) {
            client.authenticated = true;
            client.userId = userId;
            client.userRole = userRole || 'employee';

            // Join user to their personal room
            this.joinClientToRoom(clientId, `user_${userId}`);
            
            // Join user to role-based room
            this.joinClientToRoom(clientId, `role_${userRole}`);

            this.sendToClient(clientId, {
                type: 'authenticated',
                success: true,
                userId,
                userRole
            });

            console.log(`✅ Client ${clientId} authenticated as ${userId} (${userRole})`);
        } else {
            this.sendToClient(clientId, {
                type: 'authenticated',
                success: false,
                error: 'Invalid credentials'
            });
        }
    }

    /**
     * Handle joining a room
     */
    handleJoinRoom(clientId, message) {
        const { room } = message;
        if (!room) return;

        this.joinClientToRoom(clientId, room);
        
        this.sendToClient(clientId, {
            type: 'room_joined',
            room,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Handle leaving a room
     */
    handleLeaveRoom(clientId, message) {
        const { room } = message;
        if (!room) return;

        this.removeClientFromRoom(clientId, room);
        
        this.sendToClient(clientId, {
            type: 'room_left',
            room,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Handle dashboard update requests
     */
    handleDashboardUpdate(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client || !client.authenticated) return;

        // Emit event for other services to handle
        this.emit('dashboard_update_request', {
            clientId,
            userId: client.userId,
            userRole: client.userRole,
            data: message.data
        });
    }

    /**
     * Handle client disconnection
     */
    handleDisconnection(clientId, code, reason) {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Remove client from all rooms
        for (const room of client.rooms) {
            this.removeClientFromRoom(clientId, room);
        }

        this.clients.delete(clientId);
        this.stats.connections--;

        console.log(`🔌 Client disconnected: ${clientId} (code: ${code})`);
        this.emit('disconnection', { clientId, code, reason });
    }

    /**
     * Join client to a room
     */
    joinClientToRoom(clientId, room) {
        const client = this.clients.get(clientId);
        if (!client) return false;

        if (!this.rooms.has(room)) {
            this.rooms.set(room, new Set());
        }

        this.rooms.get(room).add(clientId);
        client.rooms.add(room);

        console.log(`📢 Client ${clientId} joined room: ${room}`);
        return true;
    }

    /**
     * Remove client from a room
     */
    removeClientFromRoom(clientId, room) {
        const client = this.clients.get(clientId);
        if (!client) return false;

        if (this.rooms.has(room)) {
            this.rooms.get(room).delete(clientId);
            
            // Clean up empty rooms
            if (this.rooms.get(room).size === 0) {
                this.rooms.delete(room);
            }
        }

        client.rooms.delete(room);
        return true;
    }

    /**
     * Send message to specific client
     */
    sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) {
            return false;
        }

        try {
            client.ws.send(JSON.stringify(message));
            this.stats.messagesSent++;
            return true;
        } catch (error) {
            console.error(`Error sending message to ${clientId}:`, error);
            return false;
        }
    }

    /**
     * Broadcast message to all clients in a room
     */
    broadcastToRoom(room, message, excludeClientId = null) {
        const roomClients = this.rooms.get(room);
        if (!roomClients) return 0;

        let sentCount = 0;
        for (const clientId of roomClients) {
            if (clientId !== excludeClientId) {
                if (this.sendToClient(clientId, message)) {
                    sentCount++;
                }
            }
        }

        return sentCount;
    }

    /**
     * Broadcast message to all authenticated clients
     */
    broadcastToAll(message, excludeClientId = null) {
        let sentCount = 0;
        for (const [clientId, client] of this.clients) {
            if (clientId !== excludeClientId && client.authenticated) {
                if (this.sendToClient(clientId, message)) {
                    sentCount++;
                }
            }
        }
        return sentCount;
    }

    /**
     * Send dashboard update to relevant users
     */
    sendDashboardUpdate(updateData) {
        const message = {
            type: 'dashboard_update',
            data: updateData,
            timestamp: new Date().toISOString()
        };

        // Send to all authenticated users
        return this.broadcastToAll(message);
    }

    /**
     * Send task update notification
     */
    sendTaskUpdate(taskData, targetUsers = []) {
        const message = {
            type: 'task_update',
            data: taskData,
            timestamp: new Date().toISOString()
        };

        let sentCount = 0;
        if (targetUsers.length > 0) {
            // Send to specific users
            for (const userId of targetUsers) {
                sentCount += this.broadcastToRoom(`user_${userId}`, message);
            }
        } else {
            // Send to all authenticated users
            sentCount = this.broadcastToAll(message);
        }

        return sentCount;
    }

    /**
     * Send security alert to administrators
     */
    sendSecurityAlert(alertData) {
        const message = {
            type: 'security_alert',
            data: alertData,
            timestamp: new Date().toISOString()
        };

        // Send to managers and admins
        let sentCount = 0;
        sentCount += this.broadcastToRoom('role_manager', message);
        sentCount += this.broadcastToRoom('role_admin', message);

        return sentCount;
    }

    /**
     * Start heartbeat to keep connections alive
     */
    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            const now = new Date();
            
            for (const [clientId, client] of this.clients) {
                const timeSinceLastPing = now - client.lastPing;
                
                if (timeSinceLastPing > this.config.heartbeatInterval * 2) {
                    // Client hasn't responded to ping, disconnect
                    console.log(`💔 Client ${clientId} heartbeat timeout, disconnecting`);
                    client.ws.terminate();
                    this.handleDisconnection(clientId);
                } else if (timeSinceLastPing > this.config.heartbeatInterval) {
                    // Send ping
                    try {
                        client.ws.ping();
                    } catch (error) {
                        console.error(`Error sending ping to ${clientId}:`, error);
                    }
                }
            }
        }, this.config.heartbeatInterval);
    }

    /**
     * Stop heartbeat timer
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Generate unique client ID
     */
    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get service statistics
     */
    getStats() {
        return {
            ...this.stats,
            uptime: this.stats.startTime ? Date.now() - this.stats.startTime.getTime() : 0,
            rooms: Array.from(this.rooms.keys()),
            roomCounts: Object.fromEntries(
                Array.from(this.rooms.entries()).map(([room, clients]) => [room, clients.size])
            )
        };
    }

    /**
     * Get connected clients info
     */
    getClients() {
        return Array.from(this.clients.values()).map(client => ({
            id: client.id,
            ip: client.ip,
            userAgent: client.userAgent,
            connectedAt: client.connectedAt,
            authenticated: client.authenticated,
            userId: client.userId,
            userRole: client.userRole,
            rooms: Array.from(client.rooms)
        }));
    }

    /**
     * Shutdown the realtime service
     */
    async shutdown() {
        if (!this.isRunning) return;

        console.log('🛑 Shutting down realtime service...');

        this.stopHeartbeat();

        // Close all client connections
        for (const [clientId, client] of this.clients) {
            client.ws.close(1001, 'Server shutting down');
        }

        // Close WebSocket server
        if (this.wss) {
            this.wss.close();
        }

        // Close HTTP server
        if (this.server) {
            await new Promise((resolve) => {
                this.server.close(resolve);
            });
        }

        this.isRunning = false;
        this.emit('shutdown');

        console.log('✅ Realtime service shutdown complete');
    }
}

module.exports = { RealtimeService };