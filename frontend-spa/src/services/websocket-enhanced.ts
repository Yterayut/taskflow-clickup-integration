/**
 * Enhanced WebSocket Service for Real-time Communication
 * TaskFlow Pro v3.0 - Phase 3 Real-time Implementation
 * Multi-Persona Ultra-Think Enhanced
 */

export interface WebSocketMessage {
    type: string;
    data: any;
    timestamp: string;
    userId?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface RealtimeNotification {
    id: string;
    type: 'task-update' | 'user-activity' | 'system-alert' | 'analytics-update';
    title: string;
    message: string;
    data?: any;
    timestamp: string;
    read: boolean;
    priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface TaskUpdate {
    taskId: string;
    action: 'created' | 'updated' | 'completed' | 'assigned';
    task: any;
    userId: string;
    timestamp: string;
}

export interface AnalyticsUpdate {
    metrics: {
        tasks: { created: number; completed: number; inProgress: number };
        users: { active: number; total: number };
        teams: Record<string, any>;
        performance: Record<string, any>;
        realtime: { connections: number; messages: number };
    };
    timestamp: string;
}

export interface WebSocketConfig {
    url: string;
    reconnectAttempts?: number;
    reconnectInterval?: number;
    heartbeatInterval?: number;
    maxReconnectInterval?: number;
    authentication?: {
        token?: string;
        userId?: string;
    };
}

class EnhancedWebSocketService {
    private ws: WebSocket | null = null;
    private config: WebSocketConfig;
    private listeners: Map<string, Function[]> = new Map();
    private reconnectCount = 0;
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private isConnected = false;
    private connectionId: string | null = null;
    private messageQueue: WebSocketMessage[] = [];
    private statistics = {
        messagesReceived: 0,
        messagesSent: 0,
        reconnections: 0,
        lastConnected: null as Date | null,
        uptime: 0
    };

    // Event handlers for different message types
    private eventHandlers = {
        'task-notification': this.handleTaskNotification.bind(this),
        'user-activity': this.handleUserActivity.bind(this),
        'system-alert': this.handleSystemAlert.bind(this),
        'analytics-update': this.handleAnalyticsUpdate.bind(this),
        'heartbeat-response': this.handleHeartbeatResponse.bind(this)
    };

    constructor(config: WebSocketConfig) {
        this.config = {
            reconnectAttempts: 10,
            reconnectInterval: 3000,
            maxReconnectInterval: 30000,
            heartbeatInterval: 30000,
            ...config
        };
    }

    async connect(authToken?: string, userId?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // Build WebSocket URL with authentication if provided
                let wsUrl = this.config.url;
                if (authToken && userId) {
                    wsUrl += `?token=${encodeURIComponent(authToken)}&userId=${encodeURIComponent(userId)}`;
                }

                console.log('[WebSocket] Connecting to:', wsUrl.replace(/token=[^&]*/, 'token=***'));
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log('[WebSocket] ✅ Connected to server');
                    this.isConnected = true;
                    this.reconnectCount = 0;
                    this.statistics.lastConnected = new Date();
                    this.connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    
                    // Send authentication if provided
                    if (authToken && userId) {
                        this.send('auth', {
                            token: authToken,
                            userId: userId,
                            connectionId: this.connectionId
                        });
                    }
                    
                    this.startHeartbeat();
                    this.processMessageQueue();
                    this.emit('connected', { connectionId: this.connectionId });
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    this.statistics.messagesReceived++;
                    this.handleMessage(event.data);
                };

                this.ws.onclose = (event) => {
                    console.log(`[WebSocket] ❌ Connection closed (code: ${event.code})`);
                    this.isConnected = false;
                    this.stopHeartbeat();
                    this.emit('disconnected', { code: event.code, reason: event.reason });
                    this.handleReconnect();
                };

                this.ws.onerror = (error) => {
                    console.error('[WebSocket] ❌ Connection error:', error);
                    this.emit('error', error);
                    reject(error);
                };

            } catch (error) {
                console.error('[WebSocket] ❌ Failed to create connection:', error);
                reject(error);
            }
        });
    }

    private handleMessage(data: string) {
        try {
            const message: WebSocketMessage = JSON.parse(data);
            
            // Handle specific message types
            if (this.eventHandlers[message.type]) {
                this.eventHandlers[message.type](message.data);
            }
            
            // Emit to registered listeners
            const listeners = this.listeners.get(message.type) || [];
            listeners.forEach(listener => {
                try {
                    listener(message.data, message);
                } catch (error) {
                    console.error(`[WebSocket] Error in listener for ${message.type}:`, error);
                }
            });
            
            // Emit general message event
            this.emit('message', message);
            
        } catch (error) {
            console.error('[WebSocket] Error parsing message:', error);
        }
    }

    private handleTaskNotification(data: TaskUpdate) {
        console.log(`[WebSocket] 📋 Task ${data.action}: ${data.taskId}`);
        
        // Create user-friendly notification
        const notification: RealtimeNotification = {
            id: `task_${data.taskId}_${Date.now()}`,
            type: 'task-update',
            title: `Task ${data.action}`,
            message: `${data.task.title} has been ${data.action}`,
            data: data,
            timestamp: data.timestamp,
            read: false,
            priority: data.action === 'completed' ? 'high' : 'medium'
        };
        
        this.emit('notification', notification);
    }

    private handleUserActivity(data: any) {
        console.log(`[WebSocket] 👤 User activity: ${data.action}`);
        this.emit('user-activity', data);
    }

    private handleSystemAlert(data: any) {
        console.log(`[WebSocket] 🔔 System alert: ${data.level}`);
        
        const notification: RealtimeNotification = {
            id: `alert_${Date.now()}`,
            type: 'system-alert',
            title: 'System Alert',
            message: data.message,
            data: data,
            timestamp: data.timestamp,
            read: false,
            priority: data.level === 'error' ? 'critical' : data.level === 'warning' ? 'high' : 'medium'
        };
        
        this.emit('notification', notification);
    }

    private handleAnalyticsUpdate(data: AnalyticsUpdate) {
        console.log('[WebSocket] 📊 Analytics updated');
        this.emit('analytics-update', data);
    }

    private handleHeartbeatResponse(data: any) {
        // Update uptime and connection health
        if (this.statistics.lastConnected) {
            this.statistics.uptime = Date.now() - this.statistics.lastConnected.getTime();
        }
    }

    private handleReconnect() {
        if (this.reconnectCount < this.config.reconnectAttempts!) {
            this.reconnectCount++;
            this.statistics.reconnections++;
            
            // Exponential backoff with max interval
            const interval = Math.min(
                this.config.reconnectInterval! * Math.pow(2, this.reconnectCount - 1),
                this.config.maxReconnectInterval!
            );
            
            console.log(`[WebSocket] 🔄 Reconnecting... attempt ${this.reconnectCount}/${this.config.reconnectAttempts} (in ${interval}ms)`);
            
            setTimeout(() => {
                this.connect(this.config.authentication?.token, this.config.authentication?.userId);
            }, interval);
        } else {
            console.error('[WebSocket] ❌ Max reconnection attempts reached');
            this.emit('reconnect-failed', { attempts: this.reconnectCount });
        }
    }

    private startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected && this.ws) {
                this.send('heartbeat', {
                    timestamp: new Date().toISOString(),
                    connectionId: this.connectionId,
                    uptime: this.statistics.uptime
                });
            }
        }, this.config.heartbeatInterval);
    }

    private stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    private processMessageQueue() {
        // Send any queued messages
        while (this.messageQueue.length > 0 && this.isConnected) {
            const message = this.messageQueue.shift();
            if (message) {
                this.ws!.send(JSON.stringify(message));
                this.statistics.messagesSent++;
            }
        }
    }

    send(type: string, data: any, priority: 'low' | 'medium' | 'high' | 'critical' = 'medium') {
        const message: WebSocketMessage = {
            type,
            data,
            timestamp: new Date().toISOString(),
            userId: this.config.authentication?.userId,
            priority
        };

        if (this.ws && this.isConnected) {
            this.ws.send(JSON.stringify(message));
            this.statistics.messagesSent++;
        } else {
            // Queue message for when connection is restored
            console.warn(`[WebSocket] ⚠️  Queueing message (type: ${type}) - not connected`);
            this.messageQueue.push(message);
            
            // Limit queue size
            if (this.messageQueue.length > 100) {
                this.messageQueue.shift(); // Remove oldest message
            }
        }
    }

    // Enhanced event system
    on(type: string, listener: Function) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        this.listeners.get(type)!.push(listener);
    }

    off(type: string, listener: Function) {
        const listeners = this.listeners.get(type);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    private emit(type: string, data: any) {
        const listeners = this.listeners.get(type) || [];
        listeners.forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                console.error(`[WebSocket] Error in event listener for ${type}:`, error);
            }
        });
    }

    // Utility methods
    disconnect() {
        console.log('[WebSocket] 🔌 Disconnecting...');
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        this.isConnected = false;
        this.connectionId = null;
    }

    getConnectionStatus(): boolean {
        return this.isConnected;
    }

    getConnectionId(): string | null {
        return this.connectionId;
    }

    getStatistics() {
        return {
            ...this.statistics,
            queuedMessages: this.messageQueue.length,
            connectionId: this.connectionId,
            isConnected: this.isConnected,
            reconnectCount: this.reconnectCount
        };
    }

    // Task-specific methods
    subscribeToTaskUpdates(taskIds: string[] = []) {
        this.send('subscribe-tasks', { taskIds });
    }

    subscribeToTeamUpdates(teamId: string) {
        this.send('subscribe-team', { teamId });
    }

    subscribeToAnalytics() {
        this.send('subscribe-analytics', {});
    }

    // Room management
    joinRoom(roomId: string) {
        this.send('join-room', { roomId });
    }

    leaveRoom(roomId: string) {
        this.send('leave-room', { roomId });
    }
}

// Create singleton instance with enhanced configuration
const enhancedWsService = new EnhancedWebSocketService({
    url: 'ws://192.168.20.10:7813',
    reconnectAttempts: 10,
    reconnectInterval: 3000,
    maxReconnectInterval: 30000,
    heartbeatInterval: 30000
});

export default enhancedWsService;
export { EnhancedWebSocketService, enhancedWsService };
export type { RealtimeNotification, TaskUpdate, AnalyticsUpdate };