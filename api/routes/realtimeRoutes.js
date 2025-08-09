/**
 * Realtime API Routes
 * TaskFlow Pro v2.2 - WebSocket management endpoints
 */

const express = require('express');
const router = express.Router();

/**
 * Initialize realtime routes with dependencies
 */
function createRealtimeRoutes(realtimeService) {
    
    /**
     * GET /api/v2/realtime/status
     * Get realtime service status
     */
    router.get('/status', async (req, res) => {
        try {
            const stats = realtimeService.getStats();
            const status = {
                enabled: realtimeService.isRunning,
                port: realtimeService.config.port,
                connections: stats.connections,
                uptime: stats.uptime,
                messagesSent: stats.messagesSent,
                messagesReceived: stats.messagesReceived,
                rooms: stats.rooms.length,
                timestamp: new Date().toISOString()
            };

            res.json({
                success: true,
                status,
                stats
            });
        } catch (error) {
            console.error('Error getting realtime status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get realtime status'
            });
        }
    });

    /**
     * GET /api/v2/realtime/clients
     * Get connected clients info (admin only)
     */
    router.get('/clients', async (req, res) => {
        try {
            // TODO: Add admin authentication check
            const clients = realtimeService.getClients();
            
            res.json({
                success: true,
                clients,
                count: clients.length
            });
        } catch (error) {
            console.error('Error getting clients:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get clients'
            });
        }
    });

    /**
     * POST /api/v2/realtime/broadcast
     * Broadcast message to all connected clients (admin only)
     */
    router.post('/broadcast', async (req, res) => {
        try {
            const { message, type = 'announcement', targetRoom } = req.body;

            if (!message) {
                return res.status(400).json({
                    success: false,
                    error: 'Message is required'
                });
            }

            const broadcastData = {
                type,
                message,
                timestamp: new Date().toISOString(),
                from: 'system'
            };

            let sentCount;
            if (targetRoom) {
                sentCount = realtimeService.broadcastToRoom(targetRoom, broadcastData);
            } else {
                sentCount = realtimeService.broadcastToAll(broadcastData);
            }

            res.json({
                success: true,
                message: 'Broadcast sent successfully',
                sentTo: sentCount,
                targetRoom: targetRoom || 'all'
            });
        } catch (error) {
            console.error('Error broadcasting message:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to broadcast message'
            });
        }
    });

    /**
     * POST /api/v2/realtime/dashboard-update
     * Trigger dashboard update for all users
     */
    router.post('/dashboard-update', async (req, res) => {
        try {
            const { data, targetUsers } = req.body;

            const updateData = {
                type: 'dashboard_refresh',
                data: data || {},
                timestamp: new Date().toISOString()
            };

            let sentCount;
            if (targetUsers && Array.isArray(targetUsers)) {
                sentCount = 0;
                for (const userId of targetUsers) {
                    sentCount += realtimeService.broadcastToRoom(`user_${userId}`, updateData);
                }
            } else {
                sentCount = realtimeService.sendDashboardUpdate(updateData);
            }

            res.json({
                success: true,
                message: 'Dashboard update sent',
                sentTo: sentCount
            });
        } catch (error) {
            console.error('Error sending dashboard update:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send dashboard update'
            });
        }
    });

    /**
     * POST /api/v2/realtime/task-notification
     * Send task-related notification
     */
    router.post('/task-notification', async (req, res) => {
        try {
            const { taskData, targetUsers, notificationType = 'task_update' } = req.body;

            if (!taskData) {
                return res.status(400).json({
                    success: false,
                    error: 'Task data is required'
                });
            }

            const notification = {
                type: notificationType,
                data: taskData,
                timestamp: new Date().toISOString()
            };

            let sentCount;
            if (targetUsers && Array.isArray(targetUsers)) {
                sentCount = 0;
                for (const userId of targetUsers) {
                    sentCount += realtimeService.broadcastToRoom(`user_${userId}`, notification);
                }
            } else {
                sentCount = realtimeService.broadcastToAll(notification);
            }

            res.json({
                success: true,
                message: 'Task notification sent',
                sentTo: sentCount,
                type: notificationType
            });
        } catch (error) {
            console.error('Error sending task notification:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send task notification'
            });
        }
    });

    /**
     * POST /api/v2/realtime/security-alert
     * Send security alert to administrators
     */
    router.post('/security-alert', async (req, res) => {
        try {
            const { alertData } = req.body;

            if (!alertData) {
                return res.status(400).json({
                    success: false,
                    error: 'Alert data is required'
                });
            }

            const sentCount = realtimeService.sendSecurityAlert(alertData);

            res.json({
                success: true,
                message: 'Security alert sent',
                sentTo: sentCount
            });
        } catch (error) {
            console.error('Error sending security alert:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send security alert'
            });
        }
    });

    /**
     * GET /api/v2/realtime/rooms
     * Get information about active rooms
     */
    router.get('/rooms', async (req, res) => {
        try {
            const stats = realtimeService.getStats();
            
            res.json({
                success: true,
                rooms: stats.roomCounts,
                totalRooms: stats.rooms.length
            });
        } catch (error) {
            console.error('Error getting rooms:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get rooms'
            });
        }
    });

    /**
     * DELETE /api/v2/realtime/client/:clientId
     * Disconnect specific client (admin only)
     */
    router.delete('/client/:clientId', async (req, res) => {
        try {
            const { clientId } = req.params;
            const { reason = 'Disconnected by administrator' } = req.body;

            const client = realtimeService.clients.get(clientId);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    error: 'Client not found'
                });
            }

            // Send disconnection message to client
            realtimeService.sendToClient(clientId, {
                type: 'forced_disconnect',
                reason,
                timestamp: new Date().toISOString()
            });

            // Close the connection
            client.ws.close(1008, reason);

            res.json({
                success: true,
                message: 'Client disconnected successfully',
                clientId
            });
        } catch (error) {
            console.error('Error disconnecting client:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to disconnect client'
            });
        }
    });

    /**
     * GET /api/v2/realtime/health
     * Health check endpoint for realtime service
     */
    router.get('/health', async (req, res) => {
        try {
            const isHealthy = realtimeService.isRunning;
            const stats = realtimeService.getStats();

            res.status(isHealthy ? 200 : 503).json({
                success: isHealthy,
                status: isHealthy ? 'healthy' : 'unhealthy',
                service: 'TaskFlow Realtime Service',
                version: '2.2.0',
                uptime: stats.uptime,
                connections: stats.connections,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(503).json({
                success: false,
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    return router;
}

module.exports = createRealtimeRoutes;