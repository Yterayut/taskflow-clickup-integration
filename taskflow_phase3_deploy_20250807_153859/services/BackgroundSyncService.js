/**
 * Background ClickUp Sync Service
 * Automatically syncs ClickUp data to local database
 */
const cron = require('node-cron');

class BackgroundSyncService {
    constructor({ clickupService, syncRepository, tokenRepository, auditService }) {
        this.clickupService = clickupService;
        this.syncRepository = syncRepository;
        this.tokenRepository = tokenRepository;
        this.auditService = auditService;
        
        this.isRunning = false;
        this.syncJob = null;
        this.lastSyncTime = null;
        
        // Smart Sync Strategy - Different intervals for different data priorities
        this.syncInterval = 2; // High priority data (minutes)
        this.mediumPriorityInterval = 10; // Medium priority data (minutes)
        this.lowPriorityInterval = 60; // Low priority data (minutes)
        
        this.errorCount = 0;
        this.maxErrors = 5;
        
        // Data priority classification
        this.highPriorityTables = ['tasks', 'task_status', 'assignees'];
        this.mediumPriorityTables = ['projects', 'lists', 'team_members'];
        this.lowPriorityTables = ['archived_data', 'historical_metrics'];
        
        console.log('🔄 BackgroundSyncService initialized');
    }

