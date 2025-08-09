// Migrate from SQLite to PostgreSQL Only
// Complete migration with optimized schema for real assignments
const Database = require('better-sqlite3');
const { Client } = require('pg');

async function migrateToPostgreSQL() {
    let sqliteDb;
    let pgClient;
    
    try {
        console.log('🚀 Starting SQLite → PostgreSQL migration...');
        
        // Connect to SQLite
        sqliteDb = new Database('taskflow.db');
        
        // Connect to PostgreSQL
        pgClient = new Client({
            host: 'localhost',
            database: 'taskflow',
            user: 'postgres',
            password: '',  // PostgreSQL configured with trust authentication
        });
        
        await pgClient.connect();
        console.log('✅ Connected to PostgreSQL');
        
        // 1. Create optimized schema
        console.log('1. Creating optimized PostgreSQL schema...');
        await pgClient.query(`
            -- Drop existing tables if they exist
            DROP TABLE IF EXISTS clickup_task_assignments CASCADE;
            DROP TABLE IF EXISTS clickup_task_comments CASCADE;
            DROP TABLE IF EXISTS clickup_task_dependencies CASCADE;
            DROP TABLE IF EXISTS clickup_tasks CASCADE;
            DROP TABLE IF EXISTS clickup_lists CASCADE;
            DROP TABLE IF EXISTS clickup_spaces CASCADE;
            DROP TABLE IF EXISTS clickup_members CASCADE;
            DROP TABLE IF EXISTS clickup_teams CASCADE;
        `);
        
        await pgClient.query(`
            -- ClickUp Teams
            CREATE TABLE clickup_teams (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                color VARCHAR(7),
                avatar VARCHAR(500),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            -- ClickUp Members
            CREATE TABLE clickup_members (
                id BIGINT PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                color VARCHAR(7),
                initials VARCHAR(10),
                profile_picture VARCHAR(500),
                role VARCHAR(50) DEFAULT 'Member',
                is_active BOOLEAN DEFAULT TRUE,
                team_id VARCHAR(50),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            -- ClickUp Spaces
            CREATE TABLE clickup_spaces (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                color VARCHAR(7),
                private BOOLEAN DEFAULT FALSE,
                avatar VARCHAR(500),
                team_id VARCHAR(50),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            -- ClickUp Lists
            CREATE TABLE clickup_lists (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                orderindex INTEGER DEFAULT 0,
                status VARCHAR(50),
                task_count INTEGER DEFAULT 0,
                space_id VARCHAR(50),
                folder_id VARCHAR(50),
                folder_name VARCHAR(255),
                archived BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            -- ClickUp Tasks (Optimized)
            CREATE TABLE clickup_tasks (
                id VARCHAR(50) PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                
                -- Status Information
                status_id VARCHAR(50),
                status_name VARCHAR(255),
                status_color VARCHAR(7),
                status_type VARCHAR(50) DEFAULT 'custom',
                status_orderindex INTEGER DEFAULT 0,
                
                -- Priority Information
                priority_id VARCHAR(50),
                priority_name VARCHAR(50),
                priority_color VARCHAR(7),
                priority_orderindex INTEGER DEFAULT 0,
                
                -- Assignment & Ownership
                creator_id BIGINT,
                
                -- Hierarchy (Parent-Child for Subtasks)
                parent VARCHAR(50),
                
                -- Location in ClickUp
                team_id VARCHAR(50),
                space_id VARCHAR(50),
                list_id VARCHAR(50),
                list_name VARCHAR(255),
                folder_id VARCHAR(50),
                folder_name VARCHAR(255),
                space_name VARCHAR(255),
                
                -- Timestamps (ClickUp uses milliseconds)
                date_created BIGINT,
                date_updated BIGINT,
                date_closed BIGINT,
                date_done BIGINT,
                due_date BIGINT,
                start_date BIGINT,
                
                -- Time Tracking
                time_estimate BIGINT,
                time_spent BIGINT,
                
                -- Additional Data
                priority TEXT,
                points NUMERIC(10,2),
                url TEXT,
                text_content TEXT,
                
                -- JSON Fields
                watchers JSONB,
                tags JSONB,
                custom_fields JSONB,
                dependencies JSONB,
                linked_tasks JSONB,
                
                -- Archive Status
                archived BOOLEAN DEFAULT FALSE,
                
                -- System Timestamps
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Task Assignments (Many-to-Many) - CRITICAL TABLE
            CREATE TABLE clickup_task_assignments (
                id SERIAL PRIMARY KEY,
                task_id VARCHAR(50) NOT NULL,
                member_id BIGINT NOT NULL,
                assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(task_id, member_id)
            );
        `);
        console.log('✅ Schema created');
        
        // 2. Migrate Teams
        console.log('2. Migrating teams...');
        const teams = sqliteDb.prepare('SELECT * FROM clickup_teams').all();
        for (const team of teams) {
            await pgClient.query(
                'INSERT INTO clickup_teams (id, name, color, avatar, created_at, updated_at, synced_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)',
                [team.id, team.name, team.color, team.avatar, team.created_at || new Date(), team.updated_at || new Date()]
            );
        }
        console.log(`✅ Migrated ${teams.length} teams`);
        
        // 3. Migrate Members
        console.log('3. Migrating members...');
        const members = sqliteDb.prepare('SELECT * FROM clickup_members').all();
        for (const member of members) {
            await pgClient.query(
                'INSERT INTO clickup_members (id, username, email, color, initials, profile_picture, role, is_active, team_id, created_at, updated_at, synced_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)',
                [
                    parseInt(member.id), member.username, member.email, member.color, 
                    member.initials, member.profile_picture, member.role || 'Member', 
                    member.is_active !== false, member.team_id, 
                    member.created_at || new Date(), member.updated_at || new Date()
                ]
            );
        }
        console.log(`✅ Migrated ${members.length} members`);
        
        // 4. Migrate Spaces
        console.log('4. Migrating spaces...');
        const spaces = sqliteDb.prepare('SELECT * FROM clickup_spaces').all();
        for (const space of spaces) {
            await pgClient.query(
                'INSERT INTO clickup_spaces (id, name, color, private, avatar, team_id, created_at, updated_at, synced_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)',
                [space.id, space.name, space.color, space.private || false, space.avatar, space.team_id, space.created_at || new Date(), space.updated_at || new Date()]
            );
        }
        console.log(`✅ Migrated ${spaces.length} spaces`);
        
        // 5. Migrate Lists
        console.log('5. Migrating lists...');
        const lists = sqliteDb.prepare('SELECT * FROM clickup_lists').all();
        for (const list of lists) {
            await pgClient.query(
                'INSERT INTO clickup_lists (id, name, orderindex, status, task_count, space_id, folder_id, folder_name, archived, created_at, updated_at, synced_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)',
                [list.id, list.name, list.orderindex || 0, list.status, list.task_count || 0, list.space_id, list.folder_id, list.folder_name, list.archived || false, list.created_at || new Date(), list.updated_at || new Date()]
            );
        }
        console.log(`✅ Migrated ${lists.length} lists`);
        
        // 6. Migrate Tasks
        console.log('6. Migrating tasks...');
        const tasks = sqliteDb.prepare('SELECT * FROM clickup_tasks').all();
        for (const task of tasks) {
            await pgClient.query(`
                INSERT INTO clickup_tasks (
                    id, name, description, status_id, status_name, status_color, status_type, status_orderindex,
                    priority_id, priority_name, priority_color, priority_orderindex, creator_id, parent,
                    team_id, space_id, list_id, list_name, folder_id, folder_name, space_name,
                    date_created, date_updated, date_closed, date_done, due_date, start_date,
                    time_estimate, time_spent, priority, points, url, text_content,
                    archived, created_at, updated_at, synced_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, CURRENT_TIMESTAMP)
            `, [
                task.id, task.name, task.description, task.status_id, task.status_name, task.status_color, 
                'custom', 0, task.priority_id, task.priority_name, task.priority_color, 0,
                task.creator_id ? parseInt(task.creator_id) : null, 
                task.parent_id || task.parent, task.team_id, task.space_id, task.list_id, 
                task.list_name, task.folder_id, task.folder_name, task.space_name,
                task.date_created, task.date_updated, task.date_closed, task.date_done,
                task.due_date, task.start_date, task.time_estimate, task.time_spent,
                task.priority, task.points, task.url, task.text_content,
                task.archived || false, task.created_at || new Date(), task.updated_at || new Date()
            ]);
        }
        console.log(`✅ Migrated ${tasks.length} tasks`);
        
        // 7. Create Task Assignments
        console.log('7. Creating task assignments...');
        const tasksWithAssignee = sqliteDb.prepare('SELECT id, assignee_id FROM clickup_tasks WHERE assignee_id IS NOT NULL AND assignee_id != ?').all('');
        
        let assignmentCount = 0;
        for (const task of tasksWithAssignee) {
            try {
                const memberId = parseInt(task.assignee_id);
                if (!isNaN(memberId) && memberId > 0) {
                    await pgClient.query(
                        'INSERT INTO clickup_task_assignments (task_id, member_id, assigned_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (task_id, member_id) DO NOTHING',
                        [task.id, memberId]
                    );
                    assignmentCount++;
                }
            } catch(e) {
                console.log(`  ⚠️ Failed to assign task ${task.id}: ${e.message}`);
            }
        }
        console.log(`✅ Created ${assignmentCount} task assignments`);
        
        // 8. Create indexes
        console.log('8. Creating performance indexes...');
        await pgClient.query(`
            CREATE INDEX idx_clickup_tasks_team_id ON clickup_tasks(team_id);
            CREATE INDEX idx_clickup_tasks_space_id ON clickup_tasks(space_id);
            CREATE INDEX idx_clickup_tasks_list_id ON clickup_tasks(list_id);
            CREATE INDEX idx_clickup_tasks_parent ON clickup_tasks(parent);
            CREATE INDEX idx_clickup_tasks_status_name ON clickup_tasks(status_name);
            CREATE INDEX idx_clickup_task_assignments_task_id ON clickup_task_assignments(task_id);
            CREATE INDEX idx_clickup_task_assignments_member_id ON clickup_task_assignments(member_id);
            CREATE INDEX idx_clickup_members_team_id ON clickup_members(team_id);
        `);
        console.log('✅ Indexes created');
        
        // 9. Verify migration
        const verification = await pgClient.query(`
            SELECT 
                (SELECT COUNT(*) FROM clickup_tasks) as task_count,
                (SELECT COUNT(*) FROM clickup_members) as member_count,
                (SELECT COUNT(*) FROM clickup_task_assignments) as assignment_count,
                (SELECT COUNT(*) FROM clickup_teams) as team_count,
                (SELECT COUNT(*) FROM clickup_spaces) as space_count,
                (SELECT COUNT(*) FROM clickup_lists) as list_count
        `);
        
        const counts = verification.rows[0];
        console.log('\n📊 Migration Results:');
        console.log(`  📋 Tasks: ${counts.task_count}`);
        console.log(`  👥 Members: ${counts.member_count}`);
        console.log(`  🎯 Assignments: ${counts.assignment_count}`);
        console.log(`  🏢 Teams: ${counts.team_count}`);
        console.log(`  🌐 Spaces: ${counts.space_count}`);
        console.log(`  📝 Lists: ${counts.list_count}`);
        
        // Show sample assignments
        const sampleAssignments = await pgClient.query(`
            SELECT 
                t.name as task_name,
                m.username as member_name,
                ta.assigned_at
            FROM clickup_task_assignments ta
            JOIN clickup_tasks t ON ta.task_id = t.id
            JOIN clickup_members m ON ta.member_id = m.id
            ORDER BY ta.assigned_at DESC
            LIMIT 5
        `);
        
        console.log('\n🎯 Sample Assignments:');
        sampleAssignments.rows.forEach(assignment => {
            console.log(`  📌 "${assignment.task_name}" → ${assignment.member_name}`);
        });
        
        console.log('\n✅ PostgreSQL migration completed successfully!');
        console.log('🗑️ You can now remove SQLite database (taskflow.db) if desired');
        
    } catch(error) {
        console.error('❌ Migration error:', error);
        process.exit(1);
    } finally {
        if (sqliteDb) sqliteDb.close();
        if (pgClient) await pgClient.end();
    }
}

migrateToPostgreSQL();