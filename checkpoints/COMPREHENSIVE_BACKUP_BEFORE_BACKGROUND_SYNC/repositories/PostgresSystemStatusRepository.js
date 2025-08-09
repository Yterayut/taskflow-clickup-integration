/**
 * PostgreSQL System Status Repository
 * Implements system status data persistence
 */
class PostgresSystemStatusRepository {
    constructor(dbClient) {
        this.db = dbClient;
    }
    
    /**
     * Update system status
     */
    async updateStatus(statusData) {
        try {
            // Use upsert pattern to ensure there's always one status record
            const result = await this.db.query(`
                INSERT INTO system_status (
                    clickup_connected,
                    last_token_refresh,
                    last_health_check,
                    master_token_expires_at,
                    total_active_sessions,
                    created_at,
                    updated_at
                ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                    clickup_connected = COALESCE(EXCLUDED.clickup_connected, system_status.clickup_connected),
                    last_token_refresh = COALESCE(EXCLUDED.last_token_refresh, system_status.last_token_refresh),
                    last_health_check = EXCLUDED.last_health_check,
                    master_token_expires_at = COALESCE(EXCLUDED.master_token_expires_at, system_status.master_token_expires_at),
                    total_active_sessions = COALESCE(EXCLUDED.total_active_sessions, system_status.total_active_sessions),
                    updated_at = NOW()
                RETURNING *
            `, [
                statusData.clickup_connected,
                statusData.last_token_refresh,
                statusData.last_health_check || new Date(),
                statusData.master_token_expires_at,
                statusData.total_active_sessions || 0
            ]);
            
            return result.rows[0];
        } catch (error) {
            // If the conflict handling doesn't work, fall back to simple upsert
            try {
                const existingResult = await this.db.query('SELECT id FROM system_status LIMIT 1');
                
                if (existingResult.rows.length > 0) {
                    // Update existing record
                    const updateResult = await this.db.query(`
                        UPDATE system_status 
                        SET 
                            clickup_connected = COALESCE($1, clickup_connected),
                            last_token_refresh = COALESCE($2, last_token_refresh),
                            last_health_check = $3,
                            master_token_expires_at = COALESCE($4, master_token_expires_at),
                            total_active_sessions = COALESCE($5, total_active_sessions),
                            updated_at = NOW()
                        WHERE id = $6
                        RETURNING *
                    `, [
                        statusData.clickup_connected,
                        statusData.last_token_refresh,
                        statusData.last_health_check || new Date(),
                        statusData.master_token_expires_at,
                        statusData.total_active_sessions || 0,
                        existingResult.rows[0].id
                    ]);
                    
                    return updateResult.rows[0];
                } else {
                    // Insert new record
                    const insertResult = await this.db.query(`
                        INSERT INTO system_status (
                            clickup_connected,
                            last_token_refresh,
                            last_health_check,
                            master_token_expires_at,
                            total_active_sessions,
                            created_at,
                            updated_at
                        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                        RETURNING *
                    `, [
                        statusData.clickup_connected,
                        statusData.last_token_refresh,
                        statusData.last_health_check || new Date(),
                        statusData.master_token_expires_at,
                        statusData.total_active_sessions || 0
                    ]);
                    
                    return insertResult.rows[0];
                }
            } catch (fallbackError) {
                console.error('Error updating system status (fallback):', fallbackError);
                throw fallbackError;
            }
        }
    }
    
    /**
     * Get current system status
     */
    async getCurrentStatus() {
        try {
            const result = await this.db.query(
                'SELECT * FROM system_status ORDER BY updated_at DESC LIMIT 1'
            );
            
            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            console.error('Error getting current system status:', error);
            throw error;
        }
    }
    
    /**
     * Get system status history
     */
    async getStatusHistory(options = {}) {
        try {
            const { limit = 50, offset = 0, hoursBack = 24 } = options;
            
            const cutoffDate = new Date();
            cutoffDate.setHours(cutoffDate.getHours() - hoursBack);
            
            const result = await this.db.query(`
                SELECT * FROM system_status 
                WHERE updated_at >= $1
                ORDER BY updated_at DESC 
                LIMIT $2 OFFSET $3
            `, [cutoffDate, limit, offset]);
            
            return result.rows;
        } catch (error) {
            console.error('Error getting system status history:', error);
            throw error;
        }
    }
    
    /**
     * Clean up old status records
     */
    async cleanupOldStatus(daysToKeep = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            
            // Keep at least one record (the most recent)
            const result = await this.db.query(`
                DELETE FROM system_status 
                WHERE updated_at < $1 
                AND id NOT IN (
                    SELECT id FROM system_status 
                    ORDER BY updated_at DESC 
                    LIMIT 1
                )
            `, [cutoffDate]);
            
            return result.rowCount;
        } catch (error) {
            console.error('Error cleaning up old status records:', error);
            throw error;
        }
    }
    
    /**
     * Get system status statistics
     */
    async getStatusStatistics() {
        try {
            const result = await this.db.query(`
                SELECT 
                    COUNT(*) as total_records,
                    COUNT(CASE WHEN clickup_connected = true THEN 1 END) as connected_count,
                    COUNT(CASE WHEN clickup_connected = false THEN 1 END) as disconnected_count,
                    AVG(total_active_sessions) as avg_active_sessions,
                    MAX(last_health_check) as latest_health_check,
                    MIN(created_at) as earliest_record
                FROM system_status
            `);
            
            return result.rows[0];
        } catch (error) {
            console.error('Error getting status statistics:', error);
            throw error;
        }
    }
    
    /**
     * Get uptime percentage for a given period
     */
    async getUptimePercentage(hoursBack = 24) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setHours(cutoffDate.getHours() - hoursBack);
            
            const result = await this.db.query(`
                SELECT 
                    COUNT(*) as total_checks,
                    COUNT(CASE WHEN clickup_connected = true THEN 1 END) as successful_checks,
                    CASE 
                        WHEN COUNT(*) > 0 THEN 
                            (COUNT(CASE WHEN clickup_connected = true THEN 1 END)::float / COUNT(*)::float) * 100
                        ELSE 0 
                    END as uptime_percentage
                FROM system_status 
                WHERE updated_at >= $1
            `, [cutoffDate]);
            
            return result.rows[0];
        } catch (error) {
            console.error('Error calculating uptime percentage:', error);
            throw error;
        }
    }
    
    /**
     * Health check
     */
    async healthCheck() {
        try {
            await this.db.query('SELECT 1 FROM system_status LIMIT 1');
            return true;
        } catch (error) {
            throw new Error('System status table health check failed');
        }
    }
    
    /**
     * Initialize system status table with default record
     */
    async initialize() {
        try {
            const existingResult = await this.db.query('SELECT COUNT(*) as count FROM system_status');
            
            if (parseInt(existingResult.rows[0].count) === 0) {
                await this.updateStatus({
                    clickup_connected: false,
                    last_health_check: new Date(),
                    total_active_sessions: 0
                });
                
                console.log('✅ System status initialized with default record');
            }
        } catch (error) {
            console.error('Error initializing system status:', error);
            throw error;
        }
    }
}

module.exports = { PostgresSystemStatusRepository };