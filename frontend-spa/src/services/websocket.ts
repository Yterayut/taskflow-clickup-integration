/**
 * TaskFlow Pro SPA - WebSocket Service
 * v2.2.0 - Real-time communication service
 */

import { io, Socket } from 'socket.io-client';
import { RealtimeMessage, RealtimeConnection, User } from '@types/index';

type EventCallback = (data: any) => void;
type ConnectionCallback = (connected: boolean) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private connected = false;
  private connecting = false;
  private retryCount = 0;
  private maxRetries = 5;
  private retryDelay = 1000;
  private retryTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connectionCallbacks: ConnectionCallback[] = [];
  private eventListeners: Map<string, EventCallback[]> = new Map();

  private config = {
    url: import.meta.env.VITE_WS_URL || 'ws://192.168.20.10:7813',
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
    forceNew: true,
  };

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Connect to WebSocket server
   */
  async connect(user?: User): Promise<boolean> {
    if (this.connected || this.connecting) {
      return this.connected;
    }

    this.connecting = true;
    
    try {
      console.log('🔌 Connecting to WebSocket server...', this.config.url);

      this.socket = io(this.config.url, {
        ...this.config,
        auth: {
          token: this.getAuthToken(),
          userId: user?.id,
          userRole: user?.role,
        },
      });

      this.setupSocketListeners();
      
      // Wait for connection or timeout
      const connected = await this.waitForConnection();
      
      if (connected && user) {
        await this.authenticate(user);
      }

      return connected;
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      this.connecting = false;
      this.scheduleReconnect();
      return false;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    console.log('🔌 Disconnecting from WebSocket server...');
    
    this.clearTimers();
    this.connected = false;
    this.connecting = false;
    this.retryCount = 0;

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.notifyConnectionCallbacks(false);
  }

  /**
   * Authenticate with the WebSocket server
   */
  private async authenticate(user: User): Promise<void> {
    if (!this.socket || !this.connected) {
      throw new Error('Not connected to WebSocket server');
    }

    const authMessage = {
      type: 'authenticate',
      token: this.getAuthToken(),
      userId: user.id,
      userRole: user.role,
    };

    this.socket.emit('message', authMessage);
    console.log('🔐 Authenticating with WebSocket server...');
  }

  /**
   * Send message to server
   */
  sendMessage(type: string, data: any): boolean {
    if (!this.socket || !this.connected) {
      console.warn('⚠️ Cannot send message - not connected to WebSocket server');
      return false;
    }

    const message: RealtimeMessage = {
      type: type as any,
      data,
      timestamp: new Date().toISOString(),
    };

    this.socket.emit('message', message);
    console.log('📤 Sent WebSocket message:', type);
    return true;
  }

  /**
   * Join a room
   */
  joinRoom(room: string): boolean {
    return this.sendMessage('join_room', { room });
  }

  /**
   * Leave a room
   */
  leaveRoom(room: string): boolean {
    return this.sendMessage('leave_room', { room });
  }

  /**
   * Request dashboard update
   */
  requestDashboardUpdate(data?: any): boolean {
    return this.sendMessage('dashboard_update', { data });
  }

  /**
   * Send ping to server
   */
  ping(): boolean {
    return this.sendMessage('ping', {});
  }

  /**
   * Subscribe to events
   */
  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Unsubscribe from events
   */
  off(event: string, callback?: EventCallback): void {
    if (!this.eventListeners.has(event)) return;

    if (callback) {
      const callbacks = this.eventListeners.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    } else {
      this.eventListeners.set(event, []);
    }
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionChange(callback: ConnectionCallback): void {
    this.connectionCallbacks.push(callback);
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): RealtimeConnection {
    return {
      connected: this.connected,
      connecting: this.connecting,
      error: null,
      lastConnected: this.connected ? new Date().toISOString() : null,
      retryCount: this.retryCount,
    };
  }

  /**
   * Setup socket event listeners
   */
  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.connected = true;
      this.connecting = false;
      this.retryCount = 0;
      this.startHeartbeat();
      this.notifyConnectionCallbacks(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
      this.connected = false;
      this.connecting = false;
      this.stopHeartbeat();
      this.notifyConnectionCallbacks(false);
      
      // Attempt reconnection unless disconnected manually
      if (reason !== 'io client disconnect') {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      this.connected = false;
      this.connecting = false;
      this.scheduleReconnect();
    });

    this.socket.on('message', (message: RealtimeMessage) => {
      console.log('📨 Received WebSocket message:', message.type);
      this.handleMessage(message);
    });

    this.socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: RealtimeMessage): void {
    const { type, data } = message;

    // Emit to specific event listeners
    this.emit(type, data);
    this.emit('message', message);

    // Handle specific message types
    switch (type) {
      case 'welcome':
        console.log('👋 WebSocket welcome message received');
        break;
      
      case 'authenticated':
        if (data.success) {
          console.log('✅ WebSocket authentication successful');
          this.emit('authenticated', data);
        } else {
          console.error('❌ WebSocket authentication failed:', data.error);
          this.emit('auth_error', data);
        }
        break;
      
      case 'dashboard_update':
        console.log('📊 Dashboard update received');
        this.emit('dashboard_update', data);
        break;
      
      case 'task_update':
        console.log('📋 Task update received');
        this.emit('task_update', data);
        break;
      
      case 'notification':
        console.log('🔔 Notification received');
        this.emit('notification', data);
        break;
      
      case 'security_alert':
        console.log('🚨 Security alert received');
        this.emit('security_alert', data);
        break;
      
      case 'pong':
        // Heartbeat response
        break;
      
      default:
        console.log('📨 Unknown message type:', type);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data: any): void {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket event callback for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Setup default event listeners
   */
  private setupEventListeners(): void {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopHeartbeat();
      } else if (this.connected) {
        this.startHeartbeat();
      }
    });

    // Handle online/offline events
    window.addEventListener('online', () => {
      console.log('📶 Network online - attempting WebSocket reconnection');
      if (!this.connected && !this.connecting) {
        this.scheduleReconnect();
      }
    });

    window.addEventListener('offline', () => {
      console.log('📵 Network offline');
      this.disconnect();
    });
  }

  /**
   * Wait for connection to be established
   */
  private waitForConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.connected) {
        resolve(true);
        return;
      }

      const timeout = setTimeout(() => {
        this.connecting = false;
        resolve(false);
      }, this.config.timeout);

      const checkConnection = () => {
        if (this.connected) {
          clearTimeout(timeout);
          resolve(true);
        } else if (!this.connecting) {
          clearTimeout(timeout);
          resolve(false);
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.retryCount >= this.maxRetries) {
      console.error('❌ Max WebSocket reconnection attempts reached');
      return;
    }

    const delay = this.retryDelay * Math.pow(2, this.retryCount);
    this.retryCount++;

    console.log(`🔄 Scheduling WebSocket reconnection attempt ${this.retryCount} in ${delay}ms`);

    this.retryTimer = setTimeout(() => {
      if (!this.connected && !this.connecting) {
        this.connect();
      }
    }, delay);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.ping();
    }, 30000); // 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.stopHeartbeat();
  }

  /**
   * Notify connection callbacks
   */
  private notifyConnectionCallbacks(connected: boolean): void {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(connected);
      } catch (error) {
        console.error('Error in connection callback:', error);
      }
    });
  }

  /**
   * Get authentication token
   */
  private getAuthToken(): string | null {
    return localStorage.getItem('taskflow_token') || 
           sessionStorage.getItem('taskflow_token');
  }
}

// Create and export singleton instance
export const websocketService = new WebSocketService();
export default websocketService;