/**
 * Real-time Dashboard Component
 * TaskFlow Pro v3.0 - Phase 3 Real-time Implementation
 * Multi-Persona Ultra-Think Enhanced
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import enhancedWsService, { RealtimeNotification, AnalyticsUpdate, TaskUpdate } from '../../services/websocket-enhanced';
import { RootState } from '../../store';
import './RealtimeDashboard.css';

interface RealtimeDashboardProps {
    userId: string;
    userRole: string;
    className?: string;
}

interface LiveMetrics {
    activeTasks: number;
    completedToday: number;
    activeUsers: number;
    teamPerformance: Record<string, any>;
    realTimeConnections: number;
}

const RealtimeDashboard: React.FC<RealtimeDashboardProps> = ({ 
    userId, 
    userRole, 
    className = '' 
}) => {
    const dispatch = useDispatch();
    const [isConnected, setIsConnected] = useState(false);
    const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
    const [liveMetrics, setLiveMetrics] = useState<LiveMetrics>({
        activeTasks: 0,
        completedToday: 0,
        activeUsers: 0,
        teamPerformance: {},
        realTimeConnections: 0
    });
    const [connectionStats, setConnectionStats] = useState(null);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);

    // WebSocket event handlers
    const handleConnection = useCallback((data: any) => {
        console.log('🟢 Real-time dashboard connected:', data.connectionId);
        setIsConnected(true);
        
        // Subscribe to relevant updates based on user role
        if (userRole === 'Master' || userRole === 'Manager') {
            enhancedWsService.subscribeToAnalytics();
            enhancedWsService.joinRoom('managers');
        } else if (userRole === 'Team Lead') {
            enhancedWsService.subscribeToTeamUpdates(userId);
            enhancedWsService.joinRoom('team-leads');
        } else {
            enhancedWsService.subscribeToTaskUpdates([]);
            enhancedWsService.joinRoom('employees');
        }
        
        // Join user-specific room
        enhancedWsService.joinRoom(`user_${userId}`);
    }, [userId, userRole]);

    const handleDisconnection = useCallback((data: any) => {
        console.log('🔴 Real-time dashboard disconnected:', data);
        setIsConnected(false);
    }, []);

    const handleNotification = useCallback((notification: RealtimeNotification) => {
        console.log('🔔 New notification:', notification);
        setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep last 10
        
        // Show browser notification for high priority
        if (notification.priority === 'high' || notification.priority === 'critical') {
            if (Notification.permission === 'granted') {
                new Notification(notification.title, {
                    body: notification.message,
                    icon: '/taskflow-icon.png',
                    tag: notification.id
                });
            }
        }
    }, []);

    const handleAnalyticsUpdate = useCallback((data: AnalyticsUpdate) => {
        console.log('📊 Analytics update received:', data.metrics);
        setLiveMetrics({
            activeTasks: data.metrics.tasks.inProgress,
            completedToday: data.metrics.tasks.completed,
            activeUsers: data.metrics.users.active,
            teamPerformance: data.metrics.teams,
            realTimeConnections: data.metrics.realtime.connections
        });
    }, []);

    const handleTaskUpdate = useCallback((data: TaskUpdate) => {
        console.log('📋 Task update:', data);
        setRecentActivity(prev => [
            {
                id: `task_${data.taskId}_${Date.now()}`,
                type: 'task',
                action: data.action,
                title: data.task.title,
                user: data.userId,
                timestamp: data.timestamp
            },
            ...prev.slice(0, 4) // Keep last 5
        ]);
    }, []);

    const handleUserActivity = useCallback((data: any) => {
        console.log('👤 User activity:', data);
        setRecentActivity(prev => [
            {
                id: `user_${data.userId}_${Date.now()}`,
                type: 'user',
                action: data.action,
                user: data.email || data.userId,
                timestamp: data.timestamp
            },
            ...prev.slice(0, 4)
        ]);
    }, []);

    // Initialize WebSocket connection
    useEffect(() => {
        const initializeConnection = async () => {
            try {
                // Request notification permission
                if ('Notification' in window && Notification.permission === 'default') {
                    await Notification.requestPermission();
                }

                // Get auth token from storage
                const authToken = localStorage.getItem('taskflow_token') || 
                                sessionStorage.getItem('taskflow_token');

                // Set up event listeners
                enhancedWsService.on('connected', handleConnection);
                enhancedWsService.on('disconnected', handleDisconnection);
                enhancedWsService.on('notification', handleNotification);
                enhancedWsService.on('analytics-update', handleAnalyticsUpdate);
                enhancedWsService.on('task-notification', handleTaskUpdate);
                enhancedWsService.on('user-activity', handleUserActivity);

                // Connect to WebSocket
                await enhancedWsService.connect(authToken, userId);
                
                // Update connection stats
                const stats = enhancedWsService.getStatistics();
                setConnectionStats(stats);

            } catch (error) {
                console.error('Failed to initialize real-time connection:', error);
            }
        };

        initializeConnection();

        // Stats update interval
        const statsInterval = setInterval(() => {
            const stats = enhancedWsService.getStatistics();
            setConnectionStats(stats);
        }, 10000);

        // Cleanup
        return () => {
            clearInterval(statsInterval);
            enhancedWsService.off('connected', handleConnection);
            enhancedWsService.off('disconnected', handleDisconnection);
            enhancedWsService.off('notification', handleNotification);
            enhancedWsService.off('analytics-update', handleAnalyticsUpdate);
            enhancedWsService.off('task-notification', handleTaskUpdate);
            enhancedWsService.off('user-activity', handleUserActivity);
        };
    }, [userId, handleConnection, handleDisconnection, handleNotification, handleAnalyticsUpdate, handleTaskUpdate, handleUserActivity]);

    const markNotificationAsRead = (notificationId: string) => {
        setNotifications(prev => 
            prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
    };

    const clearAllNotifications = () => {
        setNotifications([]);
    };

    const getActivityIcon = (type: string, action: string) => {
        if (type === 'task') {
            switch (action) {
                case 'created': return '➕';
                case 'completed': return '✅';
                case 'updated': return '📝';
                case 'assigned': return '👤';
                default: return '📋';
            }
        } else if (type === 'user') {
            switch (action) {
                case 'login': return '🟢';
                case 'logout': return '🔴';
                default: return '👤';
            }
        }
        return '📊';
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical': return '#ff4444';
            case 'high': return '#ff8800';
            case 'medium': return '#4CAF50';
            case 'low': return '#2196F3';
            default: return '#666';
        }
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className={`realtime-dashboard ${className}`}>
            {/* Connection Status */}
            <div className="connection-status">
                <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
                    <span className="status-dot"></span>
                    <span className="status-text">
                        {isConnected ? '🟢 Real-time Connected' : '🔴 Connecting...'}
                    </span>
                </div>
                {connectionStats && (
                    <div className="connection-stats">
                        <span>📊 {connectionStats.messagesReceived} received</span>
                        <span>📤 {connectionStats.messagesSent} sent</span>
                        {connectionStats.reconnectCount > 0 && (
                            <span>🔄 {connectionStats.reconnectCount} reconnections</span>
                        )}
                    </div>
                )}
            </div>

            {/* Live Metrics */}
            <div className="live-metrics">
                <h3>📊 Live Metrics</h3>
                <div className="metrics-grid">
                    <div className="metric-card">
                        <div className="metric-value">{liveMetrics.activeTasks}</div>
                        <div className="metric-label">Active Tasks</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">{liveMetrics.completedToday}</div>
                        <div className="metric-label">Completed Today</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">{liveMetrics.activeUsers}</div>
                        <div className="metric-label">Active Users</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">{liveMetrics.realTimeConnections}</div>
                        <div className="metric-label">Real-time Connections</div>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="recent-activity">
                <h3>⚡ Recent Activity</h3>
                <div className="activity-list">
                    {recentActivity.length === 0 ? (
                        <div className="no-activity">No recent activity</div>
                    ) : (
                        recentActivity.map(activity => (
                            <div key={activity.id} className="activity-item">
                                <span className="activity-icon">
                                    {getActivityIcon(activity.type, activity.action)}
                                </span>
                                <div className="activity-content">
                                    <div className="activity-title">
                                        {activity.title || `${activity.action} by ${activity.user}`}
                                    </div>
                                    <div className="activity-time">
                                        {formatTimestamp(activity.timestamp)}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Notifications */}
            <div className="notifications-panel">
                <div className="notifications-header">
                    <h3>🔔 Notifications ({notifications.filter(n => !n.read).length})</h3>
                    {notifications.length > 0 && (
                        <button 
                            className="clear-all-btn"
                            onClick={clearAllNotifications}
                        >
                            Clear All
                        </button>
                    )}
                </div>
                <div className="notifications-list">
                    {notifications.length === 0 ? (
                        <div className="no-notifications">No notifications</div>
                    ) : (
                        notifications.map(notification => (
                            <div 
                                key={notification.id} 
                                className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                                onClick={() => markNotificationAsRead(notification.id)}
                            >
                                <div 
                                    className="notification-priority"
                                    style={{ backgroundColor: getPriorityColor(notification.priority) }}
                                ></div>
                                <div className="notification-content">
                                    <div className="notification-title">{notification.title}</div>
                                    <div className="notification-message">{notification.message}</div>
                                    <div className="notification-time">
                                        {formatTimestamp(notification.timestamp)}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Team Performance (for managers) */}
            {(userRole === 'Master' || userRole === 'Manager') && Object.keys(liveMetrics.teamPerformance).length > 0 && (
                <div className="team-performance">
                    <h3>🏆 Team Performance</h3>
                    <div className="teams-grid">
                        {Object.entries(liveMetrics.teamPerformance).map(([teamName, performance]: [string, any]) => (
                            <div key={teamName} className="team-card">
                                <div className="team-name">{teamName}</div>
                                <div className="team-score">{performance.performance}</div>
                                <div className="team-stats">
                                    <span>{performance.completionRate}% completion</span>
                                    <span>{performance.memberCount} members</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RealtimeDashboard;