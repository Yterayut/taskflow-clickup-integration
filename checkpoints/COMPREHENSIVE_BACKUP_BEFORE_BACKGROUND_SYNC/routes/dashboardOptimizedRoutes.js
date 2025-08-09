/**
 * Dashboard Optimized Routes - ชื่อและ Response ที่ถูกต้อง
 * เปลี่ยนจาก /api/v2/local/ เป็น /api/v2/dashboard/ 
 * เพื่อให้สื่อความหมายที่ถูกต้อง
 * 
 * Route Structure:
 * - /api/v2/dashboard/data (แทน /api/v2/local/dashboard-data)
 * - /api/v2/dashboard/team-ranking/:teamId
 * - /api/v2/dashboard/member-workload/:memberId
 * - /api/v2/dashboard/team-tasks/:teamId
 * - /api/v2/dashboard/sync/status
 * - /api/v2/dashboard/sync/force
 * - /api/v2/dashboard/cache/clear
 */

const express = require('express');
const CacheService = require('../../services/CacheService');
const ClickUpLocalSyncService = require('../../services/ClickUpLocalSyncService');
const { Pool } = require('pg');
const router = express.Router();

// Initialize services
const cache = new CacheService();
const syncService = new ClickUpLocalSyncService();

// Database connection
const db = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'taskflow',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize cache connection
cache.connect().catch(err => {
    console.warn('⚠️ Redis connection failed, using memory cache only:', err.message);
});

/**
 * GET /api/v2/dashboard/data
 * ดึงข้อมูล Dashboard จาก Local Database พร้อม Cache
 * Response source จะระบุแหล่งข้อมูลที่ถูกต้อง
 */
router.get('/data', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role || 'employee';
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                source: 'authentication_error'
            });
        }

        // Cache key สำหรับ dashboard data
        const cacheKey = `dashboard-data:${userId}:${userRole}`;
        
        // ใช้ Cache getOrSet pattern
        const result = await cache.getOrSet(cacheKey, async () => {
            return await fetchDashboardDataFromLocalDB(userId, userRole);
        }, cache.getCacheTTL('dashboard-data'));

        const responseTime = Date.now() - startTime;

        // Determine correct source label
        let sourceLabel;
        if (result.cache_hit) {
            sourceLabel = cache.isConnected ? "redis_cache" : "memory_cache";
        } else {
            sourceLabel = "postgresql_database";
        }

        res.json({
            success: true,
            data: result.data,
            performance: {
                response_time_ms: responseTime,
                source: sourceLabel,
                cache_hit: result.cache_hit,
                data_layer: "optimized_local_database",
                sync_status: await getSyncHealthStatus(),
                timestamp: new Date().toISOString()
            },
            user: {
                id: userId,
                role: userRole
            },
            system: {
                version: "2.0.0-optimized",
                architecture: "local_db_cache_hybrid"
            }
        });

    } catch (error) {
        console.error('❌ Dashboard data error:', error.message);
        
        const responseTime = Date.now() - startTime;
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard data',
            performance: {
                response_time_ms: responseTime,
                source: "error",
                cache_hit: false
            }
        });
    }
});

/**
 * GET /api/v2/dashboard/team-ranking/:teamId
 * ดึงข้อมูล Team Ranking จาก Local Database พร้อม Cache
 */
router.get('/team-ranking/:teamId?', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const teamId = req.params.teamId || req.user?.teamId;
        const userId = req.user?.id;
        
        if (!teamId) {
            return res.status(400).json({
                success: false,
                error: 'Team ID required',
                source: "parameter_validation_error"
            });
        }

        const cacheKey = `team-ranking:${teamId}`;
        
        const result = await cache.getOrSet(cacheKey, async () => {
            return await fetchTeamRankingFromLocalDB(teamId);
        }, cache.getCacheTTL('team-ranking'));

        const responseTime = Date.now() - startTime;

        let sourceLabel = result.cache_hit 
            ? (cache.isConnected ? "redis_cache" : "memory_cache")
            : "postgresql_database";

        res.json({
            success: true,
            data: result.data,
            performance: {
                response_time_ms: responseTime,
                source: sourceLabel,
                cache_hit: result.cache_hit,
                data_layer: "optimized_local_database"
            },
            metadata: {
                team_id: teamId,
                ranking_algorithm: "completion_rate_weighted",
                last_calculated: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Team ranking error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch team ranking',
            source: "database_error"
        });
    }
});

