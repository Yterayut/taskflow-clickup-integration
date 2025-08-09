/**
 * Local Data Repository for TaskFlow Pro
 * Phase 2: Local Database Enhancement
 * 
 * Handles local-first data access with fallback mechanisms
 */

class LocalDataRepository {
    constructor(options = {}) {
        this.database = options.database || null; // Mock database connection
        this.cacheService = options.cacheService || null;
        this.clickupService = options.clickupService || null;
        
        // Performance tracking
        this.queryStats = {
            totalQueries: 0,
            cacheHits: 0,
            dbHits: 0,
            fallbackHits: 0,
            avgResponseTime: 0
        };
        
        console.log('🗄️ Local Data Repository initialized');
    }

    /**
     * Get dashboard data with multi-level fallback
     */
    async getDashboardData(userRole, options = {}) {
        const startTime = Date.now();
        this.queryStats.totalQueries++;
        
        try {
            // Level 1: Try cache first
            if (this.cacheService) {
                const cachedData = await this.cacheService.getDashboardData(userRole);
                if (cachedData) {
                    this.queryStats.cacheHits++;
                    this.updateResponseTime(startTime);
                    
                    return {
                        ...cachedData,
                        meta: {
                            source: 'cache',
                            responseTime: Date.now() - startTime,
                            freshness: cachedData.meta?.freshness || 'unknown'
                        }
                    };
                }
            }
            
            // Level 2: Try local database
            const dbData = await this.getFromLocalDatabase('dashboard', userRole);
            if (dbData && !this.isStale(dbData, 'high')) {
                this.queryStats.dbHits++;
                this.updateResponseTime(startTime);
                
                // Cache the result for faster future access
                if (this.cacheService) {
                    await this.cacheService.setDashboardData(userRole, dbData);
                }
                
                return {
                    ...dbData,
                    meta: {
                        source: 'local_database',
                        responseTime: Date.now() - startTime,
                        freshness: this.calculateFreshness(dbData.timestamp)
                    }
                };
            }
            
            // Level 3: Fallback to ClickUp API (if available)
            if (this.clickupService && !options.localOnly) {
                console.log('⚠️ Cache and local DB miss, falling back to ClickUp API...');
                const apiData = await this.clickupService.getDashboardData();
                
                if (apiData) {
                    this.queryStats.fallbackHits++;
                    this.updateResponseTime(startTime);
                    
                    // Store in cache and database for future use
                    const enhancedData = {
                        ...apiData,
                        timestamp: new Date().toISOString(),
                        source: 'clickup_api'
                    };
                    
                    if (this.cacheService) {
                        await this.cacheService.setDashboardData(userRole, enhancedData);
                    }
                    
                    await this.storeInLocalDatabase('dashboard', userRole, enhancedData);
                    
                    return {
                        ...enhancedData,
                        meta: {
                            source: 'fallback_api',
                            responseTime: Date.now() - startTime,
                            freshness: 'fresh'
                        }
                    };
                }
            }
            
            // No data available
            throw new Error('No data available from any source');
            
        } catch (error) {
            console.error('❌ Error getting dashboard data:', error);
            this.updateResponseTime(startTime);
            
            return {
                success: false,
                error: error.message,
                meta: {
                    source: 'error',
                    responseTime: Date.now() - startTime
                }
            };
        }
    }

    /**
     * Get task data with intelligent filtering
     */
    async getTaskData(filters = {}, userRole = 'employee') {
        const startTime = Date.now();
        
        try {
            // Generate cache key based on filters and role
            const cacheKey = this.generateCacheKey('tasks', filters, userRole);
            
            // Try cache first
            if (this.cacheService) {
                const cachedTasks = await this.cacheService.getTaskData(filters);
                if (cachedTasks) {
                    return this.formatTaskResponse(cachedTasks, 'cache', startTime);
                }
            }
            
            // Try local database with role-based filtering
            const dbTasks = await this.getTasksFromDatabase(filters, userRole);
            if (dbTasks && dbTasks.length > 0) {
                // Cache the results
                if (this.cacheService) {
                    await this.cacheService.setTaskData(filters, dbTasks);
                }
                
                return this.formatTaskResponse(dbTasks, 'local_database', startTime);
            }
            
            // Fallback to API if no local data
            if (this.clickupService) {
                const apiTasks = await this.clickupService.getTaskData(filters);
                if (apiTasks) {
                    // Store in local database
                    await this.storeTasksInDatabase(apiTasks);
                    
                    return this.formatTaskResponse(apiTasks, 'fallback_api', startTime);
                }
            }
            
            return this.formatTaskResponse([], 'no_data', startTime);
            
        } catch (error) {
            console.error('❌ Error getting task data:', error);
            return this.formatTaskResponse([], 'error', startTime, error.message);
        }
    }

