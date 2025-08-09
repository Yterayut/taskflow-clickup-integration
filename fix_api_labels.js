/**
 * Fix API Response Labels - Patch for Master Auth Service
 * Adds correct /api/v2/local/dashboard-data endpoint with accurate performance labels
 */

// This code should be added to master_auth_service.js

// Add this route BEFORE the "Start server" section
const fs = require('fs');

// Performance tracking for accurate response labels
let requestCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper function to clean expired cache entries
function cleanCache() {
    const now = Date.now();
    for (const [key, value] of requestCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            requestCache.delete(key);
        }
    }
}

// V2 API endpoint for dashboard data with accurate labels
app.get('/api/v2/local/dashboard-data', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const userId = req.session.userId;
        
        if (!userId || !userTokens.has(userId)) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated with ClickUp',
                message: 'Please connect your ClickUp account first',
                auth_url: '/auth/clickup'
            });
        }

        // Clean expired cache
        cleanCache();
        
        // Check cache first
        const cacheKey = `dashboard_${userId}`;
        const cached = requestCache.get(cacheKey);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp) < CACHE_TTL) {
            const responseTime = Date.now() - startTime;
            console.log(`📊 Dashboard data served from memory cache in ${responseTime}ms`);
            
            return res.json({
                success: true,
                data: cached.data,
                performance: {
                    response_time_ms: responseTime,
                    source: 'memory_cache',
                    cache_hit: true,
                    data_freshness: Math.floor((now - cached.timestamp) / 1000) + ' seconds old'
                },
                timestamp: new Date().toISOString()
            });
        }

        console.log(`[${new Date().toISOString()}] Fetching fresh ClickUp data for dashboard`);

        // Get fresh data from ClickUp API
        const teamsData = await callClickUpAPI('/team', userId);
        
        if (!teamsData.teams || teamsData.teams.length === 0) {
            const responseTime = Date.now() - startTime;
            const emptyData = {
                source: 'ClickUp API - No Teams',
                user: userTokens.get(userId).user_data,
                teams: [],
                spaces: [],
                folders: [],
                lists: [],
                tasks: Array.from(taskDatabase.values()),
                workload: {
                    totalTasks: taskDatabase.size,
                    completedTasks: 0,
                    inProgressTasks: 0,
                    overdueTasks: 0
                },
                message: 'No teams found in your ClickUp workspace',
                fetched_at: new Date().toISOString()
            };
            
            return res.json({
                success: true,
                data: emptyData,
                performance: {
                    response_time_ms: responseTime,
                    source: 'clickup_api',
                    cache_hit: false,
                    data_source: 'empty_workspace'
                },
                timestamp: new Date().toISOString()
            });
        }

        // Process comprehensive data (same as existing logic)
        let allSpaces = [];
        let allFolders = [];
        let allLists = [];
        let allTasks = Array.from(taskDatabase.values());

        for (const team of teamsData.teams) {
            try {
                console.log(`Processing team: ${team.name} (${team.id})`);
                
                const spacesData = await callClickUpAPI(`/team/${team.id}/space`, userId);
                if (spacesData.spaces) {
                    allSpaces = allSpaces.concat(spacesData.spaces);
                    
                    for (const space of spacesData.spaces) {
                        try {
                            const foldersData = await callClickUpAPI(`/space/${space.id}/folder`, userId);
                            if (foldersData.folders) {
                                allFolders = allFolders.concat(foldersData.folders);
                                
                                for (const folder of foldersData.folders) {
                                    try {
                                        const listsData = await callClickUpAPI(`/folder/${folder.id}/list`, userId);
                                        if (listsData.lists) {
                                            allLists = allLists.concat(listsData.lists);
                                            
                                            for (const list of listsData.lists) {
                                                try {
                                                    const tasksData = await callClickUpAPI(`/list/${list.id}/task`, userId);
                                                    if (tasksData.tasks) {
                                                        const enhancedTasks = tasksData.tasks.map(task => ({
                                                            ...task,
                                                            list_name: list.name,
                                                            list_id: list.id,
                                                            team_name: team.name,
                                                            space_name: space.name,
                                                            is_subtask: !!task.parent
                                                        }));
                                                        allTasks = allTasks.concat(enhancedTasks);
                                                    }
                                                } catch (taskError) {
                                                    console.warn(`Failed to fetch tasks for list ${list.id}:`, taskError.message);
                                                }
                                            }
                                        }
                                    } catch (listError) {
                                        console.warn(`Failed to fetch lists for folder ${folder.id}:`, listError.message);
                                    }
                                }
                            }
                            
                            // Also get folderless lists
                            try {
                                const folderlessListsData = await callClickUpAPI(`/space/${space.id}/list`, userId);
                                if (folderlessListsData.lists) {
                                    allLists = allLists.concat(folderlessListsData.lists);
                                    
                                    for (const list of folderlessListsData.lists) {
                                        try {
                                            const tasksData = await callClickUpAPI(`/list/${list.id}/task`, userId);
                                            if (tasksData.tasks) {
                                                const enhancedTasks = tasksData.tasks.map(task => ({
                                                    ...task,
                                                    list_name: list.name,
                                                    list_id: list.id,
                                                    team_name: team.name,
                                                    space_name: space.name,
                                                    is_subtask: !!task.parent
                                                }));
                                                allTasks = allTasks.concat(enhancedTasks);
                                            }
                                        } catch (taskError) {
                                            console.warn(`Failed to fetch tasks for folderless list ${list.id}:`, taskError.message);
                                        }
                                    }
                                }
                            } catch (folderlessError) {
                                console.warn(`Failed to fetch folderless lists for space ${space.id}:`, folderlessError.message);
                            }
                        } catch (folderError) {
                            console.warn(`Failed to fetch folders for space ${space.id}:`, folderError.message);
                        }
                    }
                }
            } catch (teamError) {
                console.warn(`Failed to process team ${team.id}:`, teamError.message);
            }
        }

        // Calculate workload statistics
        const workloadStats = {
            totalTasks: allTasks.length,
            completedTasks: allTasks.filter(task => task.status?.type === 'closed').length,
            inProgressTasks: allTasks.filter(task => task.status?.type === 'custom' || task.status?.status === 'in progress').length,
            overdueTasks: allTasks.filter(task => task.due_date && new Date(parseInt(task.due_date)) < new Date()).length,
            pendingTasks: allTasks.filter(task => task.status?.type === 'open').length,
            localTasks: taskDatabase.size,
            tasksByStatus: {},
            teamWorkload: {}
        };

        // Build comprehensive response
        const comprehensiveData = {
            source: 'ClickUp API - Enhanced',
            user: userTokens.get(userId).user_data,
            teams: teamsData.teams,
            spaces: allSpaces,
            folders: allFolders,
            lists: allLists,
            tasks: allTasks,
            workload: workloadStats,
            performance: {
                teams_count: teamsData.teams.length,
                spaces_count: allSpaces.length,
                folders_count: allFolders.length,
                lists_count: allLists.length,
                tasks_count: allTasks.length,
                processing_time: Date.now() - startTime,
                last_updated: new Date().toISOString()
            },
            fetched_at: new Date().toISOString()
        };

        // Cache the result
        requestCache.set(cacheKey, {
            data: comprehensiveData,
            timestamp: now
        });

        const responseTime = Date.now() - startTime;
        console.log(`📊 Fresh ClickUp dashboard data served in ${responseTime}ms (${allTasks.length} tasks)`);

        res.json({
            success: true,
            data: comprehensiveData,
            performance: {
                response_time_ms: responseTime,
                source: 'clickup_api',
                cache_hit: false,
                api_calls_made: 'multiple',
                teams_processed: teamsData.teams.length,
                tasks_fetched: allTasks.length
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error('❌ Dashboard data fetch failed:', error);
        
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard data',
            message: error.message,
            performance: {
                response_time_ms: responseTime,
                source: 'error',
                cache_hit: false
            },
            timestamp: new Date().toISOString()
        });
    }
});

