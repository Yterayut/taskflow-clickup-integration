const axios = require('axios');
const { DemoClickUpService } = require('../demo_clickup_service');

class RealClickUpSyncService {
    constructor(database, config) {
        this.db = database;
        this.config = config;
        this.syncIntervals = {
            high: 2 * 60 * 1000,    // 2 minutes - tasks, status
            medium: 10 * 60 * 1000,  // 10 minutes - projects, lists
            low: 60 * 60 * 1000     // 60 minutes - archives, users
        };
        this.syncRunning = false;
        this.lastSyncTimes = {};
        this.accessToken = null;
        this.demoService = new DemoClickUpService();
        this.useDemoMode = false;
    }

    // 🔑 Initialize ClickUp API Access Token
    setAccessToken(token) {
        this.accessToken = token;
        console.log(`[${new Date().toISOString()}] ✅ ClickUp access token set for real data sync`);
    }

    // 🚀 Start Real Background Sync Service
    startRealTimeSync() {
        if (!this.accessToken) {
            console.warn(`[${new Date().toISOString()}] ⚠️ No ClickUp access token - using sample data`);
            return false;
        }

        console.log(`[${new Date().toISOString()}] 🚀 Starting Real ClickUp Background Sync Service...`);
        
        // High Priority Sync - Every 2 minutes
        setInterval(() => this.syncHighPriorityData(), this.syncIntervals.high);
        
        // Medium Priority Sync - Every 10 minutes  
        setInterval(() => this.syncMediumPriorityData(), this.syncIntervals.medium);
        
        // Low Priority Sync - Every 60 minutes
        setInterval(() => this.syncLowPriorityData(), this.syncIntervals.low);

        // Initial sync
        this.performFullSync();
        
        return true;
    }