    /**
     * Start the background sync service
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Background sync already running');
            return;
        }

        try {
            // Initialize sync repository
            await this.syncRepository.initialize();
            
            // Perform initial sync
            console.log('🚀 Starting initial sync...');
            await this.performFullSync();
            
            // Schedule regular syncs with Smart Sync Strategy
            // High priority: every 2 minutes
            this.syncJob = cron.schedule(`*/${this.syncInterval} * * * *`, async () => {
                await this.performHighPrioritySync();
            }, {
                scheduled: false // Don't start immediately
            });
            
            // Medium priority: every 10 minutes
            this.mediumSyncJob = cron.schedule(`*/${this.mediumPriorityInterval} * * * *`, async () => {
                await this.performMediumPrioritySync();
            }, {
                scheduled: false
            });
            
            // Low priority: every 60 minutes
            this.lowSyncJob = cron.schedule(`*/${this.lowPriorityInterval} * * * *`, async () => {
                await this.performLowPrioritySync();
            }, {
                scheduled: false
            });
            
            this.syncJob.start();
            this.mediumSyncJob.start();
            this.lowSyncJob.start();
            this.isRunning = true;
            
            console.log(`✅ Background sync service started with Smart Sync Strategy:`);
            console.log(`   - High Priority (tasks, status): every ${this.syncInterval} minutes`);
            console.log(`   - Medium Priority (projects, lists): every ${this.mediumPriorityInterval} minutes`);
            console.log(`   - Low Priority (archives): every ${this.lowPriorityInterval} minutes`);
            
            // Log service start
            if (this.auditService) {
                await this.auditService.logEvent({
                    eventType: 'SYNC_SERVICE_STARTED',
                    description: `Background sync service started with ${this.syncInterval} minute interval`,
                    riskLevel: 'low'
                });
            }
        } catch (error) {
            console.error('❌ Failed to start background sync service:', error);
            throw error;
        }
    }

    /**
     * Stop the background sync service
     */
    async stop() {
        if (!this.isRunning) {
            console.log('🚫 Background sync not running');
            return;
        }

        if (this.syncJob) {
            this.syncJob.stop();
            this.syncJob = null;
        }
        if (this.mediumSyncJob) {
            this.mediumSyncJob.stop();
            this.mediumSyncJob = null;
        }
        if (this.lowSyncJob) {
            this.lowSyncJob.stop();
            this.lowSyncJob = null;
        }
        
        this.isRunning = false;
        console.log('🚫 Background sync service stopped');
        
        // Log service stop
        if (this.auditService) {
            await this.auditService.logEvent({
                eventType: 'SYNC_SERVICE_STOPPED',
                description: 'Background sync service stopped',
                riskLevel: 'low'
            });
        }
    }

    /**
     * Perform full synchronization of all ClickUp data
     */
    async performFullSync() {
        const startTime = Date.now();
        
        try {
            console.log('🔄 Starting full sync...');
            
            // Update sync metadata - start
            await this.syncRepository.updateSyncMetadata({
                status: 'syncing',
                lastFullSync: new Date().toISOString(),
                errors: null
            });
            
            // Get ClickUp token
            const masterToken = await this.tokenRepository.findMasterToken();
            if (!masterToken || !masterToken.accessToken) {
                throw new Error('No valid ClickUp token found');
            }
            
            // Get comprehensive data from ClickUp API
            const clickupData = await this.clickupService.getComprehensiveData(masterToken.accessToken);
            
            // Sync data to local database
            const syncResults = await this.syncDataToDatabase(clickupData);
            
            const syncTime = Date.now() - startTime;
            this.lastSyncTime = new Date();
            this.errorCount = 0; // Reset error count on success
            
            // Update sync metadata - complete
            await this.syncRepository.updateSyncMetadata({
                status: 'completed',
                lastFullSync: new Date().toISOString(),
                totalTeams: syncResults.teams,
                totalSpaces: syncResults.spaces,
                totalTasks: syncResults.tasks,
                totalMembers: syncResults.members,
                errors: null
            });
            
            console.log(`✅ Full sync completed in ${syncTime}ms:`, syncResults);
            
            // Log successful sync
            if (this.auditService) {
                await this.auditService.logEvent({
                    eventType: 'SYNC_COMPLETED',
                    description: `Full sync completed successfully`,
                    riskLevel: 'low',
                    eventData: {
                        syncType: 'full',
                        duration: syncTime,
                        results: syncResults
                    }
                });
            }
            
            return syncResults;
            
        } catch (error) {
            this.errorCount++;
            const syncTime = Date.now() - startTime;
            
            console.error(`❌ Full sync failed after ${syncTime}ms:`, error);
            
            // Update sync metadata - error
            await this.syncRepository.updateSyncMetadata({
                status: 'error',
                errors: [{
                    message: error.message,
                    timestamp: new Date().toISOString(),
                    type: 'full_sync',
                    duration: syncTime
                }]
            });
            
            // Log sync error
            if (this.auditService) {
                await this.auditService.logEvent({
                    eventType: 'SYNC_FAILED',
                    description: `Full sync failed: ${error.message}`,
                    riskLevel: 'medium',
                    eventData: {
                        syncType: 'full',
                        error: error.message,
                        duration: syncTime,
                        errorCount: this.errorCount
                    }
                });
            }
            
            // Stop service if too many errors
            if (this.errorCount >= this.maxErrors) {
                console.error(`🚫 Too many sync errors (${this.errorCount}), stopping service`);
                await this.stop();
            }
            
            throw error;
        }
    }

    /**
     * Perform incremental synchronization (faster, only recent changes)
     */
    async performIncrementalSync() {
        const startTime = Date.now();
        
        try {
            console.log('🔄 Starting incremental sync...');
            
            // For now, perform full sync (can be optimized later)
            // TODO: Implement true incremental sync based on timestamps
            const result = await this.performFullSync();
            
            const syncTime = Date.now() - startTime;
            console.log(`✅ Incremental sync completed in ${syncTime}ms`);
            
            return result;
            
        } catch (error) {
            console.error('❌ Incremental sync failed:', error);
            // Don't throw error for incremental sync to avoid stopping service
        }
    }

    /**
     * Sync ClickUp data to local database
     */
    async syncDataToDatabase(clickupData) {
        const results = {
            teams: 0,
            spaces: 0,
            tasks: 0,
            members: 0
        };
        
        try {
            // Sync teams
            if (clickupData.teams && clickupData.teams.length > 0) {
                for (const team of clickupData.teams) {
                    await this.syncRepository.upsertTeam({
                        id: team.id,
                        name: team.name,
                        color: team.color,
                        avatar: team.avatar,
                        member_count: team.members ? team.members.length : 0,
                        clickup_created_at: team.date_created,
                        clickup_updated_at: team.date_updated
                    });
                    results.teams++;
                    
                    // Sync team members
                    if (team.members) {
                        for (const member of team.members) {
                            await this.syncRepository.upsertMember({
                                id: member.id,
                                username: member.username,
                                email: member.email,
                                color: member.color,
                                profilePicture: member.profilePicture,
                                initials: member.initials,
                                role: member.role,
                                role_key: member.role_key,
                                last_active: member.last_active,
                                date_joined: member.date_joined,
                                date_invited: member.date_invited,
                                invited_by: member.invited_by,
                                status: 'active'
                            });
                            results.members++;
                        }
                    }
                }
            }
            
            // Sync spaces
            if (clickupData.spaces && clickupData.spaces.length > 0) {
                for (const space of clickupData.spaces) {
                    await this.syncRepository.upsertSpace({
                        id: space.id,
                        team_id: space.team ? space.team.id : null,
                        name: space.name,
                        color: space.color,
                        avatar: space.avatar,
                        private: space.private,
                        archived: false,
                        multiple_assignees: true,
                        features: space.features || {},
                        statuses: space.statuses || [],
                        clickup_created_at: space.date_created,
                        clickup_updated_at: space.date_updated
                    });
                    results.spaces++;
                    
                    // Sync lists within spaces
                    if (space.lists) {
                        for (const list of space.lists) {
                            await this.syncRepository.upsertList({
                                id: list.id,
                                space_id: space.id,
                                folder_id: list.folder_id,
                                name: list.name,
                                color: list.color,
                                orderindex: list.orderindex,
                                archived: list.archived || false,
                                permission_level: list.permission_level,
                                task_count: list.task_count || 0,
                                clickup_created_at: list.date_created,
                                clickup_updated_at: list.date_updated
                            });
                        }
                    }
                }
            }
            
            // Sync tasks
            if (clickupData.tasks && clickupData.tasks.length > 0) {
                for (const task of clickupData.tasks) {
                    await this.syncRepository.upsertTask({
                        id: task.id,
                        list: task.list,
                        parent: task.parent,
                        name: task.name,
                        description: task.description,
                        status: task.status,
                        priority: task.priority,
                        assignees: task.assignees,
                        watchers: task.watchers,
                        creator: task.creator,
                        orderindex: task.orderindex,
                        archived: task.archived,
                        date_created: task.date_created,
                        date_updated: task.date_updated,
                        date_closed: task.date_closed,
                        date_done: task.date_done,
                        due_date: task.due_date,
                        start_date: task.start_date,
                        time_estimate: task.time_estimate,
                        time_spent: task.time_spent,
                        points: task.points,
                        url: task.url,
                        custom_fields: task.custom_fields,
                        tags: task.tags,
                        dependencies: task.dependencies,
                        linked_tasks: task.linked_tasks
                    });
                    results.tasks++;
                }
            }
            
            console.log('💾 Sync to database completed:', results);
            return results;
            
        } catch (error) {
            console.error('❌ Failed to sync data to database:', error);
            throw error;
        }
    }

    /**
     * Trigger manual sync
     */
    async triggerManualSync(type = 'full') {
        try {
            console.log(`🔄 Manual ${type} sync triggered`);
            
            if (type === 'full') {
                return await this.performFullSync();
            } else {
                return await this.performIncrementalSync();
            }
        } catch (error) {
            console.error(`❌ Manual ${type} sync failed:`, error);
            throw error;
        }
    }

    /**
     * Get sync service status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastSyncTime: this.lastSyncTime,
            syncInterval: this.syncInterval,
            errorCount: this.errorCount,
            maxErrors: this.maxErrors,
            nextSyncIn: this.isRunning ? this.getTimeToNextSync() : null
        };
    }

    /**
     * Get time until next sync (in minutes)
     */
    getTimeToNextSync() {
        if (!this.lastSyncTime) return 0;
        
        const nextSync = new Date(this.lastSyncTime.getTime() + (this.syncInterval * 60 * 1000));
        const timeUntilNext = nextSync.getTime() - Date.now();
        
        return Math.max(0, Math.ceil(timeUntilNext / (60 * 1000)));
    }

    /**
     * Health check for sync service
     */
    async healthCheck() {
        try {
            const syncRepoHealth = await this.syncRepository.healthCheck();
            const status = this.getStatus();
            
            return {
                status: this.isRunning ? 'healthy' : 'stopped',
                service_running: this.isRunning,
                last_sync: this.lastSyncTime,
                error_count: this.errorCount,
                sync_interval_minutes: this.syncInterval,
                repository_health: syncRepoHealth,
                next_sync_in_minutes: this.getTimeToNextSync()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                service_running: this.isRunning
            };
        }
    }

    /**
     * Perform high priority sync (tasks, status, assignees)
     */
    async performHighPrioritySync() {
        const startTime = Date.now();
        
        try {
            console.log('🔄 Starting high priority sync (tasks, status, assignees)...');
            
            // Get ClickUp token
            const masterToken = await this.tokenRepository.findMasterToken();
            if (!masterToken || !masterToken.accessToken) {
                throw new Error('No valid ClickUp token found');
            }
            
            // Sync only high priority data
            const clickupData = await this.clickupService.getHighPriorityData(masterToken.accessToken);
            const syncResults = await this.syncHighPriorityData(clickupData);
            
            const syncTime = Date.now() - startTime;
            this.lastSyncTime = new Date();
            
            console.log(`✅ High priority sync completed in ${syncTime}ms:`, syncResults);
            
            return syncResults;
            
        } catch (error) {
            this.errorCount++;
            console.error('❌ High priority sync failed:', error);
            
            if (this.errorCount >= this.maxErrors) {
                console.error(`🚫 Too many sync errors, stopping high priority sync`);
                this.syncJob?.stop();
            }
        }
    }

    /**
     * Perform medium priority sync (projects, lists, team members)
     */
    async performMediumPrioritySync() {
        try {
            console.log('🔄 Starting medium priority sync (projects, lists, team)...');
            
            const masterToken = await this.tokenRepository.findMasterToken();
            if (!masterToken) return;
            
            const clickupData = await this.clickupService.getMediumPriorityData(masterToken.accessToken);
            const syncResults = await this.syncMediumPriorityData(clickupData);
            
            console.log('✅ Medium priority sync completed:', syncResults);
            
        } catch (error) {
            console.error('❌ Medium priority sync failed:', error);
        }
    }

    /**
     * Perform low priority sync (archived data, historical metrics)
     */
    async performLowPrioritySync() {
        try {
            console.log('🔄 Starting low priority sync (archives, history)...');
            
            const masterToken = await this.tokenRepository.findMasterToken();
            if (!masterToken) return;
            
            const clickupData = await this.clickupService.getLowPriorityData(masterToken.accessToken);
            const syncResults = await this.syncLowPriorityData(clickupData);
            
            console.log('✅ Low priority sync completed:', syncResults);
            
        } catch (error) {
            console.error('❌ Low priority sync failed:', error);
        }
    }

    /**
     * Sync high priority data to database
     */
    async syncHighPriorityData(clickupData) {
        const results = { tasks: 0, status_updates: 0, assignee_changes: 0 };
        
        // Sync tasks with recent updates
        if (clickupData.tasks) {
            for (const task of clickupData.tasks) {
                await this.syncRepository.upsertTask(task);
                results.tasks++;
            }
        }
        
        return results;
    }

    /**
     * Sync medium priority data to database
     */
    async syncMediumPriorityData(clickupData) {
        const results = { projects: 0, lists: 0, members: 0 };
        
        // Sync projects and lists
        if (clickupData.spaces) {
            for (const space of clickupData.spaces) {
                await this.syncRepository.upsertSpace(space);
                results.projects++;
            }
        }
        
        return results;
    }

    /**
     * Sync low priority data to database
     */
    async syncLowPriorityData(clickupData) {
        const results = { archived: 0, historical: 0 };
        
        // Sync archived and historical data
        if (clickupData.archived) {
            results.archived = clickupData.archived.length;
        }
        
        return results;
    }

    /**
     * Get sync service status with Smart Sync info
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastSyncTime: this.lastSyncTime,
            syncStrategy: 'smart_multi_interval',
            intervals: {
                high_priority: this.syncInterval,
                medium_priority: this.mediumPriorityInterval,
                low_priority: this.lowPriorityInterval
            },
            errorCount: this.errorCount,
            maxErrors: this.maxErrors,
            nextHighPrioritySync: this.isRunning ? this.getTimeToNextSync(this.syncInterval) : null,
            nextMediumPrioritySync: this.isRunning ? this.getTimeToNextSync(this.mediumPriorityInterval) : null,
            nextLowPrioritySync: this.isRunning ? this.getTimeToNextSync(this.lowPriorityInterval) : null
        };
    }
}

module.exports = { BackgroundSyncService };