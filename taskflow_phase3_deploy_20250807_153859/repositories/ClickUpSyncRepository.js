/**
 * ClickUp Sync Repository
 * Handles database operations for ClickUp sync data
 */
const path = require('path');
const fs = require('fs').promises;

class ClickUpSyncRepository {
    constructor(dbClient) {
        this.db = dbClient;
        this.initialized = false;
    }

    /**
     * Initialize and setup database schema if needed
     */
    async initialize() {
        if (this.initialized) return;

        try {
            await this.setupDatabaseSchema();
            this.initialized = true;
            console.log('✅ ClickUpSyncRepository initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize ClickUpSyncRepository:', error);
            throw error;
        }
    }

    /**
     * Setup database schema (auto-create tables if they don't exist)
     */
    async setupDatabaseSchema() {
        try {
            // Check if clickup_sync_metadata table exists
            const tableCheck = await this.db.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'clickup_sync_metadata'
            `);

            if (tableCheck.rows.length === 0) {
                console.log('🔄 ClickUp sync tables not found, creating schema...');
                
                // Read and execute schema file
                const schemaPath = path.join(__dirname, '../../database/clickup_sync_schema.sql');
                const schema = await fs.readFile(schemaPath, 'utf8');
                
                await this.db.query(schema);
                console.log('✅ ClickUp sync database schema created successfully');
            } else {
                console.log('✅ ClickUp sync tables already exist');
            }
        } catch (error) {
            console.error('❌ Failed to setup database schema:', error);
            throw error;
        }
    }

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    // =====================
    // SYNC METADATA OPERATIONS
    // =====================

    async getSyncMetadata() {
        const query = `
            SELECT * FROM clickup_sync_metadata 
            ORDER BY created_at DESC 
            LIMIT 1
        `;
        const result = await this.db.query(query);
        return result.rows[0] || null;
    }

    async updateSyncMetadata(metadata) {
        const query = `
            UPDATE clickup_sync_metadata 
            SET 
                last_full_sync = $1,
                last_incremental_sync = $2,
                sync_status = $3,
                sync_errors = $4,
                total_teams = $5,
                total_spaces = $6,
                total_tasks = $7,
                total_members = $8,
                updated_at = NOW()
            WHERE id = (SELECT id FROM clickup_sync_metadata ORDER BY created_at DESC LIMIT 1)
            RETURNING *
        `;
        const values = [
            metadata.last_full_sync,
            metadata.last_incremental_sync,
            metadata.sync_status,
            JSON.stringify(metadata.sync_errors || {}),
            metadata.total_teams,
            metadata.total_spaces,
            metadata.total_tasks,
            metadata.total_members
        ];
        const result = await this.db.query(query, values);
        return result.rows[0];
    }

    // =====================
    // TEAMS OPERATIONS
    // =====================

    async upsertTeam(teamData) {
        const query = `
            INSERT INTO clickup_teams (
                id, name, color, avatar_url, member_count,
                clickup_created_at, clickup_updated_at, last_synced
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                color = EXCLUDED.color,
                avatar_url = EXCLUDED.avatar_url,
                member_count = EXCLUDED.member_count,
                clickup_updated_at = EXCLUDED.clickup_updated_at,
                last_synced = NOW(),
                updated_at = NOW()
            RETURNING *
        `;
        const values = [
            teamData.id,
            teamData.name,
            teamData.color,
            teamData.avatar,
            teamData.members?.length || 0,
            teamData.clickup_created_at,
            teamData.clickup_updated_at
        ];
        const result = await this.db.query(query, values);
        return result.rows[0];
    }

    async getTeams() {
        const query = `
            SELECT * FROM clickup_teams 
            WHERE is_active = true 
            ORDER BY name
        `;
        const result = await this.db.query(query);
        return result.rows;
    }

    // =====================
    // SPACES OPERATIONS
    // =====================

    async upsertSpace(spaceData) {
        const query = `
            INSERT INTO clickup_spaces (
                id, team_id, name, color, avatar_url, private, archived,
                multiple_assignees, features, statuses, 
                clickup_created_at, clickup_updated_at, last_synced
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                color = EXCLUDED.color,
                avatar_url = EXCLUDED.avatar_url,
                private = EXCLUDED.private,
                archived = EXCLUDED.archived,
                multiple_assignees = EXCLUDED.multiple_assignees,
                features = EXCLUDED.features,
                statuses = EXCLUDED.statuses,
                clickup_updated_at = EXCLUDED.clickup_updated_at,
                last_synced = NOW(),
                updated_at = NOW()
            RETURNING *
        `;
        const values = [
            spaceData.id,
            spaceData.team_id,
            spaceData.name,
            spaceData.color,
            spaceData.avatar,
            spaceData.private,
            spaceData.archived,
            spaceData.multiple_assignees,
            JSON.stringify(spaceData.features || {}),
            JSON.stringify(spaceData.statuses || []),
            spaceData.clickup_created_at,
            spaceData.clickup_updated_at
        ];
        const result = await this.db.query(query, values);
        return result.rows[0];
    }

    async getSpaces(teamId = null) {
        let query = `
            SELECT * FROM clickup_spaces 
            WHERE is_active = true
        `;
        let values = [];
        
        if (teamId) {
            query += ` AND team_id = $1`;
            values.push(teamId);
        }
        
        query += ` ORDER BY name`;
        
        const result = await this.db.query(query, values);
        return result.rows;
    }

    // =====================
    // LISTS OPERATIONS
    // =====================

    async upsertList(listData) {
        const query = `
            INSERT INTO clickup_lists (
                id, space_id, folder_id, name, color, orderindex,
                archived, permission_level, task_count,
                clickup_created_at, clickup_updated_at, last_synced
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                color = EXCLUDED.color,
                orderindex = EXCLUDED.orderindex,
                archived = EXCLUDED.archived,
                permission_level = EXCLUDED.permission_level,
                task_count = EXCLUDED.task_count,
                clickup_updated_at = EXCLUDED.clickup_updated_at,
                last_synced = NOW(),
                updated_at = NOW()
            RETURNING *
        `;
        const values = [
            listData.id,
            listData.space_id,
            listData.folder_id,
            listData.name,
            listData.color,
            listData.orderindex,
            listData.archived,
            listData.permission_level,
            listData.task_count || 0,
            listData.clickup_created_at,
            listData.clickup_updated_at
        ];
        const result = await this.db.query(query, values);
        return result.rows[0];
    }

    async getLists(spaceId = null) {
        let query = `
            SELECT * FROM clickup_lists 
            WHERE archived = false
        `;
        let values = [];
        
        if (spaceId) {
            query += ` AND space_id = $1`;
            values.push(spaceId);
        }
        
        query += ` ORDER BY orderindex, name`;
        
        const result = await this.db.query(query, values);
        return result.rows;
    }

    // =====================
    // TASKS OPERATIONS
    // =====================

    async upsertTask(taskData) {
        const query = `
            INSERT INTO clickup_tasks (
                id, list_id, parent_id, name, description,
                status_id, status_name, status_color, status_type,
                priority_id, priority_name, priority_color,
                assignee_ids, watcher_ids, creator_id, orderindex,
                archived, date_created, date_updated, date_closed, date_done,
                due_date, start_date, time_estimate, time_spent, points,
                url, custom_fields, tags, dependencies, linked_tasks,
                is_subtask, last_synced
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
                $29, $30, $31, $32, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                status_id = EXCLUDED.status_id,
                status_name = EXCLUDED.status_name,
                status_color = EXCLUDED.status_color,
                status_type = EXCLUDED.status_type,
                priority_id = EXCLUDED.priority_id,
                priority_name = EXCLUDED.priority_name,
                priority_color = EXCLUDED.priority_color,
                assignee_ids = EXCLUDED.assignee_ids,
                watcher_ids = EXCLUDED.watcher_ids,
                orderindex = EXCLUDED.orderindex,
                archived = EXCLUDED.archived,
                date_updated = EXCLUDED.date_updated,
                date_closed = EXCLUDED.date_closed,
                date_done = EXCLUDED.date_done,
                due_date = EXCLUDED.due_date,
                start_date = EXCLUDED.start_date,
                time_estimate = EXCLUDED.time_estimate,
                time_spent = EXCLUDED.time_spent,
                points = EXCLUDED.points,
                custom_fields = EXCLUDED.custom_fields,
                tags = EXCLUDED.tags,
                dependencies = EXCLUDED.dependencies,
                linked_tasks = EXCLUDED.linked_tasks,
                is_subtask = EXCLUDED.is_subtask,
                last_synced = NOW(),
                updated_at = NOW()
            RETURNING *
        `;

        // Safe bigint conversion helper
        const toBigInt = (value) => {
            if (!value) return null;
            try {
                // Handle string with excessive decimal precision
                const stringValue = String(value);
                if (stringValue.includes('.')) {
                    // Remove excessive decimal precision
                    const numValue = Math.floor(parseFloat(stringValue));
                    return isNaN(numValue) ? null : numValue;
                } else {
                    const numValue = parseInt(stringValue);
                    return isNaN(numValue) ? null : numValue;
                }
            } catch (error) {
                console.warn(`Error converting to bigint: ${value}`, error);
                return null;
            }
        };

        // Comprehensive timestamp conversion helper
        const toPostgresTimestamp = (value) => {
            if (!value) return null;
            
            try {
                // If it's already a valid ISO string, use it
                if (typeof value === 'string' && value.includes('T') && value.includes('Z')) {
                    return value;
                }
                
                // Convert numeric timestamp to PostgreSQL format
                const timestampNum = parseInt(value);
                if (isNaN(timestampNum)) return null;
                
                // Safety checks for reasonable timestamp range
                const maxSafeTimestamp = 32503680000000; // Year 3000
                const minSafeTimestamp = 946684800000;   // Year 2000
                
                if (timestampNum > maxSafeTimestamp || timestampNum < minSafeTimestamp) {
                    console.warn(`Timestamp out of safe range: ${value}, using current time`);
                    return new Date().toISOString();
                }
                
                if (timestampNum > 1000000000000) {
                    // Milliseconds since epoch
                    return new Date(timestampNum).toISOString();
                } else if (timestampNum > 1000000000) {
                    // Seconds since epoch
                    return new Date(timestampNum * 1000).toISOString();
                }
                
                return new Date().toISOString(); // Fallback
            } catch (error) {
                console.warn(`Error converting timestamp ${value}:`, error.message);
                return new Date().toISOString();
            }
        };

        const values = [
            taskData.id,
            taskData.list?.id,
            taskData.parent,
            taskData.name,
            taskData.description,
            taskData.status?.id,
            taskData.status?.status,
            taskData.status?.color,
            taskData.status?.type,
            taskData.priority?.id,
            taskData.priority?.priority,
            taskData.priority?.color,
            taskData.assignees?.map(a => a.id) || [],
            taskData.watchers?.map(w => w.id) || [],
            taskData.creator?.id,
            toBigInt(taskData.orderindex),    // Fix: orderindex needs bigint conversion too
            taskData.archived,
            toPostgresTimestamp(taskData.clickup_date_created || taskData.date_created),
            toPostgresTimestamp(taskData.clickup_date_updated || taskData.date_updated),
            toPostgresTimestamp(taskData.clickup_date_closed || taskData.date_closed),
            toPostgresTimestamp(taskData.date_done),
            toPostgresTimestamp(taskData.due_date),
            toPostgresTimestamp(taskData.start_date),
            toBigInt(taskData.time_estimate),  // Safe bigint conversion
            toBigInt(taskData.time_spent),     // Safe bigint conversion
            taskData.points,
            taskData.url,
            JSON.stringify(taskData.custom_fields || []),
            taskData.tags || [],
            JSON.stringify(taskData.dependencies || []),
            JSON.stringify(taskData.linked_tasks || []),
            !!taskData.parent
        ];

        const result = await this.db.query(query, values);
        return result.rows[0];
    }

    async getTasks(filters = {}) {
        let query = `
            SELECT t.*, l.name as list_name, s.name as space_name 
            FROM clickup_tasks t
            LEFT JOIN clickup_lists l ON t.list_id = l.id
            LEFT JOIN clickup_spaces s ON l.space_id = s.id
            WHERE t.archived = false
        `;
        let values = [];
        let paramCount = 0;

        if (filters.listId) {
            query += ` AND t.list_id = $${++paramCount}`;
            values.push(filters.listId);
        }

        if (filters.status) {
            query += ` AND t.status_name = $${++paramCount}`;
            values.push(filters.status);
        }

        if (filters.assigneeId) {
            query += ` AND $${++paramCount} = ANY(t.assignee_ids)`;
            values.push(filters.assigneeId);
        }

        if (filters.isSubtask !== undefined) {
            query += ` AND t.is_subtask = $${++paramCount}`;
            values.push(filters.isSubtask);
        }

        query += ` ORDER BY t.orderindex, t.date_created DESC`;

        const result = await this.db.query(query, values);
        return result.rows;
    }

    // =====================
    // MEMBERS OPERATIONS
    // =====================

    async upsertMember(memberData) {
        const query = `
            INSERT INTO clickup_members (
                id, username, email, color, profile_picture, initials,
                role_id, role_name, last_active, date_joined, date_invited,
                invited_by_id, is_active, last_synced
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
            ON CONFLICT (id) DO UPDATE SET
                username = EXCLUDED.username,
                email = EXCLUDED.email,
                color = EXCLUDED.color,
                profile_picture = EXCLUDED.profile_picture,
                initials = EXCLUDED.initials,
                role_id = EXCLUDED.role_id,
                role_name = EXCLUDED.role_name,
                last_active = EXCLUDED.last_active,
                is_active = EXCLUDED.is_active,
                last_synced = NOW(),
                updated_at = NOW()
            RETURNING *
        `;
        const values = [
            memberData.id,
            memberData.username,
            memberData.email,
            memberData.color,
            memberData.profilePicture,
            memberData.initials,
            memberData.role,
            memberData.role_key,
            memberData.last_active,
            memberData.date_joined,
            memberData.date_invited,
            memberData.invited_by?.id,
            memberData.status === 'active'
        ];
        const result = await this.db.query(query, values);
        return result.rows[0];
    }

    async getMembers(teamId = null) {
        let query = `
            SELECT m.*, tm.role_key, tm.custom_role 
            FROM clickup_members m
        `;
        let values = [];
        
        if (teamId) {
            query += `
                LEFT JOIN clickup_team_members tm ON m.id = tm.member_id
                WHERE tm.team_id = $1 AND m.is_active = true
            `;
            values.push(teamId);
        } else {
            query += ` WHERE m.is_active = true`;
        }
        
        query += ` ORDER BY m.username`;
        
        const result = await this.db.query(query, values);
        return result.rows;
    }

    // =====================
    // SYNC JOBS OPERATIONS
    // =====================

    async createSyncJob(jobType, payload = {}, priority = 5) {
        const query = `
            INSERT INTO clickup_sync_jobs (job_type, payload, priority)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        const values = [jobType, JSON.stringify(payload), priority];
        const result = await this.db.query(query, values);
        return result.rows[0];
    }

    async getNextSyncJob() {
        const query = `
            SELECT * FROM clickup_sync_jobs 
            WHERE status = 'pending' 
            AND scheduled_at <= NOW()
            ORDER BY priority ASC, scheduled_at ASC
            LIMIT 1
        `;
        const result = await this.db.query(query);
        return result.rows[0] || null;
    }

    async updateSyncJob(jobId, updates) {
        const query = `
            UPDATE clickup_sync_jobs 
            SET 
                status = COALESCE($2, status),
                started_at = COALESCE($3, started_at),
                completed_at = COALESCE($4, completed_at),
                error_message = COALESCE($5, error_message),
                attempts = COALESCE($6, attempts),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `;
        const values = [
            jobId,
            updates.status,
            updates.started_at,
            updates.completed_at,
            updates.error_message,
            updates.attempts
        ];
        const result = await this.db.query(query, values);
        return result.rows[0];
    }

    // =====================
    // DASHBOARD DATA OPERATIONS
    // =====================

    async getDashboardData() {
        await this.ensureInitialized();
        
        const startTime = Date.now();
        
        try {
            // Get teams with member count - ClickUp format
            const teamsQuery = `
                SELECT t.id, t.name, t.color, t.avatar_url as avatar, 
                       t.member_count, t.clickup_created_at as date_created,
                       t.clickup_updated_at as date_updated,
                       COALESCE(
                           (SELECT json_agg(
                               json_build_object(
                                   'id', m.id,
                                   'username', m.username,
                                   'email', m.email,
                                   'color', m.color,
                                   'initials', m.initials,
                                   'profilePicture', m.profile_picture_url
                               )
                           )
                           FROM clickup_members m 
                           INNER JOIN clickup_team_members tm ON m.id = tm.member_id 
                           WHERE tm.team_id = t.id AND tm.is_active = true),
                           '[]'::json
                       ) as members
                FROM clickup_teams t
                WHERE t.is_active = true
                ORDER BY t.name
            `;

            // Get spaces - ClickUp format
            const spacesQuery = `
                SELECT s.id, s.name, s.color, s.avatar_url as avatar,
                       s.private, s.clickup_created_at as date_created,
                       s.clickup_updated_at as date_updated,
                       json_build_object('id', s.team_id) as team,
                       COALESCE(
                           (SELECT json_agg(
                               json_build_object(
                                   'id', l.id,
                                   'name', l.name,
                                   'color', l.color,
                                   'orderindex', l.priority,
                                   'task_count', l.task_count
                               )
                           )
                           FROM clickup_lists l 
                           WHERE l.space_id = s.id AND l.is_active = true),
                           '[]'::json
                       ) as lists
                FROM clickup_spaces s
                WHERE s.is_active = true
                ORDER BY s.name
            `;

            // Get tasks - ClickUp format
            const tasksQuery = `
                SELECT t.id, t.name, t.description,
                       json_build_object(
                           'id', t.status_name,
                           'status', t.status_name,
                           'color', t.status_color,
                           'type', t.status_type
                       ) as status,
                       json_build_object(
                           'id', t.priority_id,
                           'priority', t.priority_name,
                           'color', t.priority_color
                       ) as priority,
                       json_build_object('id', t.list_id) as list,
                       json_build_object('id', t.space_id) as space,
                       t.due_date,
                       t.start_date,
                       t.time_estimate,
                       t.time_spent,
                       t.url,
                       t.custom_id,
                       t.archived,
                       t.clickup_date_created as date_created,
                       t.clickup_date_updated as date_updated,
                       t.clickup_date_closed as date_closed,
                       t.parent_id as parent,
                       COALESCE(
                           (SELECT json_agg(
                               json_build_object(
                                   'id', m.id,
                                   'username', m.username,
                                   'email', m.email,
                                   'color', m.color,
                                   'initials', m.initials,
                                   'profilePicture', m.profile_picture_url
                               )
                           )
                           FROM clickup_task_assignees ta
                           INNER JOIN clickup_members m ON ta.member_id = m.id
                           WHERE ta.task_id = t.id),
                           '[]'::json
                       ) as assignees
                FROM clickup_tasks t
                WHERE t.is_active = true
                ORDER BY t.clickup_date_updated DESC
                LIMIT 1000
            `;

            // Get sync metadata for data freshness
            const syncQuery = `
                SELECT * FROM clickup_sync_metadata 
                ORDER BY created_at DESC 
                LIMIT 1
            `;

            const [teams, spaces, tasks, syncMeta] = await Promise.all([
                this.db.query(teamsQuery),
                this.db.query(spacesQuery),
                this.db.query(tasksQuery),
                this.db.query(syncQuery)
            ]);

            const responseTime = Date.now() - startTime;
            const metadata = syncMeta.rows[0];
            
            // Calculate data freshness
            const lastSync = metadata?.last_full_sync || metadata?.last_incremental_sync;
            const ageMinutes = lastSync ? Math.floor((Date.now() - new Date(lastSync).getTime()) / 60000) : null;

            return {
                teams: teams.rows,
                spaces: spaces.rows,
                tasks: tasks.rows,
                performance: {
                    response_time_ms: responseTime,
                    source: 'local_database',
                    cache_hit: false,
                    data_freshness: {
                        last_sync: lastSync,
                        age_minutes: ageMinutes,
                        is_fresh: ageMinutes ? ageMinutes < 60 : false,
                        sync_status: metadata?.sync_status || 'unknown'
                    }
                },
                sync_metadata: metadata,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Failed to get dashboard data from local database:', error);
            throw error;
        }
    }

    // =====================
    // HEALTH CHECK
    // =====================
    
    async healthCheck() {
        try {
            await this.ensureInitialized();
            
            const [tablesCheck, syncMeta] = await Promise.all([
                this.db.query(`
                    SELECT 
                        (SELECT COUNT(*) FROM clickup_teams WHERE is_active = true) as teams,
                        (SELECT COUNT(*) FROM clickup_spaces WHERE is_active = true) as spaces,
                        (SELECT COUNT(*) FROM clickup_tasks WHERE is_active = true) as tasks,
                        (SELECT COUNT(*) FROM clickup_members WHERE is_active = true) as members
                `),
                this.getSyncMetadata()
            ]);

            const counts = tablesCheck.rows[0];
            const hasData = parseInt(counts.tasks) > 0;

            return {
                status: 'healthy',
                database_connected: true,
                tables_exist: true,
                has_data: hasData,
                counts: counts,
                last_sync: syncMeta?.last_full_sync || syncMeta?.last_incremental_sync,
                sync_status: syncMeta?.sync_status || 'unknown'
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                database_connected: false
            };
        }
    }
}

module.exports = { ClickUpSyncRepository };