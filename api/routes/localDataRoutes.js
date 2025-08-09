/**
 * Local Data Routes - Phase 2 Redis Cache Implementation
 * Provides ultra-fast cached endpoints for dashboard data
 */
const express = require('express');
const CacheService = require('../../services/CacheService');
const router = express.Router();

/**
 * GET /api/v2/local/dashboard-data
 * Get dashboard data with Redis cache (Phase 2 Implementation)
 */
router.get('/dashboard-data', async (req, res) => {
    try {
        const startTime = Date.now();
        const syncRepository = req.app.get('syncRepository');
        const clickupService = req.app.get('clickupService');
        const tokenRepository = req.app.get('tokenRepository');
        const cacheService = req.app.get('cacheService');
        
        // Generate cache key for dashboard data
        const cacheKey = cacheService?.generateKey(
            CacheService.CACHE_KEYS.DASHBOARD_DATA, 
            'all_teams'
        ) || 'dashboard_data:all_teams';
        
        // Try to get from Redis cache first
        if (cacheService && cacheService.isReady()) {
            try {
                const result = await cacheService.getCachedOrFetch(
                    cacheKey,
                    async () => {
                        // Fetch from local database
                        if (!syncRepository) {
                            throw new Error('ClickUpSyncRepository not available');
                        }
                        
                        const localData = await syncRepository.getDashboardData();
                        const hasData = localData.tasks && localData.tasks.length > 0;
                        
                        if (hasData) {
                            return localData;
                        } else {
                            throw new Error('Local database has no data');
                        }
                    },
                    CacheService.TTL.DASHBOARD
                );
                
                const responseTime = Date.now() - startTime;
                
                console.log(`🚀 Dashboard data served from ${result.source} in ${responseTime}ms (${result.data.tasks?.length || 0} tasks)`);
                
                return res.json({
                    success: true,
                    data: result.data,
                    performance: {
                        response_time_ms: responseTime,
                        source: result.source === 'redis_cache' ? 'redis_cache' : 'local_database',
                        cache_hit: result.cache_hit,
                        data_freshness: result.data.performance?.data_freshness || null
                    },
                    timestamp: new Date().toISOString()
                });
                
            } catch (cacheError) {
                console.log('⚠️ Cache/Local database error, falling back to ClickUp API:', cacheError.message);
            }
        } else {
            console.log('⚠️ Redis cache not available, trying local database...');
            
            // Try local database directly if cache not available
            try {
                if (!syncRepository) {
                    throw new Error('ClickUpSyncRepository not available');
                }
                
                const localData = await syncRepository.getDashboardData();
                const responseTime = Date.now() - startTime;
                
                // Check if we have actual data (not empty)
                const hasData = localData.tasks && localData.tasks.length > 0;
                
                if (hasData) {
                    console.log(`📊 Local database data served in ${responseTime}ms (${localData.tasks.length} tasks)`);
                    
                    return res.json({
                        success: true,
                        data: localData,
                        performance: {
                            response_time_ms: responseTime,
                            source: 'local_database',
                            cache_hit: false,
                            cache_status: 'unavailable',
                            data_freshness: localData.performance?.data_freshness || null
                        },
                        timestamp: new Date().toISOString()
                    });
                } else {
                    console.log('⚠️ Local database has no data, falling back to ClickUp API...');
                }
            } catch (localError) {
                console.log('⚠️ Local database error, falling back to ClickUp API:', localError.message);
            }
        }
        
        // Fallback to ClickUp API if cache and local database fail or have no data
        console.log('🔄 Fetching data from ClickUp API as fallback...');
        
        // Get ClickUp token for API access
        const clickupToken = await tokenRepository.findMasterToken();
        
        if (!clickupToken || !clickupToken.accessToken) {
            return res.status(503).json({
                success: false,
                error: 'No valid ClickUp token and local data sources unavailable',
                code: 'TOKEN_MISSING_NO_LOCAL_DATA',
                message: 'ClickUp token not found and local data sources have no data'
            });
        }
        
        // Get data from ClickUp API as fallback
        const apiData = await clickupService.getComprehensiveData(clickupToken.accessToken);
        
        const responseTime = Date.now() - startTime;
        
        console.log(`📊 ClickUp API fallback data served in ${responseTime}ms`);
        
        res.json({
            success: true,
            data: apiData,
            performance: {
                response_time_ms: responseTime,
                source: 'clickup_api_fallback',
                cache_hit: false,
                cache_status: cacheService?.isReady() ? 'available_but_empty' : 'unavailable',
                fallback_reason: 'local_data_sources_unavailable_or_empty'
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Failed to get dashboard data (all sources):', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve dashboard data from all sources',
            code: 'ALL_DATA_SOURCES_FAILED',
            message: error.message
        });
    }
});

/**
 * GET /api/v2/local/sync-status
 * Get synchronization status and metadata
 */
router.get('/sync-status', async (req, res) => {
    try {
        const systemService = req.app.get('systemService');
        const status = await systemService.getStatus();
        
        res.json({
            success: true,
            status,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Failed to get sync status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve sync status',
            message: error.message
        });
    }
});

/**
 * POST /api/v2/local/force-sync
 * Trigger immediate synchronization with cache invalidation
 */
router.post('/force-sync', async (req, res) => {
    try {
        const syncService = req.app.get('syncService');
        const cacheService = req.app.get('cacheService');
        const { type = 'incremental' } = req.body;
        
        console.log(`🔄 Force sync requested: ${type}`);
        
        let result;
        if (type === 'full') {
            result = await syncService.performFullSync();
        } else {
            result = await syncService.performIncrementalSync();
        }
        
        // Invalidate all caches after successful sync
        if (cacheService && cacheService.isReady()) {
            try {
                // Invalidate dashboard data cache
                await cacheService.invalidatePattern(`${CacheService.CACHE_KEYS.DASHBOARD_DATA}:*`);
                
                // Invalidate other related caches
                await cacheService.invalidatePattern(`${CacheService.CACHE_KEYS.USER_TASKS}:*`);
                await cacheService.invalidatePattern(`${CacheService.CACHE_KEYS.TEAMS}:*`);
                await cacheService.invalidatePattern(`${CacheService.CACHE_KEYS.SPACES}:*`);
                await cacheService.invalidatePattern(`${CacheService.CACHE_KEYS.MEMBERS}:*`);
                
                console.log('🗑️ Cache invalidated after successful sync');
                
                result.cache_invalidated = true;
            } catch (cacheError) {
                console.warn('⚠️ Cache invalidation failed:', cacheError.message);
                result.cache_invalidation_error = cacheError.message;
            }
        } else {
            result.cache_status = 'unavailable';
        }
        
        res.json({
            success: true,
            result,
            message: `${type} sync completed successfully`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Force sync failed:', error);
        res.status(500).json({
            success: false,
            error: 'Sync operation failed',
            message: error.message
        });
    }
});

/**
 * GET /api/v2/local/tasks
 * Get tasks with filtering options and cache support
 */
router.get('/tasks', async (req, res) => {
    try {
        const startTime = Date.now();
        const syncRepository = req.app.get('syncRepository');
        const cacheService = req.app.get('cacheService');
        
        const filters = {
            listId: req.query.list_id,
            status: req.query.status,
            assigneeId: req.query.assignee_id,
            isSubtask: req.query.is_subtask === 'true' ? true : 
                      req.query.is_subtask === 'false' ? false : undefined
        };
        
        // Generate cache key based on filters
        const filterKey = Object.entries(filters)
            .filter(([key, value]) => value !== undefined)
            .map(([key, value]) => `${key}:${value}`)
            .join('|') || 'all';
            
        const cacheKey = cacheService?.generateKey(
            CacheService.CACHE_KEYS.USER_TASKS,
            filterKey
        ) || `user_tasks:${filterKey}`;
        
        // Try cache first if available
        if (cacheService && cacheService.isReady()) {
            try {
                const result = await cacheService.getCachedOrFetch(
                    cacheKey,
                    async () => {
                        return await syncRepository.getTasks(filters);
                    },
                    CacheService.TTL.USER_DATA
                );
                
                const responseTime = Date.now() - startTime;
                
                console.log(`📋 ${result.data.length} tasks retrieved from ${result.source} in ${responseTime}ms`);
                
                return res.json({
                    success: true,
                    data: result.data,
                    count: result.data.length,
                    filters: filters,
                    performance: {
                        response_time_ms: responseTime,
                        source: result.source === 'redis_cache' ? 'redis_cache' : 'local_database',
                        cache_hit: result.cache_hit
                    },
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                console.warn('⚠️ Cache error, falling back to database:', error.message);
            }
        }
        
        // Fallback to direct database access
        const tasks = await syncRepository.getTasks(filters);
        const responseTime = Date.now() - startTime;
        
        console.log(`📋 ${tasks.length} tasks retrieved from database in ${responseTime}ms`);
        
        res.json({
            success: true,
            data: tasks,
            count: tasks.length,
            filters: filters,
            performance: {
                response_time_ms: responseTime,
                source: 'local_database',
                cache_hit: false,
                cache_status: cacheService?.isReady() ? 'error' : 'unavailable'
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Failed to get tasks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve tasks',
            message: error.message
        });
    }
});

/**
 * GET /api/v2/local/teams
 * Get teams from local database
 */
router.get('/teams', async (req, res) => {
    try {
        const startTime = Date.now();
        const syncRepository = req.app.get('syncRepository');
        
        const teams = await syncRepository.getTeams();
        const responseTime = Date.now() - startTime;
        
        console.log(`👥 ${teams.length} teams retrieved in ${responseTime}ms`);
        
        res.json({
            success: true,
            data: teams,
            count: teams.length,
            performance: {
                response_time_ms: responseTime,
                source: 'local_database'
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Failed to get teams:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve teams',
            message: error.message
        });
    }
});

/**
 * GET /api/v2/local/spaces
 * Get spaces from local database
 */
router.get('/spaces', async (req, res) => {
    try {
        const startTime = Date.now();
        const syncRepository = req.app.get('syncRepository');
        const { team_id } = req.query;
        
        const spaces = await syncRepository.getSpaces(team_id);
        const responseTime = Date.now() - startTime;
        
        console.log(`🏗️ ${spaces.length} spaces retrieved in ${responseTime}ms`);
        
        res.json({
            success: true,
            data: spaces,
            count: spaces.length,
            filters: { team_id },
            performance: {
                response_time_ms: responseTime,
                source: 'local_database'
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Failed to get spaces:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve spaces',
            message: error.message
        });
    }
});

/**
 * GET /api/v2/local/members
 * Get team members from local database
 */
router.get('/members', async (req, res) => {
    try {
        const syncRepository = req.app.get('syncRepository');
        const { team_id } = req.query;
        
        const members = await syncRepository.getMembers(team_id);
        
        res.json({
            success: true,
            data: members,
            count: members.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Failed to get members:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve members',
            message: error.message
        });
    }
});

/**
 * GET /api/v2/local/performance
 * Get performance comparison metrics
 */
router.get('/performance', async (req, res) => {
    try {
        const syncRepository = req.app.get('syncRepository');
        
        // Measure local database performance
        const startTime = Date.now();
        const data = await syncRepository.getDashboardData();
        const localResponseTime = Date.now() - startTime;
        
        // Get sync metadata for comparison
        const syncMeta = await syncRepository.getSyncMetadata();
        
        res.json({
            success: true,
            performance: {
                local_database: {
                    response_time_ms: localResponseTime,
                    tasks_count: data.tasks.length,
                    teams_count: data.teams.length,
                    members_count: data.spaces.length
                },
                estimated_clickup_api: {
                    response_time_ms: 3900, // Based on troubleshooting results
                    improvement_factor: Math.round(3900 / localResponseTime),
                    improvement_percentage: Math.round(((3900 - localResponseTime) / 3900) * 100)
                },
                sync_metadata: syncMeta,
                data_freshness: {
                    last_sync: syncMeta?.last_full_sync,
                    age_minutes: syncMeta?.last_full_sync 
                        ? Math.floor((Date.now() - new Date(syncMeta.last_full_sync).getTime()) / 60000)
                        : null
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Failed to get performance data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve performance data',
            message: error.message
        });
    }
});

/**
 * GET /api/v2/local/health
 * Health check for local sync system with cache status
 */
router.get('/health', async (req, res) => {
    try {
        const syncRepository = req.app.get('syncRepository');
        const cacheService = req.app.get('cacheService');
        
        // Check database connectivity
        const syncMeta = await syncRepository.getSyncMetadata();
        
        // Check table counts
        const tablesQuery = await syncRepository.db.query(`
            SELECT 
                (SELECT COUNT(*) FROM clickup_teams) as teams,
                (SELECT COUNT(*) FROM clickup_spaces) as spaces,
                (SELECT COUNT(*) FROM clickup_tasks) as tasks,
                (SELECT COUNT(*) FROM clickup_members) as members
        `);
        
        const counts = tablesQuery.rows[0];
        
        // Check cache status
        let cacheStatus = {
            status: 'unavailable',
            connected: false
        };
        
        if (cacheService) {
            cacheStatus = {
                status: cacheService.isReady() ? 'healthy' : 'disconnected',
                connected: cacheService.isReady()
            };
        }
        
        res.json({
            success: true,
            status: 'healthy',
            database: {
                connected: true,
                tables: counts
            },
            cache: cacheStatus,
            sync: {
                last_sync: syncMeta?.last_full_sync,
                status: syncMeta?.sync_status,
                data_available: parseInt(counts.tasks) > 0
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Local sync health check failed:', error);
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/v2/local/cache/invalidate
 * Invalidate specific cache patterns
 */
router.post('/cache/invalidate', async (req, res) => {
    try {
        const cacheService = req.app.get('cacheService');
        const { pattern = '*', type = 'pattern' } = req.body;
        
        if (!cacheService || !cacheService.isReady()) {
            return res.status(503).json({
                success: false,
                error: 'Cache service not available',
                message: 'Redis cache is not connected'
            });
        }
        
        let result;
        if (type === 'all') {
            result = await cacheService.flushAll();
            console.log('🗑️ All cache entries flushed');
        } else {
            result = await cacheService.invalidatePattern(pattern);
            console.log(`🗑️ Cache pattern "${pattern}" invalidated`);
        }
        
        res.json({
            success: true,
            message: type === 'all' ? 'All cache cleared' : `Pattern "${pattern}" invalidated`,
            pattern: type === 'all' ? '*' : pattern,
            result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Cache invalidation failed:', error);
        res.status(500).json({
            success: false,
            error: 'Cache invalidation failed',
            message: error.message
        });
    }
});

/**
 * GET /api/v2/local/cache/status
 * Get cache service status and statistics
 */
router.get('/cache/status', async (req, res) => {
    try {
        const cacheService = req.app.get('cacheService');
        
        if (!cacheService) {
            return res.json({
                success: true,
                status: 'not_configured',
                message: 'Cache service not configured',
                connected: false,
                timestamp: new Date().toISOString()
            });
        }
        
        const isReady = cacheService.isReady();
        
        res.json({
            success: true,
            status: isReady ? 'healthy' : 'disconnected',
            connected: isReady,
            configuration: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                default_ttl: cacheService.defaultTTL
            },
            cache_keys: CacheService.CACHE_KEYS,
            ttl_settings: CacheService.TTL,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Cache status check failed:', error);
        res.status(500).json({
            success: false,
            error: 'Cache status check failed',
            message: error.message
        });
    }
});

/**
 * POST /api/v2/local/cache/warmup
 * Pre-populate cache with commonly used data
 */
router.post('/cache/warmup', async (req, res) => {
    try {
        const cacheService = req.app.get('cacheService');
        const syncRepository = req.app.get('syncRepository');
        
        if (!cacheService || !cacheService.isReady()) {
            return res.status(503).json({
                success: false,
                error: 'Cache service not available',
                message: 'Redis cache is not connected'
            });
        }
        
        if (!syncRepository) {
            return res.status(503).json({
                success: false,
                error: 'Sync repository not available',
                message: 'Local database repository not configured'
            });
        }
        
        const startTime = Date.now();
        const warmedUp = [];
        
        try {
            // Warm up dashboard data
            const dashboardKey = cacheService.generateKey(CacheService.CACHE_KEYS.DASHBOARD_DATA, 'all_teams');
            const dashboardData = await syncRepository.getDashboardData();
            await cacheService.set(dashboardKey, dashboardData, CacheService.TTL.DASHBOARD);
            warmedUp.push('dashboard_data');
            
            // Warm up teams data
            const teamsKey = cacheService.generateKey(CacheService.CACHE_KEYS.TEAMS, 'all');
            const teamsData = await syncRepository.getTeams();
            await cacheService.set(teamsKey, teamsData, CacheService.TTL.TEAM_DATA);
            warmedUp.push('teams_data');
            
            // Warm up basic tasks
            const tasksKey = cacheService.generateKey(CacheService.CACHE_KEYS.USER_TASKS, 'all');
            const tasksData = await syncRepository.getTasks({});
            await cacheService.set(tasksKey, tasksData, CacheService.TTL.USER_DATA);
            warmedUp.push('tasks_data');
            
        } catch (warmupError) {
            console.warn('⚠️ Partial cache warmup failed:', warmupError.message);
        }
        
        const responseTime = Date.now() - startTime;
        
        console.log(`🔥 Cache warmed up in ${responseTime}ms: ${warmedUp.join(', ')}`);
        
        res.json({
            success: true,
            message: 'Cache warmup completed',
            warmed_up: warmedUp,
            performance: {
                warmup_time_ms: responseTime
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Cache warmup failed:', error);
        res.status(500).json({
            success: false,
            error: 'Cache warmup failed',
            message: error.message
        });
    }
});

module.exports = router;