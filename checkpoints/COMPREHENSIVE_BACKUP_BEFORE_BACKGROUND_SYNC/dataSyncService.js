const ClickUpService = require('./clickupService');

class DataSyncService {
    constructor(authService, redisClient = null) {
        this.authService = authService;
        this.redis = redisClient;
        this.clickupService = new ClickUpService();
        this.syncIntervals = new Map(); // Store sync intervals for cleanup
    }

    // Main sync method for a user's ClickUp data
    async syncUserData(userId) {
        try {
            console.log(`Starting data sync for user ${userId}`);
            
            // Get user's ClickUp tokens
            const tokens = await this.authService.getClickUpTokens(userId);
            if (!tokens) {
                throw new Error('User not authenticated with ClickUp');
            }

            // Set access token for ClickUp API calls
            this.clickupService.setAccessToken(tokens.access_token);

            // Get user's authorized teams
            const teamsData = await this.clickupService.getAuthorizedTeams();
            const teams = teamsData.teams || [];

            const syncResult = {
                userId,
                timestamp: Date.now(),
                teams: [],
                totalTasks: 0,
                totalMembers: 0,
                errors: []
            };

            // Sync each team
            for (const team of teams) {
                try {
                    const teamSyncResult = await this.syncTeamData(userId, team);
                    syncResult.teams.push(teamSyncResult);
                    syncResult.totalTasks += teamSyncResult.taskCount;
                    syncResult.totalMembers += teamSyncResult.memberCount;
                } catch (error) {
                    console.error(`Error syncing team ${team.id}:`, error.message);
                    syncResult.errors.push({
                        team: team.id,
                        error: error.message
                    });
                }
            }

            // Store sync result
            await this.storeSyncResult(userId, syncResult);
            
            console.log(`Data sync completed for user ${userId}: ${syncResult.totalTasks} tasks, ${syncResult.totalMembers} members`);
            return syncResult;

        } catch (error) {
            console.error(`Data sync failed for user ${userId}:`, error.message);
            throw error;
        }
    }

    // Sync data for a specific team
    async syncTeamData(userId, team) {
        const teamId = team.id;
        
        // Get team members
        const membersData = await this.clickupService.getTeamMembers(teamId);
        const members = membersData.members || [];

        // Get team tasks
        const tasksData = await this.clickupService.getTeamTasks(teamId, {
            include_closed: false,
            subtasks: true,
            order_by: 'updated'
        });
        const tasks = tasksData.tasks || [];

        // Transform data
        const transformedTasks = tasks.map(task => this.clickupService.transformTaskData(task));
        
        // Calculate task counts per member
        const memberTaskCounts = this.calculateMemberTaskCounts(transformedTasks);
        
        const transformedMembers = members.map(member => 
            this.clickupService.transformUserData(member, memberTaskCounts[member.user.id] || 0)
        );

        // Store team data
        await this.storeTeamData(userId, teamId, {
            team: {
                id: teamId,
                name: team.name,
                color: team.color,
                avatar: team.avatar
            },
            tasks: transformedTasks,
            members: transformedMembers,
            lastSync: Date.now()
        });

        return {
            teamId,
            teamName: team.name,
            taskCount: transformedTasks.length,
            memberCount: transformedMembers.length
        };
    }

    // Calculate task counts per team member
    calculateMemberTaskCounts(tasks) {
        const counts = {};
        
        tasks.forEach(task => {
            if (task.assignee_id && task.status !== 'completed') {
                counts[task.assignee_id] = (counts[task.assignee_id] || 0) + 1;
            }
        });

        return counts;
    }

    // Store team data in Redis
    async storeTeamData(userId, teamId, teamData) {
        if (!this.redis) return;

        const key = `team_data:${userId}:${teamId}`;
        
        try {
            await this.redis.setEx(key, 3600, JSON.stringify(teamData)); // 1 hour cache
        } catch (error) {
            console.error('Error storing team data:', error);
        }
    }

    // Get cached team data
    async getTeamData(userId, teamId) {
        if (!this.redis) return null;

        const key = `team_data:${userId}:${teamId}`;
        
        try {
            const data = await this.redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error retrieving team data:', error);
            return null;
        }
    }

    // Store sync result
    async storeSyncResult(userId, syncResult) {
        if (!this.redis) return;

        const key = `sync_result:${userId}`;
        
        try {
            await this.redis.setEx(key, 86400, JSON.stringify(syncResult)); // 24 hours
        } catch (error) {
            console.error('Error storing sync result:', error);
        }
    }

    // Get last sync result
    async getLastSyncResult(userId) {
        if (!this.redis) return null;

        const key = `sync_result:${userId}`;
        
        try {
            const data = await this.redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error retrieving sync result:', error);
            return null;
        }
    }

    // Get aggregated data for dashboard
    async getDashboardData(userId, teamId = null) {
        try {
            const lastSync = await this.getLastSyncResult(userId);
            if (!lastSync) {
                throw new Error('No sync data available. Please sync first.');
            }

            // If specific team requested
            if (teamId) {
                const teamData = await this.getTeamData(userId, teamId);
                if (!teamData) {
                    throw new Error(`No data available for team ${teamId}`);
                }
                
                return this.formatDashboardData([teamData], lastSync);
            }

            // Get all teams data
            const allTeamsData = [];
            for (const team of lastSync.teams) {
                const teamData = await this.getTeamData(userId, team.teamId);
                if (teamData) {
                    allTeamsData.push(teamData);
                }
            }

            return this.formatDashboardData(allTeamsData, lastSync);

        } catch (error) {
            console.error('Error getting dashboard data:', error);
            throw error;
        }
    }