/**
 * GET /api/v2/dashboard/member-workload/:memberId
 * ดึงข้อมูล Member Workload จาก Local Database พร้อม Cache
 */
router.get('/member-workload/:memberId?', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const memberId = req.params.memberId || req.user?.clickupId;
        
        if (!memberId) {
            return res.status(400).json({
                success: false,
                error: 'Member ID required',
                source: "parameter_validation_error"
            });
        }

        const cacheKey = `member-workload:${memberId}`;
        
        const result = await cache.getOrSet(cacheKey, async () => {
            return await fetchMemberWorkloadFromLocalDB(memberId);
        }, cache.getCacheTTL('member-workload'));

        const responseTime = Date.now() - startTime;

        let sourceLabel = result.cache_hit 
            ? (cache.isConnected ? "redis_cache" : "memory_cache")
            : "postgresql_database";

        res.json({
            success: true,
            data: result.data,
            performance: {
                response_time_ms: responseTime,
                source: sourceLabel,
                cache_hit: result.cache_hit,
                data_layer: "optimized_local_database"
            },
            metadata: {
                member_id: memberId,
                calculation_time: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Member workload error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch member workload',
            source: "database_error"
        });
    }
});

/**
 * GET /api/v2/dashboard/team-tasks/:teamId
 * ดึงข้อมูล Team Tasks จาก Local Database พร้อม Cache และ Filters
 */
router.get('/team-tasks/:teamId', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const teamId = req.params.teamId;
        const filters = {
            status: req.query.status,
            assignee: req.query.assignee,
            priority: req.query.priority,
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0
        };

        const cacheKey = `team-tasks:${teamId}:${JSON.stringify(filters)}`;
        
        const result = await cache.getOrSet(cacheKey, async () => {
            return await fetchTeamTasksFromLocalDB(teamId, filters);
        }, cache.getCacheTTL('team-tasks'));

        const responseTime = Date.now() - startTime;

        let sourceLabel = result.cache_hit 
            ? (cache.isConnected ? "redis_cache" : "memory_cache")
            : "postgresql_database";

        res.json({
            success: true,
            data: result.data,
            performance: {
                response_time_ms: responseTime,
                source: sourceLabel,
                cache_hit: result.cache_hit,
                data_layer: "optimized_local_database"
            },
            filters_applied: filters,
            metadata: {
                team_id: teamId,
                query_time: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Team tasks error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch team tasks',
            source: "database_error"
        });
    }
});

/**
 * GET /api/v2/dashboard/sync/status
 * ตรวจสอบสถานะระบบ Sync และ Cache
 */
router.get('/sync/status', async (req, res) => {
    try {
        const syncHealth = syncService.getHealthStatus();
        const cacheHealth = cache.getHealthStatus();
        const dbStatus = await checkDatabaseStatus();

        res.json({
            success: true,
            sync_service: {
                ...syncHealth,
                description: "Background ClickUp API to Local Database sync"
            },
            cache_service: {
                ...cacheHealth,
                description: "Redis/Memory cache for performance optimization"
            },
            database: {
                ...dbStatus,
                description: "PostgreSQL local database storage"
            },
            overall_health: calculateOverallSystemHealth(syncHealth, cacheHealth, dbStatus),
            architecture: {
                data_flow: "ClickUp API → Background Sync → PostgreSQL → Cache → API Response",
                performance_layer: "3-tier caching (Memory + Redis + Database)"
            }
        });

    } catch (error) {
        console.error('❌ Sync status error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get system status',
            source: "system_health_check_error"
        });
    }
});

