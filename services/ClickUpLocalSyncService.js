/**
 * ClickUp Local Sync Service
 * Background service ที่ดึงข้อมูลจาก ClickUp API มาเก็บใน Local Database
 * เพื่อให้ระบบมีประสิทธิภาพสูงและลดการพึ่งพา ClickUp API
 * 
 * Features:
 * - Auto sync ทุก 5-10 นาทีแบบ configurable
 * - Error handling และ retry mechanism
 * - Comprehensive logging
 * - Health monitoring
 * - Incremental sync (เฉพาะข้อมูลที่เปลี่ยน)
 */

const { Pool } = require('pg');
const axios = require('axios');

class ClickUpLocalSyncService {
    constructor(options = {}) {
        this.syncInterval = options.syncInterval || 300000; // 5 minutes default
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 5000; // 5 seconds
        this.isRunning = false;
        this.syncTimer = null;
        this.lastSyncTime = null;
        this.syncStats = {
            totalSyncs: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            lastError: null,
            avgSyncDuration: 0
        };

        // Database connection
        this.db = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'taskflow',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        // ClickUp API configuration
        this.clickupBaseUrl = 'https://api.clickup.com/api/v2';
        this.accessToken = null;
    }

    /**
     * เริ่มต้น Background Sync Service
     */
    async start() {
        if (this.isRunning) {
            console.log('ClickUp Sync Service is already running');
            return;
        }

        try {
            console.log('🚀 Starting ClickUp Local Sync Service...');
            
            // Get ClickUp access token from database
            await this.loadAccessToken();
            
            if (!this.accessToken) {
                throw new Error('No ClickUp access token found. Please authenticate first.');
            }

            // Initial sync
            await this.performFullSync();

            // Start interval sync
            this.isRunning = true;
            this.startPeriodicSync();

            console.log(`✅ ClickUp Sync Service started successfully (interval: ${this.syncInterval}ms)`);
        } catch (error) {
            console.error('❌ Failed to start ClickUp Sync Service:', error.message);
            throw error;
        }
    }

    /**
     * หยุด Background Sync Service
     */
    async stop() {
        if (!this.isRunning) {
            console.log('ClickUp Sync Service is not running');
            return;
        }

        console.log('🛑 Stopping ClickUp Local Sync Service...');
        
        this.isRunning = false;
        
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }

