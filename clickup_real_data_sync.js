/**
 * ClickUp Real Data Sync Service
 * Syncs REAL DATA ONLY from ClickUp API to PostgreSQL
 * Uses optimized schema with proper task assignments and subtasks
 * No demo data, no fallbacks - real ClickUp data only
 */

const { Pool } = require('pg');

class ClickUpRealDataSync {
    constructor(clickUpToken, dbConfig) {
        this.clickUpToken = clickUpToken;
        this.baseUrl = 'https://api.clickup.com/api/v2';
        this.headers = {
            'Authorization': clickUpToken,
            'Content-Type': 'application/json'
        };
        
        // PostgreSQL connection
        this.db = new Pool(dbConfig);
        
        console.log(`[${new Date().toISOString()}] 🔄 ClickUp Real Data Sync Service initialized`);
    }

    /**
     * Fetch data from ClickUp API
     */
    async fetchClickUpData(endpoint) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                headers: this.headers
            });

            if (!response.ok) {
                throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ ClickUp API fetch error:`, error.message);
            throw error;
        }
    }

    /**
     * Sync Teams from ClickUp
     */
    async syncTeams() {
        try {
            console.log(`[${new Date().toISOString()}] 📊 Syncing teams from ClickUp...`);
            
            const data = await this.fetchClickUpData('/team');
            
            if (!data.teams || data.teams.length === 0) {
                console.log(`[${new Date().toISOString()}] ⚠️ No teams found in ClickUp`);
                return 0;
            }

            let syncedCount = 0;
            
            for (const team of data.teams) {
                await this.db.query(`
                    INSERT INTO clickup_teams (id, name, color, avatar, synced_at) 
                    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        color = EXCLUDED.color,
                        avatar = EXCLUDED.avatar,
                        updated_at = CURRENT_TIMESTAMP,
                        synced_at = CURRENT_TIMESTAMP
                `, [team.id, team.name, team.color, team.avatar]);
                
                syncedCount++;
            }

            console.log(`[${new Date().toISOString()}] ✅ Synced ${syncedCount} teams`);
            return syncedCount;
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Team sync error:`, error.message);
            return 0;
        }
    }

    /**
     * Sync Team Members from ClickUp
     */
    async syncMembers(teamId) {
        try {
            console.log(`[${new Date().toISOString()}] 👥 Syncing members for team ${teamId}...`);
            
            const data = await this.fetchClickUpData(`/team/${teamId}/user`);
            
            if (!data.members || data.members.length === 0) {
                console.log(`[${new Date().toISOString()}] ⚠️ No members found for team ${teamId}`);
                return 0;
            }

            let syncedCount = 0;
            
            for (const member of data.members) {
                const user = member.user;
                
                await this.db.query(`
                    INSERT INTO clickup_members (id, username, email, color, initials, profile_picture, role, is_active, team_id, synced_at) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
                    ON CONFLICT (id) DO UPDATE SET
                        username = EXCLUDED.username,
                        email = EXCLUDED.email,
                        color = EXCLUDED.color,
                        initials = EXCLUDED.initials,
                        profile_picture = EXCLUDED.profile_picture,
                        role = EXCLUDED.role,
                        is_active = EXCLUDED.is_active,
                        team_id = EXCLUDED.team_id,
                        updated_at = CURRENT_TIMESTAMP,
                        synced_at = CURRENT_TIMESTAMP
                `, [
                    user.id,
                    user.username,
                    user.email,
                    user.color,
                    user.initials,
                    user.profilePicture,
                    member.role,
                    true,
                    teamId
                ]);
                
                syncedCount++;
            }

            console.log(`[${new Date().toISOString()}] ✅ Synced ${syncedCount} members`);
            return syncedCount;
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Member sync error:`, error.message);
            return 0;
        }
    }

    /**
     * Sync Spaces from ClickUp
     */
    async syncSpaces(teamId) {
        try {
            console.log(`[${new Date().toISOString()}] 🏢 Syncing spaces for team ${teamId}...`);
            
            const data = await this.fetchClickUpData(`/team/${teamId}/space`);
            
            if (!data.spaces || data.spaces.length === 0) {
                console.log(`[${new Date().toISOString()}] ⚠️ No spaces found for team ${teamId}`);
                return 0;
            }

            let syncedCount = 0;
            
            for (const space of data.spaces) {
                await this.db.query(`
                    INSERT INTO clickup_spaces (id, name, color, private, avatar, team_id, statuses, features, synced_at) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        color = EXCLUDED.color,
                        private = EXCLUDED.private,
                        avatar = EXCLUDED.avatar,
                        team_id = EXCLUDED.team_id,
                        statuses = EXCLUDED.statuses,
                        features = EXCLUDED.features,
                        updated_at = CURRENT_TIMESTAMP,
                        synced_at = CURRENT_TIMESTAMP
                `, [
                    space.id,
                    space.name,
                    space.color,
                    space.private,
                    space.avatar,
                    teamId,
                    JSON.stringify(space.statuses),
                    JSON.stringify(space.features)
                ]);
                
                syncedCount++;
            }

            console.log(`[${new Date().toISOString()}] ✅ Synced ${syncedCount} spaces`);
            return syncedCount;
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Space sync error:`, error.message);
            return 0;
        }
    }

    /**
     * Sync Lists from ClickUp Space
     */
    async syncLists(spaceId) {
        try {
            console.log(`[${new Date().toISOString()}] 📋 Syncing lists for space ${spaceId}...`);
            
            const data = await this.fetchClickUpData(`/space/${spaceId}/list`);
            
            if (!data.lists || data.lists.length === 0) {
                console.log(`[${new Date().toISOString()}] ⚠️ No lists found for space ${spaceId}`);
                return 0;
            }

            let syncedCount = 0;
            
            for (const list of data.lists) {
                await this.db.query(`
                    INSERT INTO clickup_lists (id, name, orderindex, status, task_count, due_date, start_date, space_id, folder_id, folder_name, archived, permission_level, synced_at) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        orderindex = EXCLUDED.orderindex,
                        status = EXCLUDED.status,
                        task_count = EXCLUDED.task_count,
                        due_date = EXCLUDED.due_date,
                        start_date = EXCLUDED.start_date,
                        space_id = EXCLUDED.space_id,
                        folder_id = EXCLUDED.folder_id,
                        folder_name = EXCLUDED.folder_name,
                        archived = EXCLUDED.archived,
                        permission_level = EXCLUDED.permission_level,
                        updated_at = CURRENT_TIMESTAMP,
                        synced_at = CURRENT_TIMESTAMP
                `, [
                    list.id,
                    list.name,
                    list.orderindex,
                    list.status?.status,
                    list.task_count,
                    list.due_date,
                    list.start_date,
                    spaceId,
                    list.folder?.id,
                    list.folder?.name,
                    list.archived,
                    list.permission_level
                ]);
                
                syncedCount++;
            }

            console.log(`[${new Date().toISOString()}] ✅ Synced ${syncedCount} lists`);
            return syncedCount;
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ List sync error:`, error.message);
            return 0;
        }
    }

    /**
     * Sync Tasks from ClickUp (with subtasks and assignments)
     */
    async syncTasks(teamId) {
        try {
            console.log(`[${new Date().toISOString()}] 📝 Syncing tasks for team ${teamId}...`);
            
            // Get tasks with subtasks included
            const data = await this.fetchClickUpData(`/team/${teamId}/task?page=0&order_by=updated&reverse=true&include_closed=true&subtasks=true`);
            
            if (!data.tasks || data.tasks.length === 0) {
                console.log(`[${new Date().toISOString()}] ⚠️ No tasks found for team ${teamId}`);
                return { tasks: 0, assignments: 0 };
            }

            let tasksCount = 0;
            let assignmentsCount = 0;
            
            for (const task of data.tasks) {
                // Insert task
                await this.db.query(`
                    INSERT INTO clickup_tasks (
                        id, name, description, 
                        status_id, status_name, status_color, status_type, status_orderindex,
                        priority_id, priority_name, priority_color, priority_orderindex,
                        creator_id, parent,
                        team_id, space_id, list_id, list_name, folder_id, folder_name, space_name,
                        date_created, date_updated, date_closed, date_done, due_date, start_date,
                        time_estimate, time_spent, points, url, text_content,
                        watchers, tags, custom_fields, dependencies, linked_tasks,
                        archived, synced_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
                        $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, CURRENT_TIMESTAMP
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        status_id = EXCLUDED.status_id,
                        status_name = EXCLUDED.status_name,
                        status_color = EXCLUDED.status_color,
                        status_type = EXCLUDED.status_type,
                        status_orderindex = EXCLUDED.status_orderindex,
                        priority_id = EXCLUDED.priority_id,
                        priority_name = EXCLUDED.priority_name,
                        priority_color = EXCLUDED.priority_color,
                        priority_orderindex = EXCLUDED.priority_orderindex,
                        creator_id = EXCLUDED.creator_id,
                        parent = EXCLUDED.parent,
                        team_id = EXCLUDED.team_id,
                        space_id = EXCLUDED.space_id,
                        list_id = EXCLUDED.list_id,
                        list_name = EXCLUDED.list_name,
                        folder_id = EXCLUDED.folder_id,
                        folder_name = EXCLUDED.folder_name,
                        space_name = EXCLUDED.space_name,
                        date_created = EXCLUDED.date_created,
                        date_updated = EXCLUDED.date_updated,
                        date_closed = EXCLUDED.date_closed,
                        date_done = EXCLUDED.date_done,
                        due_date = EXCLUDED.due_date,
                        start_date = EXCLUDED.start_date,
                        time_estimate = EXCLUDED.time_estimate,
                        time_spent = EXCLUDED.time_spent,
                        points = EXCLUDED.points,
                        url = EXCLUDED.url,
                        text_content = EXCLUDED.text_content,
                        watchers = EXCLUDED.watchers,
                        tags = EXCLUDED.tags,
                        custom_fields = EXCLUDED.custom_fields,
                        dependencies = EXCLUDED.dependencies,
                        linked_tasks = EXCLUDED.linked_tasks,
                        archived = EXCLUDED.archived,
                        updated_at = CURRENT_TIMESTAMP,
                        synced_at = CURRENT_TIMESTAMP
                `, [
                    task.id,
                    task.name,
                    task.description,
                    task.status?.id,
                    task.status?.status,
                    task.status?.color,
                    task.status?.type,
                    task.status?.orderindex,
                    task.priority?.id,
                    task.priority?.priority,
                    task.priority?.color,
                    task.priority?.orderindex,
                    task.creator?.id,
                    task.parent,
                    teamId,
                    task.space?.id,
                    task.list?.id,
                    task.list?.name,
                    task.folder?.id,
                    task.folder?.name,
                    task.space?.name,
                    task.date_created,
                    task.date_updated,
                    task.date_closed,
                    task.date_done,
                    task.due_date,
                    task.start_date,
                    task.time_estimate,
                    task.time_spent,
                    task.points,
                    task.url,
                    task.text_content,
                    JSON.stringify(task.watchers),
                    JSON.stringify(task.tags),
                    JSON.stringify(task.custom_fields),
                    JSON.stringify(task.dependencies),
                    JSON.stringify(task.linked_tasks),
                    task.archived
                ]);

                tasksCount++;

                // Clear existing assignments for this task
                await this.db.query('DELETE FROM clickup_task_assignments WHERE task_id = $1', [task.id]);

                // Insert new assignments
                if (task.assignees && task.assignees.length > 0) {
                    for (const assignee of task.assignees) {
                        await this.db.query(`
                            INSERT INTO clickup_task_assignments (task_id, member_id, assigned_at) 
                            VALUES ($1, $2, CURRENT_TIMESTAMP)
                            ON CONFLICT (task_id, member_id) DO NOTHING
                        `, [task.id, assignee.id]);
                        
                        assignmentsCount++;
                    }
                }
            }

            console.log(`[${new Date().toISOString()}] ✅ Synced ${tasksCount} tasks with ${assignmentsCount} assignments`);
            return { tasks: tasksCount, assignments: assignmentsCount };
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Task sync error:`, error.message);
            return { tasks: 0, assignments: 0 };
        }
    }

    /**
     * Full sync - all ClickUp data
     */
    async fullSync() {
        const startTime = Date.now();
        console.log(`[${new Date().toISOString()}] 🚀 Starting full ClickUp sync...`);

        try {
            // 1. Sync teams first
            const teamsCount = await this.syncTeams();
            
            // Get team IDs from database
            const teamsResult = await this.db.query('SELECT id FROM clickup_teams WHERE synced_at >= NOW() - INTERVAL \'1 hour\'');
            
            let totalMembers = 0;
            let totalSpaces = 0;
            let totalLists = 0;
            let totalTasks = 0;
            let totalAssignments = 0;

            // 2. For each team, sync all related data
            for (const team of teamsResult.rows) {
                const teamId = team.id;
                
                // Sync members
                const membersCount = await this.syncMembers(teamId);
                totalMembers += membersCount;
                
                // Sync spaces
                const spacesCount = await this.syncSpaces(teamId);
                totalSpaces += spacesCount;
                
                // Get spaces for this team
                const spacesResult = await this.db.query('SELECT id FROM clickup_spaces WHERE team_id = $1', [teamId]);
                
                // Sync lists for each space
                for (const space of spacesResult.rows) {
                    const listsCount = await this.syncLists(space.id);
                    totalLists += listsCount;
                }
                
                // Sync tasks with assignments
                const taskResult = await this.syncTasks(teamId);
                totalTasks += taskResult.tasks;
                totalAssignments += taskResult.assignments;
            }

            const endTime = Date.now();
            const duration = Math.round((endTime - startTime) / 1000);

            console.log(`[${new Date().toISOString()}] ✅ Full sync completed in ${duration}s:`);
            console.log(`[${new Date().toISOString()}] 📊 Teams: ${teamsCount}`);
            console.log(`[${new Date().toISOString()}] 👥 Members: ${totalMembers}`);
            console.log(`[${new Date().toISOString()}] 🏢 Spaces: ${totalSpaces}`);
            console.log(`[${new Date().toISOString()}] 📋 Lists: ${totalLists}`);
            console.log(`[${new Date().toISOString()}] 📝 Tasks: ${totalTasks}`);
            console.log(`[${new Date().toISOString()}] 🎯 Assignments: ${totalAssignments}`);

            return {
                success: true,
                duration,
                counts: {
                    teams: teamsCount,
                    members: totalMembers,
                    spaces: totalSpaces,
                    lists: totalLists,
                    tasks: totalTasks,
                    assignments: totalAssignments
                }
            };

        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Full sync failed:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async close() {
        await this.db.end();
    }
}

module.exports = ClickUpRealDataSync;