/**
 * POST /api/v2/dashboard/sync/force
 * บังคับ Sync ข้อมูลจาก ClickUp API ทันที
 */
router.post('/sync/force', async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'master') {
            return res.status(403).json({
                success: false,
                error: 'Master role required for manual sync',
                source: "authorization_error"
            });
        }

        console.log('🔄 Force sync triggered by user:', req.user.email);
        
        // Clear related cache
        await cache.deletePattern('dashboard-data:*');
        await cache.deletePattern('team-*');
        await cache.deletePattern('member-*');
        
        // Trigger sync
        await syncService.forceSyncNow();

        res.json({
            success: true,
            message: 'Manual sync initiated successfully',
            initiated_by: req.user.email,
            timestamp: new Date().toISOString(),
            source: "manual_sync_trigger"
        });

    } catch (error) {
        console.error('❌ Force sync error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to initiate manual sync',
            source: "sync_service_error"
        });
    }
});

/**
 * DELETE /api/v2/dashboard/cache/clear
 * ล้าง Cache ทั้งหมด
 */
router.delete('/cache/clear', async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'master') {
            return res.status(403).json({
                success: false,
                error: 'Master role required for cache management',
                source: "authorization_error"
            });
        }

        const beforeStats = cache.getStats();
        await cache.clear();
        const afterStats = cache.getStats();

        res.json({
            success: true,
            message: 'Cache cleared successfully',
            cleared_by: req.user.email,
            cache_stats: {
                before: beforeStats,
                after: afterStats
            },
            timestamp: new Date().toISOString(),
            source: "manual_cache_clear"
        });

    } catch (error) {
        console.error('❌ Cache clear error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to clear cache',
            source: "cache_service_error"
        });
    }
});

/**
 * GET /api/v2/dashboard/performance/metrics
 * ดึงข้อมูล Performance Metrics ของระบบ
 */
router.get('/performance/metrics', async (req, res) => {
    try {
        const cacheStats = cache.getStats();
        const syncStats = syncService.getSyncStatistics();
        const systemMetrics = await getSystemPerformanceMetrics();

        res.json({
            success: true,
            metrics: {
                cache: {
                    ...cacheStats,
                    description: "Cache performance statistics"
                },
                sync: {
                    ...syncStats,
                    description: "Background sync performance"
                },
                system: {
                    ...systemMetrics,
                    description: "Overall system performance"
                }
            },
            recommendations: generatePerformanceRecommendations(cacheStats, syncStats, systemMetrics),
            timestamp: new Date().toISOString(),
            source: "performance_monitoring_system"
        });

    } catch (error) {
        console.error('❌ Performance metrics error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get performance metrics',
            source: "metrics_collection_error"
        });
    }
});

// Helper Functions (same as localDataOptimizedRoutes.js but with correct response labeling)