        await this.db.end();
        console.log('✅ ClickUp Sync Service stopped successfully');
    }

    /**
     * โหลด Access Token จาก database
     */
    async loadAccessToken() {
        try {
            const result = await this.db.query(`
                SELECT access_token 
                FROM clickup_tokens 
                WHERE expires_at > NOW() OR expires_at IS NULL
                ORDER BY created_at DESC 
                LIMIT 1
            `);

            if (result.rows.length > 0) {
                this.accessToken = result.rows[0].access_token;
                console.log('✅ ClickUp access token loaded successfully');
            } else {
                console.warn('⚠️ No valid ClickUp access token found');
            }
        } catch (error) {
            console.error('❌ Failed to load ClickUp access token:', error.message);
            throw error;
        }
    }

    /**
     * เริ่ม Periodic Sync
     */
    startPeriodicSync() {
        this.syncTimer = setInterval(async () => {
            try {
                await this.performIncrementalSync();
            } catch (error) {
                console.error('❌ Periodic sync failed:', error.message);
                this.syncStats.failedSyncs++;
                this.syncStats.lastError = error.message;
            }
        }, this.syncInterval);
    }

    /**
     * ทำ Full Sync (ครั้งแรกหรือตอน reset)
     */
    async performFullSync() {
        const startTime = Date.now();
        console.log('🔄 Starting full ClickUp data sync...');

        try {
            await this.recordSyncStart('full_sync');

            // Sync teams first
            const teams = await this.syncTeams();
            
            // Sync members for each team
            for (const team of teams) {
                await this.syncTeamMembers(team.id);
            }

            // Sync tasks for each team
            for (const team of teams) {
                await this.syncTeamTasks(team.id);
            }

            const duration = Date.now() - startTime;
            await this.recordSyncCompletion('full_sync', duration, teams.length);

            this.syncStats.totalSyncs++;
            this.syncStats.successfulSyncs++;
            this.lastSyncTime = new Date();
            this.updateAvgSyncDuration(duration);

            console.log(`✅ Full sync completed successfully in ${duration}ms`);
        } catch (error) {
            await this.recordSyncFailure('full_sync', error.message);
            throw error;
        }
    }

    /**
     * ทำ Incremental Sync (เฉพาะข้อมูลที่เปลี่ยน)
     */
    async performIncrementalSync() {
        const startTime = Date.now();
        console.log('🔄 Starting incremental ClickUp data sync...');

        try {
            await this.recordSyncStart('incremental_sync');

            // Get last sync time for incremental sync
            const lastSync = await this.getLastSyncTime();
            
            // Sync updated tasks only
            const updatedTasks = await this.syncUpdatedTasks(lastSync);

            const duration = Date.now() - startTime;
            await this.recordSyncCompletion('incremental_sync', duration, updatedTasks.length);

            this.syncStats.totalSyncs++;
            this.syncStats.successfulSyncs++;
            this.lastSyncTime = new Date();
            this.updateAvgSyncDuration(duration);

            console.log(`✅ Incremental sync completed successfully in ${duration}ms (${updatedTasks.length} tasks updated)`);
        } catch (error) {
            await this.recordSyncFailure('incremental_sync', error.message);
            this.syncStats.failedSyncs++;
            this.syncStats.lastError = error.message;
            console.error('❌ Incremental sync failed:', error.message);
        }
    }

    /**
     * Sync Teams data
     */
    async syncTeams() {
        try {
            console.log('📊 Syncing teams data...');
            
            const response = await this.makeClickUpRequest('/team');
            const teams = response.teams || [];

            for (const team of teams) {
                await this.db.query(`
                    INSERT INTO clickup_teams (id, name, color, avatar, member_count, synced_at)
                    VALUES ($1, $2, $3, $4, $5, NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        color = EXCLUDED.color,
                        avatar = EXCLUDED.avatar,
                        member_count = EXCLUDED.member_count,
                        synced_at = NOW(),
                        updated_at = NOW()
                `, [
                    team.id,
                    team.name,
                    team.color || null,
                    team.avatar || null,
                    team.members?.length || 0
                ]);
            }

            console.log(`✅ Synced ${teams.length} teams`);
            return teams;
        } catch (error) {
            console.error('❌ Failed to sync teams:', error.message);
            throw error;
        }
    }

    /**
     * Sync Team Members data
     */
    async syncTeamMembers(teamId) {
        try {
            console.log(`👥 Syncing members for team ${teamId}...`);
            
            const response = await this.makeClickUpRequest(`/team/${teamId}/member`);
            const members = response.members || [];

            for (const memberData of members) {
                const member = memberData.user;
                const invitedBy = memberData.invited_by;

                await this.db.query(`
                    INSERT INTO clickup_members (
                        id, team_id, username, email, color, profile_picture, initials,
                        role, role_subtype, role_key, custom_role, last_active,
                        date_joined, date_invited, invited_by_id, invited_by_username,
                        invited_by_email, synced_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        team_id = EXCLUDED.team_id,
                        username = EXCLUDED.username,
                        email = EXCLUDED.email,
                        color = EXCLUDED.color,
                        profile_picture = EXCLUDED.profile_picture,
                        initials = EXCLUDED.initials,
                        role = EXCLUDED.role,
                        role_subtype = EXCLUDED.role_subtype,
                        role_key = EXCLUDED.role_key,
                        custom_role = EXCLUDED.custom_role,
                        last_active = EXCLUDED.last_active,
                        synced_at = NOW(),
                        updated_at = NOW()
                `, [
                    member.id,
                    teamId,
                    member.username,
                    member.email,
                    member.color,
                    member.profilePicture,
                    member.initials,
                    member.role,
                    member.role_subtype,
                    member.role_key,
                    member.custom_role,
                    member.last_active,
                    member.date_joined,
                    member.date_invited,
                    invitedBy?.id || null,
                    invitedBy?.username || null,
                    invitedBy?.email || null
                ]);
            }

            console.log(`✅ Synced ${members.length} members for team ${teamId}`);
            return members;
        } catch (error) {
            console.error(`❌ Failed to sync members for team ${teamId}:`, error.message);
            throw error;
        }
    }

    /**
     * Sync Team Tasks data
     */
    async syncTeamTasks(teamId) {
        try {
            console.log(`📋 Syncing tasks for team ${teamId}...`);
            
            // Get all lists for the team
            const spaces = await this.makeClickUpRequest(`/team/${teamId}/space`);
            let allTasks = [];

            for (const space of spaces.spaces || []) {
                const folders = await this.makeClickUpRequest(`/space/${space.id}/folder`);
                
                for (const folder of folders.folders || []) {
                    const lists = await this.makeClickUpRequest(`/folder/${folder.id}/list`);
                    
                    for (const list of lists.lists || []) {
                        const tasksResponse = await this.makeClickUpRequest(`/list/${list.id}/task`);
                        const tasks = tasksResponse.tasks || [];
                        
                        for (const task of tasks) {
                            await this.saveTask(task, teamId, space, folder, list);
                        }
                        
                        allTasks = allTasks.concat(tasks);
                    }
                }
            }

            console.log(`✅ Synced ${allTasks.length} tasks for team ${teamId}`);
            return allTasks;
        } catch (error) {
            console.error(`❌ Failed to sync tasks for team ${teamId}:`, error.message);
            throw error;
        }
    }

    /**
     * Sync Updated Tasks (incremental)
     */
    async syncUpdatedTasks(lastSyncTime) {
        try {
            console.log(`📋 Syncing updated tasks since ${lastSyncTime}...`);
            
            // Get all teams
            const teamsResult = await this.db.query('SELECT id FROM clickup_teams');
            const teams = teamsResult.rows;
            
            let allUpdatedTasks = [];

            for (const team of teams) {
                // Get updated tasks for each team
                const spaces = await this.makeClickUpRequest(`/team/${team.id}/space`);
                
                for (const space of spaces.spaces || []) {
                    const folders = await this.makeClickUpRequest(`/space/${space.id}/folder`);
                    
                    for (const folder of folders.folders || []) {
                        const lists = await this.makeClickUpRequest(`/folder/${folder.id}/list`);
                        
                        for (const list of lists.lists || []) {
                            // Get tasks updated since last sync
                            const tasksResponse = await this.makeClickUpRequest(
                                `/list/${list.id}/task?date_updated_gt=${lastSyncTime}`
                            );
                            const tasks = tasksResponse.tasks || [];
                            
                            for (const task of tasks) {
                                await this.saveTask(task, team.id, space, folder, list);
                            }
                            
                            allUpdatedTasks = allUpdatedTasks.concat(tasks);
                        }
                    }
                }
            }

            console.log(`✅ Synced ${allUpdatedTasks.length} updated tasks`);
            return allUpdatedTasks;
        } catch (error) {
            console.error('❌ Failed to sync updated tasks:', error.message);
            throw error;
        }
    }

    /**
     * Save individual task to database
     */
    async saveTask(task, teamId, space, folder, list) {
        try {
            await this.db.query(`
                INSERT INTO clickup_tasks (
                    id, name, description, status_id, status_name, status_color,
                    priority_id, priority_name, priority_color, assignee_id, creator_id,
                    team_id, list_id, list_name, folder_id, folder_name,
                    space_id, space_name, date_created, date_updated, date_closed,
                    date_done, due_date, start_date, time_estimate, time_spent,
                    points, url, watchers, tags, custom_fields, subtasks,
                    dependencies, linked_tasks, archived, synced_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    status_id = EXCLUDED.status_id,
                    status_name = EXCLUDED.status_name,
                    status_color = EXCLUDED.status_color,
                    priority_id = EXCLUDED.priority_id,
                    priority_name = EXCLUDED.priority_name,
                    priority_color = EXCLUDED.priority_color,
                    assignee_id = EXCLUDED.assignee_id,
                    date_updated = EXCLUDED.date_updated,
                    date_closed = EXCLUDED.date_closed,
                    date_done = EXCLUDED.date_done,
                    due_date = EXCLUDED.due_date,
                    start_date = EXCLUDED.start_date,
                    time_estimate = EXCLUDED.time_estimate,
                    time_spent = EXCLUDED.time_spent,
                    points = EXCLUDED.points,
                    watchers = EXCLUDED.watchers,
                    tags = EXCLUDED.tags,
                    custom_fields = EXCLUDED.custom_fields,
                    subtasks = EXCLUDED.subtasks,
                    dependencies = EXCLUDED.dependencies,
                    linked_tasks = EXCLUDED.linked_tasks,
                    archived = EXCLUDED.archived,
                    synced_at = NOW(),
                    updated_at = NOW()
            `, [
                task.id,
                task.name,
                task.description || null,
                task.status?.id || null,
                task.status?.status || null,
                task.status?.color || null,
                task.priority?.id || null,
                task.priority?.priority || null,
                task.priority?.color || null,
                task.assignees?.[0]?.id || null,
                task.creator?.id || null,
                teamId,
                list.id,
                list.name,
                folder.id,
                folder.name,
                space.id,
                space.name,
                task.date_created,
                task.date_updated,
                task.date_closed,
                task.date_done,
                task.due_date,
                task.start_date,
                task.time_estimate,
                task.time_spent,
                task.points || null,
                task.url,
                JSON.stringify(task.watchers || []),
                JSON.stringify(task.tags || []),
                JSON.stringify(task.custom_fields || []),
                JSON.stringify(task.subtasks || []),
                JSON.stringify(task.dependencies || []),
                JSON.stringify(task.linked_tasks || []),
                task.archived || false
            ]);

            // Handle task-member assignments
            if (task.assignees && task.assignees.length > 0) {
                for (const assignee of task.assignees) {
                    await this.db.query(`
                        INSERT INTO clickup_task_members (task_id, member_id, role, assigned_at)
                        VALUES ($1, $2, 'assignee', NOW())
                        ON CONFLICT (task_id, member_id) DO NOTHING
                    `, [task.id, assignee.id]);
                }
            }
        } catch (error) {
            console.error(`❌ Failed to save task ${task.id}:`, error.message);
            throw error;
        }
    }

    /**
     * Make ClickUp API request with error handling and retry
     */
    async makeClickUpRequest(endpoint, retryCount = 0) {
        try {
            const response = await axios.get(`${this.clickupBaseUrl}${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            if (retryCount < this.retryAttempts) {
                console.warn(`⚠️ Request failed, retrying (${retryCount + 1}/${this.retryAttempts})...`);
                await this.sleep(this.retryDelay);
                return this.makeClickUpRequest(endpoint, retryCount + 1);
            }

            console.error(`❌ ClickUp API request failed after ${this.retryAttempts} attempts:`, error.message);
            throw error;
        }
    }

    /**
     * Record sync start
     */
    async recordSyncStart(syncType) {
        try {
            await this.db.query(`
                INSERT INTO clickup_sync_status (sync_type, status, started_at)
                VALUES ($1, 'running', NOW())
            `, [syncType]);
        } catch (error) {
            console.error('Failed to record sync start:', error.message);
        }
    }

    /**
     * Record sync completion
     */
    async recordSyncCompletion(syncType, duration, recordCount) {
        try {
            await this.db.query(`
                UPDATE clickup_sync_status
                SET status = 'completed',
                    completed_at = NOW(),
                    sync_duration_ms = $1,
                    synced_records = $2,
                    next_sync_scheduled = NOW() + INTERVAL '${this.syncInterval / 1000} seconds'
                WHERE sync_type = $3 AND status = 'running'
            `, [duration, recordCount, syncType]);
        } catch (error) {
            console.error('Failed to record sync completion:', error.message);
        }
    }

    /**
     * Record sync failure
     */
    async recordSyncFailure(syncType, errorMessage) {
        try {
            await this.db.query(`
                UPDATE clickup_sync_status
                SET status = 'failed',
                    completed_at = NOW(),
                    error_message = $1
                WHERE sync_type = $2 AND status = 'running'
            `, [errorMessage, syncType]);
        } catch (error) {
            console.error('Failed to record sync failure:', error.message);
        }
    }

    /**
     * Get last sync time for incremental sync
     */
    async getLastSyncTime() {
        try {
            const result = await this.db.query(`
                SELECT completed_at
                FROM clickup_sync_status
                WHERE status = 'completed'
                ORDER BY completed_at DESC
                LIMIT 1
            `);

            if (result.rows.length > 0) {
                return Math.floor(new Date(result.rows[0].completed_at).getTime());
            }

            // If no previous sync, use 24 hours ago
            return Math.floor(Date.now() - (24 * 60 * 60 * 1000));
        } catch (error) {
            console.error('Failed to get last sync time:', error.message);
            return Math.floor(Date.now() - (24 * 60 * 60 * 1000));
        }
    }

    /**
     * Update average sync duration
     */
    updateAvgSyncDuration(duration) {
        if (this.syncStats.avgSyncDuration === 0) {
            this.syncStats.avgSyncDuration = duration;
        } else {
            this.syncStats.avgSyncDuration = (this.syncStats.avgSyncDuration + duration) / 2;
        }
    }

    /**
     * Get sync service health status
     */
    getHealthStatus() {
        return {
            isRunning: this.isRunning,
            lastSyncTime: this.lastSyncTime,
            syncInterval: this.syncInterval,
            stats: this.syncStats,
            healthScore: this.calculateHealthScore()
        };
    }

    /**
     * Calculate health score
     */
    calculateHealthScore() {
        if (this.syncStats.totalSyncs === 0) return 100;
        
        const successRate = (this.syncStats.successfulSyncs / this.syncStats.totalSyncs) * 100;
        const timeSinceLastSync = this.lastSyncTime ? Date.now() - this.lastSyncTime.getTime() : 0;
        const isRecent = timeSinceLastSync < (this.syncInterval * 2);
        
        return Math.round(successRate * (isRecent ? 1 : 0.5));
    }

    /**
     * Utility function for delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Force sync now (manual trigger)
     */
    async forceSyncNow() {
        if (!this.isRunning) {
            throw new Error('Sync service is not running');
        }

        console.log('🔄 Force sync triggered manually...');
        await this.performIncrementalSync();
    }

    /**
     * Get sync statistics
     */
    getSyncStatistics() {
        return {
            ...this.syncStats,
            isRunning: this.isRunning,
            lastSyncTime: this.lastSyncTime,
            syncInterval: this.syncInterval,
            nextSyncTime: this.lastSyncTime ? new Date(this.lastSyncTime.getTime() + this.syncInterval) : null
        };
    }
}

module.exports = ClickUpLocalSyncService;