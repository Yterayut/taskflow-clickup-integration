/**
 * ClickUp Sync Service
 * Handles synchronization between ClickUp API and local database
 */
class ClickUpSyncService {
    constructor({
        clickupIntegration,
        syncRepository,
        tokenRepository
    }) {
        this.clickupIntegration = clickupIntegration;
        this.syncRepository = syncRepository;
        this.tokenRepository = tokenRepository;
    }


    /**
     * Convert ClickUp timestamp to PostgreSQL format
     */
    convertClickUpTimestamp(timestamp) {
        if (!timestamp) return null;
        
        try {
            // ClickUp sometimes sends timestamps in milliseconds since epoch
            const timestampNum = parseInt(timestamp);
            
            // PostgreSQL timestamp range: 4713 BC to 294276 AD
            // But in practice, dates beyond year 3000 are problematic
            // Current time in ms: ~1700000000000, year 3000 would be ~32503680000000
            const maxSafeTimestamp = 32503680000000; // Year 3000
            const minSafeTimestamp = 946684800000;   // Year 2000
            
            // For timestamps too far in future or past, use current time
            if (timestampNum > maxSafeTimestamp || timestampNum < minSafeTimestamp) {
                console.warn(`Timestamp out of safe range: ${timestamp}, using current time`);
                return new Date().toISOString();
            }
            
            if (timestampNum > 1000000000000) {
                // Milliseconds since epoch
                const date = new Date(timestampNum);
                if (isNaN(date.getTime())) {
                    console.warn(`Invalid date from timestamp: ${timestamp}, using current time`);
                    return new Date().toISOString();
                }
                return date.toISOString();
            } else if (timestampNum > 1000000000) {
                // Seconds since epoch, convert to milliseconds
                const date = new Date(timestampNum * 1000);
                if (isNaN(date.getTime())) {
                    console.warn(`Invalid date from timestamp: ${timestamp}, using current time`);
                    return new Date().toISOString();
                }
                return date.toISOString();
            }
            
            // Try to parse as ISO string
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                console.warn(`Invalid date from string: ${timestamp}, using current time`);
                return new Date().toISOString();
            }
            return date.toISOString();
        } catch (error) {
            console.warn(`Error converting timestamp ${timestamp}:`, error.message);
            return new Date().toISOString(); // Fallback to current time
        }
    }

    /**
     * Convert ClickUp time values to PostgreSQL bigint
     */
    convertTimeToInteger(timeValue) {
        if (!timeValue) return null;
        
        try {
            // Handle string with excessive decimal precision
            const stringValue = String(timeValue);
            if (stringValue.includes('.')) {
                // Remove excessive decimal precision and ensure integer result
                const numValue = Math.floor(parseFloat(stringValue));
                return isNaN(numValue) ? null : numValue;
            } else {
                const numValue = parseInt(stringValue);
                return isNaN(numValue) ? null : numValue;
            }
        } catch (error) {
            console.warn(`Error converting time value ${timeValue}:`, error.message);
            return null;
        }
    }

        /**
     * Perform full sync from ClickUp API to local database
     */
    async performFullSync() {
        console.log('🔄 Starting full ClickUp sync...');
        
        try {
            // Get ClickUp token
            const token = await this.tokenRepository.findMasterToken();
            if (!token || !token.accessToken) {
                throw new Error('No valid ClickUp token available');
            }

            // Update sync metadata to "syncing" status
            await this.syncRepository.updateSyncMetadata({
                sync_status: 'syncing',
                last_full_sync: new Date(),
                sync_errors: null
            });

            // Fetch comprehensive data from ClickUp
            console.log('📡 Fetching data from ClickUp API...');
            const clickupData = await this.clickupIntegration.getComprehensiveData(token.accessToken);

            let syncCounts = {
                teams: 0,
                spaces: 0,
                lists: 0,
                tasks: 0,
                members: 0
            };

            // Sync Teams
            console.log('👥 Syncing teams...');
            if (clickupData.teams && clickupData.teams.length > 0) {
                for (const team of clickupData.teams) {
                    // Convert ClickUp timestamps before saving
                    const teamData = {
                        ...team,
                        clickup_created_at: this.convertClickUpTimestamp(team.date_created),
                        clickup_updated_at: this.convertClickUpTimestamp(team.date_updated)
                    };
                    await this.syncRepository.upsertTeam(teamData);
                    syncCounts.teams++;

                    // Sync team members
                    if (team.members) {
                        for (const memberData of team.members) {
                            // Convert member timestamps (keep original field names for repository)
                            const memberUser = {
                                ...memberData.user,
                                last_active: this.convertClickUpTimestamp(memberData.user.last_active),
                                date_joined: this.convertClickUpTimestamp(memberData.user.date_joined),
                                date_invited: this.convertClickUpTimestamp(memberData.user.date_invited)
                            };
                            const member = await this.syncRepository.upsertMember(memberUser);
                            
                            // Create team-member relationship
                            await this.syncRepository.db.query(`
                                INSERT INTO clickup_team_members (team_id, member_id, role_key, custom_role, status)
                                VALUES ($1, $2, $3, $4, $5)
                                ON CONFLICT (team_id, member_id) DO UPDATE SET
                                    role_key = EXCLUDED.role_key,
                                    custom_role = EXCLUDED.custom_role,
                                    status = EXCLUDED.status
                            `, [
                                team.id,
                                memberData.user.id,
                                memberData.user.role_key,
                                memberData.user.custom_role,
                                memberData.invited_by?.status || 'active'
                            ]);
                            syncCounts.members++;
                        }
                    }
                }
            }

            // Sync Spaces
            console.log('🏠 Syncing spaces...');
            if (clickupData.spaces && clickupData.spaces.length > 0) {
                for (const space of clickupData.spaces) {
                    // Find the team ID for this space
                    const teamId = clickupData.teams?.[0]?.id || null;
                    // Convert space timestamps
                    const spaceData = {
                        ...space,
                        team_id: teamId,
                        clickup_created_at: this.convertClickUpTimestamp(space.date_created),
                        clickup_updated_at: this.convertClickUpTimestamp(space.date_updated)
                    };
                    await this.syncRepository.upsertSpace(spaceData);
                    syncCounts.spaces++;
                }
            }

            // Sync Lists (from tasks data)
            console.log('📋 Syncing lists...');
            const listIds = new Set();
            if (clickupData.tasks && clickupData.tasks.length > 0) {
                for (const task of clickupData.tasks) {
                    if (task.list && !listIds.has(task.list.id)) {
                        listIds.add(task.list.id);
                        
                        const listData = {
                            id: task.list.id,
                            name: task.list.name,
                            space_id: task.space?.id,
                            folder_id: task.folder?.id,
                            orderindex: 0,
                            clickup_created_at: this.convertClickUpTimestamp(task.list.date_created),
                            clickup_updated_at: this.convertClickUpTimestamp(task.list.date_updated)
                        };
                        await this.syncRepository.upsertList(listData);
                        syncCounts.lists++;
                    }
                }
            }

            // Sync Tasks
            console.log('✅ Syncing tasks...');
            if (clickupData.tasks && clickupData.tasks.length > 0) {
                for (const task of clickupData.tasks) {
                    // Convert task timestamps and numeric fields
                    const taskData = {
                        ...task,
                        clickup_date_created: this.convertClickUpTimestamp(task.date_created),
                        clickup_date_updated: this.convertClickUpTimestamp(task.date_updated),
                        clickup_date_closed: this.convertClickUpTimestamp(task.date_closed),
                        due_date: this.convertClickUpTimestamp(task.due_date),
                        start_date: this.convertClickUpTimestamp(task.start_date),
                        time_estimate: this.convertTimeToInteger(task.time_estimate),
                        time_spent: this.convertTimeToInteger(task.time_spent)
                    };
                    await this.syncRepository.upsertTask(taskData);
                    syncCounts.tasks++;
                }
            }

            // Update sync metadata with success
            await this.syncRepository.updateSyncMetadata({
                sync_status: 'completed',
                last_full_sync: new Date(),
                total_teams: syncCounts.teams,
                total_spaces: syncCounts.spaces,
                total_tasks: syncCounts.tasks,
                total_members: syncCounts.members,
                sync_errors: null
            });

            console.log('✅ Full sync completed successfully!');
            console.log('📊 Sync Summary:', syncCounts);

            return {
                success: true,
                counts: syncCounts,
                message: 'Full sync completed successfully'
            };

        } catch (error) {
            console.error('❌ Full sync failed:', error.message);
            
            // Update sync metadata with error
            await this.syncRepository.updateSyncMetadata({
                sync_status: 'error',
                sync_errors: {
                    message: error.message,
                    timestamp: new Date(),
                    stack: error.stack
                }
            });

            throw error;
        }
    }

    /**
     * Perform incremental sync (updated data only)
     */
    async performIncrementalSync() {
        console.log('🔄 Starting incremental ClickUp sync...');
        
        try {
            const syncMeta = await this.syncRepository.getSyncMetadata();
            const lastSync = syncMeta?.last_incremental_sync || syncMeta?.last_full_sync;
            
            if (!lastSync) {
                console.log('⚠️ No previous sync found, performing full sync instead');
                return await this.performFullSync();
            }

            // Get ClickUp token
            const token = await this.tokenRepository.findMasterToken();
            if (!token || !token.accessToken) {
                throw new Error('No valid ClickUp token available');
            }

            // For now, perform a simplified incremental sync
            // In production, this would use ClickUp's updated_since parameter
            console.log('📡 Fetching updated data from ClickUp API...');
            const clickupData = await this.clickupIntegration.getComprehensiveData(token.accessToken);

            let updateCounts = {
                tasks: 0,
                members: 0
            };

            // Sync only updated tasks (simplified approach)
            if (clickupData.tasks) {
                for (const task of clickupData.tasks) {
                    const taskUpdated = new Date(task.date_updated);
                    const lastSyncDate = new Date(lastSync);
                    
                    if (taskUpdated > lastSyncDate) {
                        // Convert task timestamps and numeric fields for incremental sync
                        const taskData = {
                            ...task,
                            clickup_date_created: this.convertClickUpTimestamp(task.date_created),
                            clickup_date_updated: this.convertClickUpTimestamp(task.date_updated),
                            clickup_date_closed: this.convertClickUpTimestamp(task.date_closed),
                            due_date: this.convertClickUpTimestamp(task.due_date),
                            start_date: this.convertClickUpTimestamp(task.start_date),
                            time_estimate: this.convertTimeToInteger(task.time_estimate),
                            time_spent: this.convertTimeToInteger(task.time_spent)
                        };
                        await this.syncRepository.upsertTask(taskData);
                        updateCounts.tasks++;
                    }
                }
            }

            // Update sync metadata
            await this.syncRepository.updateSyncMetadata({
                last_incremental_sync: new Date(),
                sync_errors: null
            });

            console.log('✅ Incremental sync completed!');
            console.log('📊 Update Summary:', updateCounts);

            return {
                success: true,
                counts: updateCounts,
                message: 'Incremental sync completed successfully'
            };

        } catch (error) {
            console.error('❌ Incremental sync failed:', error.message);
            throw error;
        }
    }

    /**
     * Get sync status and metadata
     */
    async getSyncStatus() {
        try {
            const syncMeta = await this.syncRepository.getSyncMetadata();
            const pendingJobs = await this.syncRepository.db.query(
                `SELECT COUNT(*) as count FROM clickup_sync_jobs WHERE status = 'pending'`
            );

            return {
                sync_metadata: syncMeta,
                pending_jobs: parseInt(pendingJobs.rows[0].count),
                last_sync_age_minutes: syncMeta?.last_full_sync 
                    ? Math.floor((Date.now() - new Date(syncMeta.last_full_sync).getTime()) / 60000)
                    : null
            };
        } catch (error) {
            console.error('❌ Failed to get sync status:', error.message);
            throw error;
        }
    }

    /**
     * Get dashboard data from local database
     */
    async getLocalDashboardData() {
        try {
            console.log('📊 Fetching dashboard data from local database...');
            const data = await this.syncRepository.getDashboardData();
            
            // Calculate workload statistics
            const workload = this.calculateWorkloadStats(data.tasks);
            
            return {
                ...data,
                workload,
                source: 'local_database',
                performance: {
                    query_time_ms: Date.now() - Date.now(), // This would be measured properly
                    data_freshness: data.sync_metadata?.last_full_sync
                }
            };
        } catch (error) {
            console.error('❌ Failed to get local dashboard data:', error.message);
            throw error;
        }
    }

    /**
     * Calculate workload statistics from tasks
     */
    calculateWorkloadStats(tasks) {
        const stats = {
            total: tasks.length,
            completed: 0,
            in_progress: 0,
            to_do: 0,
            overdue: 0,
            by_assignee: {},
            by_priority: {}
        };

        const now = new Date();

        for (const task of tasks) {
            // Status counts
            switch (task.status_name?.toLowerCase()) {
                case 'complete':
                case 'completed':
                case 'done':
                    stats.completed++;
                    break;
                case 'in progress':
                case 'in_progress':
                case 'working':
                    stats.in_progress++;
                    break;
                case 'to do':
                case 'todo':
                case 'open':
                    stats.to_do++;
                    break;
            }

            // Overdue check
            if (task.due_date && new Date(task.due_date) < now && task.status_type !== 'closed') {
                stats.overdue++;
            }

            // Assignee counts
            if (task.assignee_names) {
                for (const assignee of task.assignee_names) {
                    stats.by_assignee[assignee] = (stats.by_assignee[assignee] || 0) + 1;
                }
            }

            // Priority counts
            if (task.priority_name) {
                stats.by_priority[task.priority_name] = (stats.by_priority[task.priority_name] || 0) + 1;
            }
        }

        return stats;
    }

    /**
     * Schedule a sync job
     */
    async scheduleSyncJob(jobType = 'incremental_sync', payload = {}, priority = 5) {
        try {
            const job = await this.syncRepository.createSyncJob(jobType, payload, priority);
            console.log(`📅 Scheduled sync job: ${jobType} (ID: ${job.id})`);
            return job;
        } catch (error) {
            console.error('❌ Failed to schedule sync job:', error.message);
            throw error;
        }
    }
}

module.exports = { ClickUpSyncService };