async function fetchDashboardDataFromLocalDB(userId, userRole) {
    try {
        let query;
        let params;

        if (userRole === 'master' || userRole === 'manager') {
            // Manager/Master sees all teams
            query = `
                SELECT 
                    t.id as team_id,
                    t.name as team_name,
                    t.member_count,
                    COUNT(DISTINCT tk.id) as total_tasks,
                    COUNT(DISTINCT CASE WHEN tk.status_name != 'Complete' AND tk.archived = false THEN tk.id END) as active_tasks,
                    COUNT(DISTINCT CASE WHEN tk.status_name = 'Complete' THEN tk.id END) as completed_tasks,
                    COUNT(DISTINCT CASE WHEN tk.due_date IS NOT NULL AND tk.due_date < EXTRACT(epoch FROM NOW()) * 1000 AND tk.status_name != 'Complete' THEN tk.id END) as overdue_tasks,
                    AVG(CASE WHEN tk.status_name = 'Complete' AND tk.time_spent > 0 THEN tk.time_spent END) as avg_completion_time
                FROM clickup_teams t
                LEFT JOIN clickup_tasks tk ON t.id = tk.team_id
                GROUP BY t.id, t.name, t.member_count
                ORDER BY t.name
            `;
            params = [];
        } else {
            // Employee sees only their data
            query = `
                SELECT 
                    m.team_id,
                    t.name as team_name,
                    COUNT(DISTINCT tk.id) as my_total_tasks,
                    COUNT(DISTINCT CASE WHEN tk.status_name != 'Complete' AND tk.archived = false THEN tk.id END) as my_active_tasks,
                    COUNT(DISTINCT CASE WHEN tk.status_name = 'Complete' THEN tk.id END) as my_completed_tasks,
                    COUNT(DISTINCT CASE WHEN tk.due_date IS NOT NULL AND tk.due_date < EXTRACT(epoch FROM NOW()) * 1000 AND tk.status_name != 'Complete' THEN tk.id END) as my_overdue_tasks
                FROM clickup_members m
                JOIN clickup_teams t ON m.team_id = t.id
                LEFT JOIN clickup_tasks tk ON m.id = tk.assignee_id
                WHERE m.email = (SELECT email FROM users WHERE id = $1)
                GROUP BY m.team_id, t.name
            `;
            params = [userId];
        }

        const result = await db.query(query, params);
        
        // Get additional data for comprehensive dashboard
        const membersQuery = userRole === 'employee' 
            ? `SELECT * FROM clickup_members WHERE email = (SELECT email FROM users WHERE id = $1)`
            : `SELECT * FROM clickup_members ORDER BY username`;
        
        const membersResult = await db.query(membersQuery, userRole === 'employee' ? [userId] : []);

        return {
            teams: result.rows,
            members: membersResult.rows,
            last_sync: await getLastSyncTime(),
            data_freshness: await getDataFreshness(),
            architecture: "local_postgresql_database"
        };

    } catch (error) {
        console.error('❌ Error fetching dashboard data from local DB:', error.message);
        throw error;
    }
}

async function fetchTeamRankingFromLocalDB(teamId) {
    try {
        const query = `
            SELECT * FROM v_member_workload 
            WHERE team_id = $1 
            ORDER BY completed_tasks DESC, (total_time_spent::float / NULLIF(total_estimated_time, 0)) DESC
        `;
        
        const result = await db.query(query, [teamId]);
        
        // Calculate ranking with score
        const ranking = result.rows.map((member, index) => {
            const completionRate = member.total_tasks > 0 ? (member.completed_tasks / member.total_tasks) * 100 : 0;
            const efficiency = member.total_estimated_time > 0 ? (member.total_time_spent / member.total_estimated_time) * 100 : 100;
            const score = completionRate * 0.7 + (100 - Math.min(efficiency, 200)) * 0.3;
            
            return {
                ...member,
                rank: index + 1,
                completion_rate: Math.round(completionRate),
                efficiency_rate: Math.round(efficiency),
                score: Math.round(score)
            };
        });

        return ranking;

    } catch (error) {
        console.error('❌ Error fetching team ranking from local DB:', error.message);
        throw error;
    }
}

async function fetchMemberWorkloadFromLocalDB(memberId) {
    try {
        const query = `
            SELECT 
                m.*,
                COUNT(DISTINCT tk.id) as total_tasks,
                COUNT(DISTINCT CASE WHEN tk.status_name != 'Complete' AND tk.archived = false THEN tk.id END) as active_tasks,
                COUNT(DISTINCT CASE WHEN tk.status_name = 'Complete' THEN tk.id END) as completed_tasks,
                COUNT(DISTINCT CASE WHEN tk.priority_name = 'urgent' THEN tk.id END) as urgent_tasks,
                SUM(CASE WHEN tk.time_estimate > 0 THEN tk.time_estimate END) as total_estimated_time,
                SUM(CASE WHEN tk.time_spent > 0 THEN tk.time_spent END) as total_time_spent,
                AVG(CASE WHEN tk.status_name = 'Complete' AND tk.time_spent > 0 THEN tk.time_spent END) as avg_task_time
            FROM clickup_members m
            LEFT JOIN clickup_tasks tk ON m.id = tk.assignee_id
            WHERE m.id = $1
            GROUP BY m.id, m.username, m.email, m.team_id
        `;
        
        const result = await db.query(query, [memberId]);
        
        if (result.rows.length === 0) {
            throw new Error('Member not found');
        }

        const member = result.rows[0];
        
        // Get recent tasks for this member
        const tasksQuery = `
            SELECT * FROM clickup_tasks 
            WHERE assignee_id = $1 AND archived = false 
            ORDER BY date_updated DESC 
            LIMIT 20
        `;
        
        const tasksResult = await db.query(tasksQuery, [memberId]);

        return {
            member: member,
            recent_tasks: tasksResult.rows,
            performance: {
                completion_rate: member.total_tasks > 0 ? Math.round((member.completed_tasks / member.total_tasks) * 100) : 0,
                efficiency: member.total_estimated_time > 0 ? Math.round((member.total_time_spent / member.total_estimated_time) * 100) : 100,
                workload_score: calculateWorkloadScore(member)
            }
        };

    } catch (error) {
        console.error('❌ Error fetching member workload from local DB:', error.message);
        throw error;
    }
}