    /**
     * Get team/member data
     */
    async getTeamData(userRole = 'employee') {
        const startTime = Date.now();
        
        try {
            // Cache lookup
            const cacheKey = `team_data_${userRole}`;
            if (this.cacheService) {
                const cachedTeam = await this.cacheService.get(cacheKey, { 
                    priority: 'medium',
                    userRole 
                });
                
                if (cachedTeam) {
                    return {
                        success: true,
                        data: cachedTeam,
                        meta: {
                            source: 'cache',
                            responseTime: Date.now() - startTime
                        }
                    };
                }
            }
            
            // Database lookup
            const dbTeamData = await this.getFromLocalDatabase('team', userRole);
            if (dbTeamData) {
                // Cache the result
                if (this.cacheService) {
                    await this.cacheService.set(cacheKey, dbTeamData, {
                        ttl: 30, // 30 minutes for team data
                        priority: 'medium',
                        userRole,
                        dataType: 'team'
                    });
                }
                
                return {
                    success: true,
                    data: dbTeamData,
                    meta: {
                        source: 'local_database',
                        responseTime: Date.now() - startTime
                    }
                };
            }
            
            // Fallback to API
            if (this.clickupService) {
                const apiTeamData = await this.clickupService.getTeamData();
                if (apiTeamData) {
                    // Store and cache
                    await this.storeInLocalDatabase('team', userRole, apiTeamData);
                    if (this.cacheService) {
                        await this.cacheService.set(cacheKey, apiTeamData, {
                            ttl: 30,
                            priority: 'medium',
                            userRole,
                            dataType: 'team'
                        });
                    }
                    
                    return {
                        success: true,
                        data: apiTeamData,
                        meta: {
                            source: 'fallback_api',
                            responseTime: Date.now() - startTime
                        }
                    };
                }
            }
            
            throw new Error('No team data available');
            
        } catch (error) {
            console.error('❌ Error getting team data:', error);
            return {
                success: false,
                error: error.message,
                meta: {
                    source: 'error',
                    responseTime: Date.now() - startTime
                }
            };
        }
    }

    /**
     * Database operations (Mock implementations)
     */
    async getFromLocalDatabase(dataType, userRole) {
        // Mock database query
        console.log(`🔍 Querying local database: ${dataType} for role ${userRole}`);
        
        // Simulate database response based on data type
        switch (dataType) {
            case 'dashboard':
                return {
                    tasks: [
                        {
                            id: 'local_task_1',
                            name: 'Local Cached Task',
                            status: { status: 'in progress' },
                            assignees: [{ name: 'Local User' }],
                            timestamp: new Date().toISOString()
                        }
                    ],
                    spaces: [],
                    members: [],
                    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString() // 3 minutes old
                };
                
            case 'team':
                return {
                    members: [
                        { id: 'member_1', name: 'Team Member 1', role: 'developer' },
                        { id: 'member_2', name: 'Team Member 2', role: 'designer' }
                    ],
                    spaces: [
                        { id: 'space_1', name: 'Development', task_count: 5 }
                    ],
                    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes old
                };
                
            default:
                return null;
        }
    }

    async getTasksFromDatabase(filters, userRole) {
        console.log(`🔍 Querying tasks from database with filters:`, filters);
        
        // Mock filtered task query based on role
        const baseTasks = [
            {
                id: 'db_task_1',
                name: 'Database Task 1',
                status: { status: 'to do' },
                assignees: [{ name: userRole === 'manager' ? 'All Team' : 'You' }],
                list_id: 'list_1',
                due_date: new Date().toISOString(),
                timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
            },
            {
                id: 'db_task_2', 
                name: 'Database Task 2',
                status: { status: 'in progress' },
                assignees: [{ name: 'Team Member' }],
                list_id: 'list_2',
                timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString()
            }
        ];
        
        // Apply role-based filtering
        if (userRole === 'employee') {
            return baseTasks.filter(task => 
                task.assignees.some(a => a.name.includes('You'))
            );
        }
        
        return baseTasks;
    }

    async storeInLocalDatabase(dataType, userRole, data) {
        console.log(`💾 Storing ${dataType} data in local database for role: ${userRole}`);
        
        // Mock database storage
        // In production, this would use actual database queries
        const record = {
            id: this.generateId(),
            data_type: dataType,
            user_role: userRole,
            data: data,
            created_at: new Date(),
            expires_at: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
        };
        
        return record;
    }