    // Format data for dashboard consumption
    formatDashboardData(teamsData, syncResult) {
        const allTasks = [];
        const allMembers = [];
        
        teamsData.forEach(teamData => {
            allTasks.push(...teamData.tasks);
            allMembers.push(...teamData.members);
        });

        // Calculate KPIs
        const totalTasks = allTasks.length;
        const completedTasks = allTasks.filter(task => task.status === 'completed').length;
        const inProgressTasks = allTasks.filter(task => task.status === 'in_progress').length;
        const overdueTasks = allTasks.filter(task => {
            return task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
        }).length;

        // Calculate team utilization
        const totalCapacity = allMembers.reduce((sum, member) => sum + member.max_tasks, 0);
        const totalWorkload = allMembers.reduce((sum, member) => sum + member.current_tasks, 0);
        const avgUtilization = totalCapacity > 0 ? Math.round((totalWorkload / totalCapacity) * 100) : 0;

        // Recent activities
        const recentTasks = allTasks
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
            .slice(0, 10);

        const activities = recentTasks.map(task => ({
            id: task.id,
            type: task.status === 'completed' ? 'completed' : 'assigned',
            user: task.assignee,
            task: task.title,
            time: this.getRelativeTime(task.updated_at)
        }));

        return {
            kpis: {
                totalTasks,
                completedTasks,
                inProgressTasks,
                overdueTasks,
                avgUtilization
            },
            tasks: allTasks,
            team: allMembers,
            activities,
            lastSync: syncResult.timestamp,
            syncErrors: syncResult.errors || []
        };
    }

    // Get relative time string
    getRelativeTime(date) {
        const now = new Date();
        const diff = now - new Date(date);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 60) {
            return `${minutes} นาทีที่แล้ว`;
        } else if (hours < 24) {
            return `${hours} ชั่วโมงที่แล้ว`;
        } else {
            return `${days} วันที่แล้ว`;
        }
    }

    // Automatic sync scheduling
    startAutoSync(userId, intervalMinutes = 30) {
        // Clear existing interval if any
        this.stopAutoSync(userId);

        const intervalMs = intervalMinutes * 60 * 1000;
        const intervalId = setInterval(async () => {
            try {
                console.log(`Auto-syncing data for user ${userId}`);
                await this.syncUserData(userId);
            } catch (error) {
                console.error(`Auto-sync failed for user ${userId}:`, error.message);
            }
        }, intervalMs);

        this.syncIntervals.set(userId, intervalId);
        console.log(`Auto-sync started for user ${userId} (every ${intervalMinutes} minutes)`);
    }

    stopAutoSync(userId) {
        const intervalId = this.syncIntervals.get(userId);
        if (intervalId) {
            clearInterval(intervalId);
            this.syncIntervals.delete(userId);
            console.log(`Auto-sync stopped for user ${userId}`);
        }
    }

    // Clean up all intervals
    cleanup() {
        for (const [userId, intervalId] of this.syncIntervals) {
            clearInterval(intervalId);
        }
        this.syncIntervals.clear();
        console.log('All auto-sync intervals cleaned up');
    }

    // Manual sync with progress tracking
    async syncWithProgress(userId, progressCallback = null) {
        const updateProgress = (stage, progress, message) => {
            if (progressCallback) {
                progressCallback({ stage, progress, message });
            }
        };

        try {
            updateProgress('auth', 10, 'Authenticating with ClickUp...');
            
            const tokens = await this.authService.getClickUpTokens(userId);
            if (!tokens) {
                throw new Error('User not authenticated with ClickUp');
            }

            this.clickupService.setAccessToken(tokens.access_token);

            updateProgress('teams', 20, 'Fetching teams...');
            const teamsData = await this.clickupService.getAuthorizedTeams();
            const teams = teamsData.teams || [];

            const syncResult = {
                userId,
                timestamp: Date.now(),
                teams: [],
                totalTasks: 0,
                totalMembers: 0,
                errors: []
            };

            const teamProgress = 60 / teams.length; // 60% for team syncing
            let currentProgress = 20;

            for (let i = 0; i < teams.length; i++) {
                const team = teams[i];
                updateProgress('team_sync', currentProgress, `Syncing team: ${team.name}`);
                
                try {
                    const teamSyncResult = await this.syncTeamData(userId, team);
                    syncResult.teams.push(teamSyncResult);
                    syncResult.totalTasks += teamSyncResult.taskCount;
                    syncResult.totalMembers += teamSyncResult.memberCount;
                } catch (error) {
                    syncResult.errors.push({
                        team: team.id,
                        error: error.message
                    });
                }
                
                currentProgress += teamProgress;
            }

            updateProgress('finalize', 90, 'Finalizing sync...');
            await this.storeSyncResult(userId, syncResult);

            updateProgress('complete', 100, 'Sync completed successfully!');
            return syncResult;

        } catch (error) {
            updateProgress('error', 0, `Sync failed: ${error.message}`);
            throw error;
        }
    }
}

module.exports = DataSyncService;