async function fetchTeamTasksFromLocalDB(teamId, filters) {
    try {
        let whereClause = 'WHERE t.team_id = $1 AND t.archived = false';
        let params = [teamId];
        let paramIndex = 2;

        if (filters.status) {
            whereClause += ` AND t.status_name = $${paramIndex}`;
            params.push(filters.status);
            paramIndex++;
        }

        if (filters.assignee) {
            whereClause += ` AND t.assignee_id = $${paramIndex}`;
            params.push(filters.assignee);
            paramIndex++;
        }

        if (filters.priority) {
            whereClause += ` AND t.priority_name = $${paramIndex}`;
            params.push(filters.priority);
            paramIndex++;
        }

        const query = `
            SELECT 
                t.*,
                m.username as assignee_name,
                m.email as assignee_email
            FROM clickup_tasks t
            LEFT JOIN clickup_members m ON t.assignee_id = m.id
            ${whereClause}
            ORDER BY 
                CASE WHEN t.priority_name = 'urgent' THEN 1 
                     WHEN t.priority_name = 'high' THEN 2 
                     WHEN t.priority_name = 'normal' THEN 3 
                     ELSE 4 END,
                t.due_date ASC NULLS LAST,
                t.date_updated DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        params.push(filters.limit, filters.offset);

        const result = await db.query(query, params);
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM clickup_tasks t
            ${whereClause.replace(/LIMIT.*/, '')}
        `;
        
        const countResult = await db.query(countQuery, params.slice(0, -2));

        return {
            tasks: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0].total),
                limit: filters.limit,
                offset: filters.offset,
                has_more: (filters.offset + filters.limit) < parseInt(countResult.rows[0].total)
            }
        };

    } catch (error) {
        console.error('❌ Error fetching team tasks from local DB:', error.message);
        throw error;
    }
}

// Additional Helper Functions