    // 🎯 High Priority Sync - Tasks & Status Updates
    async syncHighPriorityData() {
        if (!this.accessToken || this.syncRunning) return;
        
        try {
            this.syncRunning = true;
            console.log(`[${new Date().toISOString()}] ⚡ Syncing high priority data...`);
            
            const teams = await this.getClickUpTeams();
            if (teams && teams.length > 0) {
                for (const team of teams) {
                    await this.syncTeamTasks(team.id);
                    await this.syncTaskStatuses(team.id);
                }
            }
            
            this.lastSyncTimes.high = new Date().toISOString();
            console.log(`[${new Date().toISOString()}] ✅ High priority sync completed`);
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ High priority sync error:`, error.message);
        } finally {
            this.syncRunning = false;
        }
    }

    // 📊 Medium Priority Sync - Projects & Lists
    async syncMediumPriorityData() {
        if (!this.accessToken || this.syncRunning) return;
        
        try {
            console.log(`[${new Date().toISOString()}] 📊 Syncing medium priority data...`);
            
            const teams = await this.getClickUpTeams();
            if (teams && teams.length > 0) {
                for (const team of teams) {
                    await this.syncSpaces(team.id);
                    await this.syncLists(team.id);
                }
            }
            
            this.lastSyncTimes.medium = new Date().toISOString();
            console.log(`[${new Date().toISOString()}] ✅ Medium priority sync completed`);
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Medium priority sync error:`, error.message);
        }
    }

    // 👥 Low Priority Sync - Team Members & Archives
    async syncLowPriorityData() {
        if (!this.accessToken || this.syncRunning) return;
        
        try {
            console.log(`[${new Date().toISOString()}] 👥 Syncing low priority data...`);
            
            const teams = await this.getClickUpTeams();
            if (teams && teams.length > 0) {
                for (const team of teams) {
                    await this.syncTeamMembers(team.id);
                }
            }
            
            this.lastSyncTimes.low = new Date().toISOString();
            console.log(`[${new Date().toISOString()}] ✅ Low priority sync completed`);
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Low priority sync error:`, error.message);
        }
    }

    // 🔄 Full Sync - Initial Data Load
    async performFullSync() {
        if (!this.accessToken) {
            console.log(`[${new Date().toISOString()}] ⚠️ No access token - skipping full sync`);
            return;
        }
        
        try {
            console.log(`[${new Date().toISOString()}] 🔄 Performing full ClickUp data sync...`);
            
            await this.syncHighPriorityData();
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
            
            await this.syncMediumPriorityData();
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await this.syncLowPriorityData();
            
            console.log(`[${new Date().toISOString()}] 🎉 Full sync completed successfully`);
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Full sync error:`, error.message);
        }
    }

    // 🏢 Get ClickUp Teams
    async getClickUpTeams() {
        try {
            const response = await axios.get(`${this.config.BASE_URL}/team`, {
                headers: { 'Authorization': this.accessToken }
            });
            
            const teams = response.data.teams || [];
            console.log(`[${new Date().toISOString()}] 📊 Found ${teams.length} teams`);
            
            // Store teams in database
            for (const team of teams) {
                await this.storeTeam(team);
            }
            
            return teams;
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error fetching teams:`, error.message);
            return [];
        }
    }

    // 🎯 Sync Team Tasks with Subtasks
    async syncTeamTasks(teamId) {
        try {
            // Get spaces for team
            const spacesResponse = await axios.get(`${this.config.BASE_URL}/team/${teamId}/space`, {
                headers: { 'Authorization': this.accessToken }
            });
            
            const spaces = spacesResponse.data.spaces || [];
            let totalTasks = 0;
            let totalSubtasks = 0;
            
            for (const space of spaces) {
                // Get lists for space
                const listsResponse = await axios.get(`${this.config.BASE_URL}/space/${space.id}/list`, {
                    headers: { 'Authorization': this.accessToken }
                });
                
                const lists = listsResponse.data.lists || [];
                
                for (const list of lists) {
                    // Get tasks for list
                    const tasksResponse = await axios.get(`${this.config.BASE_URL}/list/${list.id}/task`, {
                        headers: { 'Authorization': this.accessToken },
                        params: {
                            include_closed: true,
                            subtasks: true
                        }
                    });
                    
                    const tasks = tasksResponse.data.tasks || [];
                    
                    for (const task of tasks) {
                        await this.storeTask(task);
                        totalTasks++;
                        
                        // Count and store subtasks
                        if (task.subtasks && task.subtasks.length > 0) {
                            for (const subtask of task.subtasks) {
                                await this.storeTask(subtask, task.id); // Store with parent_id
                                totalSubtasks++;
                            }
                        }
                    }
                }
            }
            
            console.log(`[${new Date().toISOString()}] 📋 Synced ${totalTasks} tasks and ${totalSubtasks} subtasks for team ${teamId}`);
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error syncing team tasks:`, error.message);
        }
    }

    // 💾 Store Team in Database
    async storeTeam(team) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO clickup_teams (id, name, color, avatar, members, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);
            
            stmt.run(
                team.id,
                team.name,
                team.color || '#2563eb',
                team.avatar || null,
                JSON.stringify(team.members || [])
            );
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error storing team:`, error.message);
        }
    }

    // 💾 Store Task in Database (with parent_id for subtasks)
    async storeTask(task, parentId = null) {
        try {
            // Add parent_id column if not exists (for subtasks)
            try {
                this.db.prepare(`ALTER TABLE clickup_tasks ADD COLUMN parent_id TEXT`).run();
            } catch (e) {
                // Column already exists
            }
            
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO clickup_tasks 
                (id, list_id, name, description, status, priority, assignees, due_date, 
                 time_estimate, time_spent, custom_fields, tags, parent_id, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);
            
            stmt.run(
                task.id,
                task.list?.id || 'unknown',
                task.name,
                task.description || '',
                task.status?.status || 'unknown',
                task.priority?.id || 0,
                JSON.stringify(task.assignees || []),
                task.due_date ? new Date(parseInt(task.due_date)).toISOString() : null,
                task.time_estimate || 0,
                task.time_spent || 0,
                JSON.stringify(task.custom_fields || {}),
                JSON.stringify(task.tags || []),
                parentId // For subtasks
            );
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error storing task:`, error.message);
        }
    }

    // 🔄 Sync Task Status Updates
    async syncTaskStatuses(teamId) {
        try {
            // Get recently updated tasks (last 24 hours)
            const yesterday = Date.now() - (24 * 60 * 60 * 1000);
            
            const spacesResponse = await axios.get(`${this.config.BASE_URL}/team/${teamId}/space`, {
                headers: { 'Authorization': this.accessToken }
            });
            
            const spaces = spacesResponse.data.spaces || [];
            let statusUpdates = 0;
            
            for (const space of spaces) {
                const listsResponse = await axios.get(`${this.config.BASE_URL}/space/${space.id}/list`, {
                    headers: { 'Authorization': this.accessToken }
                });
                
                const lists = listsResponse.data.lists || [];
                
                for (const list of lists) {
                    const tasksResponse = await axios.get(`${this.config.BASE_URL}/list/${list.id}/task`, {
                        headers: { 'Authorization': this.accessToken },
                        params: {
                            date_updated_gt: yesterday,
                            include_closed: true
                        }
                    });
                    
                    const tasks = tasksResponse.data.tasks || [];
                    
                    for (const task of tasks) {
                        await this.updateTaskStatus(task);
                        statusUpdates++;
                    }
                }
            }
            
            console.log(`[${new Date().toISOString()}] 🔄 Updated ${statusUpdates} task statuses for team ${teamId}`);
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error syncing task statuses:`, error.message);
        }
    }

    // 📊 Update Task Status in Database
    async updateTaskStatus(task) {
        try {
            const stmt = this.db.prepare(`
                UPDATE clickup_tasks 
                SET status = ?, time_spent = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            
            stmt.run(
                task.status?.status || 'unknown',
                task.time_spent || 0,
                task.id
            );
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error updating task status:`, error.message);
        }
    }

    // 🏢 Sync Spaces
    async syncSpaces(teamId) {
        try {
            const response = await axios.get(`${this.config.BASE_URL}/team/${teamId}/space`, {
                headers: { 'Authorization': this.accessToken }
            });
            
            const spaces = response.data.spaces || [];
            
            for (const space of spaces) {
                await this.storeSpace(space, teamId);
            }
            
            console.log(`[${new Date().toISOString()}] 🏢 Synced ${spaces.length} spaces for team ${teamId}`);
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error syncing spaces:`, error.message);
        }
    }

    // 💾 Store Space in Database
    async storeSpace(space, teamId) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO clickup_spaces (id, team_id, name, color, private, statuses, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);
            
            stmt.run(
                space.id,
                teamId,
                space.name,
                space.color || '#10b981',
                space.private || false,
                JSON.stringify(space.statuses || [])
            );
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error storing space:`, error.message);
        }
    }

    // 📋 Sync Lists
    async syncLists(teamId) {
        try {
            const spacesResponse = await axios.get(`${this.config.BASE_URL}/team/${teamId}/space`, {
                headers: { 'Authorization': this.accessToken }
            });
            
            const spaces = spacesResponse.data.spaces || [];
            let totalLists = 0;
            
            for (const space of spaces) {
                const listsResponse = await axios.get(`${this.config.BASE_URL}/space/${space.id}/list`, {
                    headers: { 'Authorization': this.accessToken }
                });
                
                const lists = listsResponse.data.lists || [];
                
                for (const list of lists) {
                    await this.storeList(list, space.id);
                    totalLists++;
                }
            }
            
            console.log(`[${new Date().toISOString()}] 📋 Synced ${totalLists} lists for team ${teamId}`);
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error syncing lists:`, error.message);
        }
    }

    // 💾 Store List in Database
    async storeList(list, spaceId) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO clickup_lists (id, space_id, name, status, task_count, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);
            
            stmt.run(
                list.id,
                spaceId,
                list.name,
                list.status || 'active',
                list.task_count || 0
            );
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error storing list:`, error.message);
        }
    }

    // 👥 Sync Team Members
    async syncTeamMembers(teamId) {
        try {
            const response = await axios.get(`${this.config.BASE_URL}/team/${teamId}`, {
                headers: { 'Authorization': this.accessToken }
            });
            
            const team = response.data.team;
            const members = team?.members || [];
            
            for (const member of members) {
                await this.storeMember(member, teamId);
            }
            
            console.log(`[${new Date().toISOString()}] 👥 Synced ${members.length} members for team ${teamId}`);
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error syncing team members:`, error.message);
        }
    }

    // 💾 Store Member in Database
    async storeMember(member, teamId) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO clickup_members 
                (id, team_id, username, email, color, profile_picture, initials, role, is_active, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);
            
            stmt.run(
                member.user?.id || member.id,
                teamId,
                member.user?.username || member.username,
                member.user?.email || member.email,
                member.user?.color || '#6366f1',
                member.user?.profilePicture || null,
                member.user?.initials || '',
                member.role || 3,
                true
            );
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error storing member:`, error.message);
        }
    }

    // 📊 Get Real Data Statistics
    async getRealDataStats() {
        try {
            const stats = {
                teams: this.db.prepare('SELECT COUNT(*) as count FROM clickup_teams').get().count,
                spaces: this.db.prepare('SELECT COUNT(*) as count FROM clickup_spaces').get().count,
                lists: this.db.prepare('SELECT COUNT(*) as count FROM clickup_lists').get().count,
                tasks: this.db.prepare('SELECT COUNT(*) as count FROM clickup_tasks WHERE parent_id IS NULL').get().count,
                subtasks: this.db.prepare('SELECT COUNT(*) as count FROM clickup_tasks WHERE parent_id IS NOT NULL').get().count,
                members: this.db.prepare('SELECT COUNT(*) as count FROM clickup_members').get().count,
                lastSync: this.lastSyncTimes,
                hasAccessToken: !!this.accessToken
            };
            
            return stats;
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error getting data stats:`, error.message);
            return { error: error.message };
        }
    }
}

module.exports = { RealClickUpSyncService };