// Health endpoint with cache status
app.get('/api/v2/local/health', (req, res) => {
    const cacheSize = requestCache.size;
    const cacheKeys = Array.from(requestCache.keys());
    
    res.json({
        success: true,
        status: 'healthy',
        database: {
            connected: true,
            tables: {
                tasks: taskDatabase.size,
                employees: employeeDatabase.size,
                users: userTokens.size
            }
        },
        cache: {
            status: 'memory_cache_active',
            connected: true,
            entries: cacheSize,
            keys: cacheKeys.slice(0, 5), // Show first 5 keys
            ttl_minutes: Math.floor(CACHE_TTL / 60000)
        },
        sync: {
            last_sync: 'real_time',
            status: 'clickup_api_direct',
            data_available: taskDatabase.size > 0 || userTokens.size > 0
        },
        timestamp: new Date().toISOString()
    });
});

// Cache management endpoints
app.get('/api/v2/local/cache/status', (req, res) => {
    cleanCache();
    
    res.json({
        success: true,
        status: 'memory_cache',
        connected: true,
        configuration: {
            type: 'in_memory',
            ttl_ms: CACHE_TTL,
            max_entries: 'unlimited'
        },
        statistics: {
            current_entries: requestCache.size,
            cache_keys: Array.from(requestCache.keys()),
            memory_usage: 'native_js_map'
        },
        timestamp: new Date().toISOString()
    });
});

app.post('/api/v2/local/cache/invalidate', (req, res) => {
    const { pattern = '*', type = 'pattern' } = req.body;
    
    let cleared = 0;
    
    if (type === 'all') {
        cleared = requestCache.size;
        requestCache.clear();
        console.log('🗑️ All cache entries cleared');
    } else {
        // Pattern-based clearing
        const keys = Array.from(requestCache.keys());
        const regex = new RegExp(pattern.replace('*', '.*'));
        
        for (const key of keys) {
            if (regex.test(key)) {
                requestCache.delete(key);
                cleared++;
            }
        }
        console.log(`🗑️ ${cleared} cache entries cleared with pattern: ${pattern}`);
    }
    
    res.json({
        success: true,
        message: `${cleared} cache entries cleared`,
        pattern: type === 'all' ? '*' : pattern,
        cleared_count: cleared,
        timestamp: new Date().toISOString()
    });
});

console.log('🔧 API Response Labels Fix Applied');
console.log('📍 Added endpoints:');
console.log('   • /api/v2/local/dashboard-data - Dashboard with accurate performance labels');
console.log('   • /api/v2/local/health - Health check with cache status');
console.log('   • /api/v2/local/cache/status - Cache statistics');
console.log('   • /api/v2/local/cache/invalidate - Cache management');
console.log('🎯 Memory cache TTL: 5 minutes');
console.log('✅ Performance labels now accurate: source, cache_hit, response_time_ms');

module.exports = { requestCache, cleanCache, CACHE_TTL };