async function getSyncHealthStatus() {
    try {
        const result = await db.query(`
            SELECT 
                status,
                completed_at,
                sync_duration_ms,
                synced_records
            FROM clickup_sync_status 
            ORDER BY started_at DESC 
            LIMIT 1
        `);
        
        if (result.rows.length > 0) {
            const lastSync = result.rows[0];
            return {
                last_sync_status: lastSync.status,
                last_sync_time: lastSync.completed_at,
                last_sync_duration: lastSync.sync_duration_ms,
                records_synced: lastSync.synced_records
            };
        }
        
        return { status: 'no_sync_data' };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
}

async function checkDatabaseStatus() {
    try {
        const result = await db.query('SELECT NOW() as current_time, version() as db_version');
        const tablesResult = await db.query(`
            SELECT table_name, 
                   (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
            FROM information_schema.tables t 
            WHERE table_schema = 'public' AND table_name LIKE 'clickup_%'
        `);
        
        return {
            status: 'healthy',
            connected: true,
            current_time: result.rows[0].current_time,
            version: result.rows[0].db_version,
            clickup_tables: tablesResult.rows
        };
    } catch (error) {
        return {
            status: 'error',
            connected: false,
            error: error.message
        };
    }
}

async function getLastSyncTime() {
    try {
        const result = await db.query(`
            SELECT completed_at 
            FROM clickup_sync_status 
            WHERE status = 'completed' 
            ORDER BY completed_at DESC 
            LIMIT 1
        `);
        
        return result.rows.length > 0 ? result.rows[0].completed_at : null;
    } catch (error) {
        return null;
    }
}

async function getDataFreshness() {
    try {
        const result = await db.query(`
            SELECT 
                MIN(synced_at) as oldest_sync,
                MAX(synced_at) as newest_sync,
                AVG(EXTRACT(epoch FROM (NOW() - synced_at))) as avg_age_seconds
            FROM (
                SELECT synced_at FROM clickup_teams
                UNION ALL
                SELECT synced_at FROM clickup_members  
                UNION ALL
                SELECT synced_at FROM clickup_tasks
            ) as all_syncs
        `);
        
        return result.rows[0];
    } catch (error) {
        return null;
    }
}

async function getSystemPerformanceMetrics() {
    try {
        const dbMetrics = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM clickup_teams) as total_teams,
                (SELECT COUNT(*) FROM clickup_members) as total_members,
                (SELECT COUNT(*) FROM clickup_tasks) as total_tasks,
                (SELECT COUNT(*) FROM clickup_tasks WHERE archived = false) as active_tasks
        `);
        
        return {
            database_records: dbMetrics.rows[0],
            system_uptime: process.uptime(),
            memory_usage: process.memoryUsage(),
            node_version: process.version
        };
    } catch (error) {
        return { error: error.message };
    }
}

function generatePerformanceRecommendations(cacheStats, syncStats, systemMetrics) {
    const recommendations = [];
    
    // Cache recommendations
    if (cacheStats.hitRate && parseFloat(cacheStats.hitRate.replace('%', '')) < 70) {
        recommendations.push({
            category: 'cache',
            severity: 'medium',
            message: 'Cache hit rate is below 70%. Consider increasing cache TTL or optimizing cache keys.',
            action: 'Increase cache TTL for frequently accessed data'
        });
    }
    
    // Sync recommendations
    if (syncStats.failedSyncs > 0) {
        recommendations.push({
            category: 'sync',
            severity: 'high',
            message: 'Sync failures detected. Check ClickUp API connectivity and error logs.',
            action: 'Review sync service logs and ClickUp API status'
        });
    }
    
    // System recommendations
    if (systemMetrics.memory_usage?.heapUsed > 100 * 1024 * 1024) { // 100MB
        recommendations.push({
            category: 'system',
            severity: 'low',
            message: 'High memory usage detected. Monitor for potential memory leaks.',
            action: 'Review memory usage patterns and implement memory optimization'
        });
    }
    
    return recommendations;
}

function calculateWorkloadScore(member) {
    const taskRatio = member.active_tasks / Math.max(member.total_tasks, 1);
    const urgentRatio = member.urgent_tasks / Math.max(member.active_tasks, 1);
    const efficiencyScore = member.total_estimated_time > 0 ? 
        Math.min(member.total_time_spent / member.total_estimated_time, 2) : 1;
    
    return Math.round((taskRatio * 40 + urgentRatio * 30 + efficiencyScore * 30) * 100);
}

function calculateOverallSystemHealth(syncHealth, cacheHealth, dbStatus) {
    let score = 0;
    let maxScore = 0;
    
    // Sync health (40% weight)
    if (syncHealth.healthScore !== undefined) {
        score += syncHealth.healthScore * 0.4;
    }
    maxScore += 40;
    
    // Cache health (30% weight)
    if (cacheHealth.stats?.healthScore !== undefined) {
        score += cacheHealth.stats.healthScore * 0.3;
    }
    maxScore += 30;
    
    // Database health (30% weight)
    if (dbStatus.status === 'healthy') {
        score += 100 * 0.3;
    }
    maxScore += 30;
    
    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

module.exports = router;