    async storeTasksInDatabase(tasks) {
        console.log(`💾 Storing ${tasks.length} tasks in database`);
        
        // Mock task storage
        for (const task of tasks) {
            // Store individual task with enhanced metadata
            const taskRecord = {
                id: task.id,
                clickup_id: task.id,
                name: task.name,
                status: task.status,
                assignees: task.assignees,
                list_id: task.list?.id,
                space_id: task.space?.id,
                sync_status: 'synced',
                last_synced: new Date(),
                created_at: new Date()
            };
        }
    }

    /**
     * Utility methods
     */
    isStale(data, priority = 'medium') {
        if (!data.timestamp) return true;
        
        const thresholds = {
            high: 5,    // 5 minutes
            medium: 15, // 15 minutes  
            low: 60     // 60 minutes
        };
        
        const ageMinutes = (Date.now() - new Date(data.timestamp).getTime()) / (1000 * 60);
        return ageMinutes > (thresholds[priority] || thresholds.medium);
    }

    calculateFreshness(timestamp) {
        if (!timestamp) return 'unknown';
        
        const ageMinutes = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60);
        
        if (ageMinutes < 2) return 'fresh';
        if (ageMinutes < 5) return 'good';
        if (ageMinutes < 15) return 'stale';
        return 'very_stale';
    }

    generateCacheKey(type, filters, userRole) {
        const filterHash = Buffer.from(JSON.stringify(filters)).toString('base64').substring(0, 8);
        return `${type}_${userRole}_${filterHash}`;
    }

    generateId() {
        return 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    formatTaskResponse(tasks, source, startTime, error = null) {
        return {
            success: !error,
            data: tasks,
            count: tasks.length,
            error: error,
            meta: {
                source: source,
                responseTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            }
        };
    }

    updateResponseTime(startTime) {
        const responseTime = Date.now() - startTime;
        this.queryStats.avgResponseTime = 
            (this.queryStats.avgResponseTime + responseTime) / 2;
    }

    /**
     * Repository health and statistics
     */
    getHealthStatus() {
        const totalQueries = this.queryStats.totalQueries;
        const cacheHitRate = totalQueries > 0 ? 
            (this.queryStats.cacheHits / totalQueries * 100).toFixed(2) : 0;
        const dbHitRate = totalQueries > 0 ? 
            (this.queryStats.dbHits / totalQueries * 100).toFixed(2) : 0;
        const fallbackRate = totalQueries > 0 ? 
            (this.queryStats.fallbackHits / totalQueries * 100).toFixed(2) : 0;
        
        return {
            status: 'healthy',
            statistics: {
                total_queries: totalQueries,
                cache_hit_rate: `${cacheHitRate}%`,
                database_hit_rate: `${dbHitRate}%`,
                fallback_rate: `${fallbackRate}%`,
                avg_response_time_ms: Math.round(this.queryStats.avgResponseTime)
            },
            data_sources: {
                cache_service: this.cacheService ? 'available' : 'disabled',
                local_database: this.database ? 'available' : 'mock',
                clickup_service: this.clickupService ? 'available' : 'disabled'
            }
        };
    }

    getQueryStats() {
        return {
            ...this.queryStats,
            cacheHitRate: this.queryStats.totalQueries > 0 ? 
                (this.queryStats.cacheHits / this.queryStats.totalQueries * 100).toFixed(2) + '%' : '0%'
        };
    }

    /**
     * Data refresh and invalidation
     */
    async refreshData(dataType, userRole, force = false) {
        console.log(`🔄 Refreshing ${dataType} data for role: ${userRole}`);
        
        // Clear cache first
        if (this.cacheService) {
            await this.cacheService.clearUserCache(userRole);
        }
        
        // Force fetch from API
        if (this.clickupService) {
            let freshData;
            
            switch (dataType) {
                case 'dashboard':
                    freshData = await this.clickupService.getDashboardData();
                    if (freshData) {
                        await this.storeInLocalDatabase('dashboard', userRole, freshData);
                        if (this.cacheService) {
                            await this.cacheService.setDashboardData(userRole, freshData);
                        }
                    }
                    break;
                    
                case 'tasks':
                    freshData = await this.clickupService.getTaskData({});
                    if (freshData) {
                        await this.storeTasksInDatabase(freshData);
                        if (this.cacheService) {
                            await this.cacheService.setTaskData({}, freshData);
                        }
                    }
                    break;
            }
            
            return freshData;
        }
        
        return null;
    }

    async invalidateCache(pattern = null) {
        if (this.cacheService) {
            if (pattern) {
                // Invalidate specific cache entries matching pattern
                console.log(`🗑️ Invalidating cache entries matching: ${pattern}`);
            } else {
                // Clear all cache
                await this.cacheService.clearAll();
            }
        }
    }
}

module.exports = { LocalDataRepository };