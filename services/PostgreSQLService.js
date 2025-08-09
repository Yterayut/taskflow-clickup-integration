const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class PostgreSQLService {
    constructor() {
        // PostgreSQL Connection Configuration
        this.config = {
            host: process.env.PG_HOST || 'localhost',
            port: process.env.PG_PORT || 5432,
            database: process.env.PG_DATABASE || 'taskflow_pro',
            user: process.env.PG_USER || 'postgres',
            password: process.env.PG_PASSWORD || 'taskflow123',
            // Production optimizations
            max: 20, // Maximum pool size
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
            // SSL for production (disable for local dev)
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        };

        this.pool = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            this.pool = new Pool(this.config);
            
            // Test connection
            const client = await this.pool.connect();
            const result = await client.query('SELECT NOW() as current_time');
            client.release();
            
            this.isConnected = true;
            console.log(`[${new Date().toISOString()}] ✅ PostgreSQL connected: ${this.config.host}:${this.config.port}/${this.config.database}`);
            console.log(`[${new Date().toISOString()}] 🔗 Connection pool: max ${this.config.max} connections`);
            
            return true;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ PostgreSQL connection failed:`, error.message);
            this.isConnected = false;
            return false;
        }
    }

    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            console.log(`[${new Date().toISOString()}] 🔌 PostgreSQL disconnected`);
        }
    }

    async query(text, params = []) {
        if (!this.isConnected || !this.pool) {
            throw new Error('Database not connected');
        }

        const start = Date.now();
        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            
            // Log slow queries (>100ms)
            if (duration > 100) {
                console.warn(`[${new Date().toISOString()}] 🐌 Slow query (${duration}ms): ${text.substring(0, 50)}...`);
            }
            
            return result;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Query error:`, error.message);
            console.error('Query:', text);
            console.error('Params:', params);
            throw error;
        }
    }

    async transaction(callback) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async migrate() {
        try {
            console.log(`[${new Date().toISOString()}] 🏗️ Running PostgreSQL migration...`);
            
            const migrationPath = path.join(__dirname, '../database/postgresql_migration.sql');
            const migration = fs.readFileSync(migrationPath, 'utf8');
            
            await this.query(migration);
            
            console.log(`[${new Date().toISOString()}] ✅ PostgreSQL migration completed successfully`);
            return true;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Migration failed:`, error.message);
            return false;
        }
    }

    async migrateDataFromSQLite(sqlitePath) {
        try {
            console.log(`[${new Date().toISOString()}] 🔄 Migrating data from SQLite...`);
            
            const Database = require('better-sqlite3');
            const sqlite = new Database(sqlitePath);
            
            // Migrate users
            const users = sqlite.prepare('SELECT * FROM users').all();
            for (const user of users) {
                await this.query(`
                    INSERT INTO users (email, name, password, role, permissions, is_active) 
                    VALUES ($1, $2, $3, $4, $5::jsonb, $6)
                    ON CONFLICT (email) DO UPDATE SET
                        name = EXCLUDED.name,
                        role = EXCLUDED.role,
                        permissions = EXCLUDED.permissions,
                        is_active = EXCLUDED.is_active,
                        updated_at = CURRENT_TIMESTAMP
                `, [user.email, user.name, user.password, user.role, user.permissions, user.is_active]);
            }

            // Migrate clickup_teams
            const teams = sqlite.prepare('SELECT * FROM clickup_teams').all();
            for (const team of teams) {
                await this.query(`
                    INSERT INTO clickup_teams (id, name, color, avatar, members) 
                    VALUES ($1, $2, $3, $4, $5::jsonb)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        color = EXCLUDED.color,
                        avatar = EXCLUDED.avatar,
                        members = EXCLUDED.members,
                        updated_at = CURRENT_TIMESTAMP
                `, [team.id, team.name, team.color, team.avatar, team.members]);
            }

            // Migrate clickup_spaces
            const spaces = sqlite.prepare('SELECT * FROM clickup_spaces').all();
            for (const space of spaces) {
                await this.query(`
                    INSERT INTO clickup_spaces (id, team_id, name, color, private, statuses) 
                    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
                    ON CONFLICT (id) DO UPDATE SET
                        team_id = EXCLUDED.team_id,
                        name = EXCLUDED.name,
                        color = EXCLUDED.color,
                        private = EXCLUDED.private,
                        statuses = EXCLUDED.statuses,
                        updated_at = CURRENT_TIMESTAMP
                `, [space.id, space.team_id, space.name, space.color, space.private, space.statuses]);
            }

            // Migrate clickup_lists
            const lists = sqlite.prepare('SELECT * FROM clickup_lists').all();
            for (const list of lists) {
                await this.query(`
                    INSERT INTO clickup_lists (id, space_id, name, status, task_count) 
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (id) DO UPDATE SET
                        space_id = EXCLUDED.space_id,
                        name = EXCLUDED.name,
                        status = EXCLUDED.status,
                        task_count = EXCLUDED.task_count,
                        updated_at = CURRENT_TIMESTAMP
                `, [list.id, list.space_id, list.name, list.status, list.task_count]);
            }

            // Migrate clickup_tasks
            const tasks = sqlite.prepare('SELECT * FROM clickup_tasks').all();
            for (const task of tasks) {
                await this.query(`
                    INSERT INTO clickup_tasks (id, list_id, parent_id, name, description, status, priority, assignees, due_date, time_estimate, time_spent, custom_fields, tags) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12::jsonb, $13::jsonb)
                    ON CONFLICT (id) DO UPDATE SET
                        list_id = EXCLUDED.list_id,
                        parent_id = EXCLUDED.parent_id,
                        name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        status = EXCLUDED.status,
                        priority = EXCLUDED.priority,
                        assignees = EXCLUDED.assignees,
                        due_date = EXCLUDED.due_date,
                        time_estimate = EXCLUDED.time_estimate,
                        time_spent = EXCLUDED.time_spent,
                        custom_fields = EXCLUDED.custom_fields,
                        tags = EXCLUDED.tags,
                        updated_at = CURRENT_TIMESTAMP
                `, [task.id, task.list_id, task.parent_id, task.name, task.description, task.status, task.priority, task.assignees, task.due_date, task.time_estimate, task.time_spent, task.custom_fields, task.tags]);
            }

            // Migrate clickup_members
            const members = sqlite.prepare('SELECT * FROM clickup_members').all();
            for (const member of members) {
                await this.query(`
                    INSERT INTO clickup_members (id, team_id, username, email, color, profile_picture, initials, role, is_active) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (id) DO UPDATE SET
                        team_id = EXCLUDED.team_id,
                        username = EXCLUDED.username,
                        email = EXCLUDED.email,
                        color = EXCLUDED.color,
                        profile_picture = EXCLUDED.profile_picture,
                        initials = EXCLUDED.initials,
                        role = EXCLUDED.role,
                        is_active = EXCLUDED.is_active,
                        updated_at = CURRENT_TIMESTAMP
                `, [member.id, member.team_id, member.username, member.email, member.color, member.profile_picture, member.initials, member.role, member.is_active]);
            }

            sqlite.close();

            console.log(`[${new Date().toISOString()}] ✅ Data migration from SQLite completed`);
            console.log(`[${new Date().toISOString()}] 📊 Migrated: ${users.length} users, ${teams.length} teams, ${tasks.length} tasks, ${members.length} members`);
            
            return true;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Data migration failed:`, error.message);
            return false;
        }
    }

    async getStats() {
        try {
            const stats = await this.query(`
                SELECT 
                    (SELECT COUNT(*) FROM users) as users,
                    (SELECT COUNT(*) FROM clickup_tasks) as tasks,
                    (SELECT COUNT(*) FROM clickup_members) as members,
                    (SELECT COUNT(*) FROM clickup_teams) as teams,
                    (SELECT COUNT(*) FROM clickup_spaces) as spaces,
                    (SELECT COUNT(*) FROM clickup_lists) as lists
            `);
            return stats.rows[0];
        } catch (error) {
            console.error('Stats query error:', error);
            return null;
        }
    }

    getHealthStatus() {
        return {
            connected: this.isConnected,
            database: this.config.database,
            host: this.config.host,
            port: this.config.port,
            poolSize: this.pool ? this.pool.totalCount : 0,
            activeConnections: this.pool ? this.pool.totalCount - this.pool.idleCount : 0
        };
    }
}

module.exports = { PostgreSQLService };