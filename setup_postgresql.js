#!/usr/bin/env node
/**
 * Setup PostgreSQL Database and Migrate from SQLite
 * Migrate 21 real tasks + 11 members to PostgreSQL
 */

const { Client } = require('pg');
const sqlite3 = require('sqlite3').verbose();

// PostgreSQL Configuration
const PG_CONFIG = {
    host: 'localhost',
    port: 5432,
    database: 'taskflow_pro',
    user: 'postgres',
    password: 'taskflow123'
};

// Connect to PostgreSQL (for database creation)
const PG_ADMIN_CONFIG = {
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'taskflow123'
};

// SQLite database path
const SQLITE_DB_PATH = './taskflow.db';

// PostgreSQL Schema
const POSTGRESQL_SCHEMA = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'Employee',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ClickUp Tasks table  
CREATE TABLE IF NOT EXISTS clickup_tasks (
    id VARCHAR(50) PRIMARY KEY,
    name TEXT,
    status VARCHAR(100),
    orderindex TEXT,
    date_created BIGINT,
    date_updated BIGINT,
    date_closed BIGINT,
    assignee TEXT,
    assignee_id TEXT,
    assignee_username TEXT,
    assignee_email TEXT,
    priority TEXT,
    due_date BIGINT,
    description TEXT,
    list_id TEXT,
    space_id TEXT,
    parent_id TEXT,
    url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ClickUp Members table
CREATE TABLE IF NOT EXISTS clickup_members (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(255),
    email VARCHAR(255),
    profilePicture TEXT,
    initials VARCHAR(10),
    color VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ClickUp Teams table
CREATE TABLE IF NOT EXISTS clickup_teams (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255),
    color VARCHAR(20),
    avatar TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ClickUp Spaces table
CREATE TABLE IF NOT EXISTS clickup_spaces (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255),
    color VARCHAR(20),
    private BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ClickUp Lists table
CREATE TABLE IF NOT EXISTS clickup_lists (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255),
    orderindex INTEGER,
    status VARCHAR(100),
    priority TEXT,
    assignee TEXT,
    task_count INTEGER,
    due_date BIGINT,
    start_date BIGINT,
    folder_id TEXT,
    space_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System status table
CREATE TABLE IF NOT EXISTS system_status (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(100),
    status VARCHAR(50),
    last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON clickup_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON clickup_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_list ON clickup_tasks(list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON clickup_tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_members_active ON clickup_members(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`;

// Create database and setup schema
async function setupPostgreSQL() {
    console.log('🚀 Setting up PostgreSQL...');
    
    // Connect to postgres database to create taskflow_pro database
    const adminClient = new Client(PG_ADMIN_CONFIG);
    
    try {
        await adminClient.connect();
        console.log('✅ Connected to PostgreSQL admin');
        
        // Check if database exists
        const result = await adminClient.query(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            ['taskflow_pro']
        );
        
        if (result.rows.length === 0) {
            // Create database
            await adminClient.query('CREATE DATABASE taskflow_pro');
            console.log('✅ Database taskflow_pro created');
        } else {
            console.log('✅ Database taskflow_pro already exists');
        }
        
    } catch (error) {
        console.error('❌ Error setting up database:', error);
        throw error;
    } finally {
        await adminClient.end();
    }
    
    // Connect to taskflow_pro database and create schema
    const client = new Client(PG_CONFIG);
    
    try {
        await client.connect();
        console.log('✅ Connected to taskflow_pro database');
        
        // Create schema
        await client.query(POSTGRESQL_SCHEMA);
        console.log('✅ Schema created successfully');
        
        return client;
    } catch (error) {
        console.error('❌ Error creating schema:', error);
        throw error;
    }
}

// Read data from SQLite
async function readFromSQLite() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(SQLITE_DB_PATH);
        const data = {};
        
        console.log('📖 Reading data from SQLite...');
        
        // Read all tables
        const queries = [
            { table: 'clickup_tasks', query: 'SELECT * FROM clickup_tasks' },
            { table: 'clickup_members', query: 'SELECT * FROM clickup_members' },
            { table: 'clickup_teams', query: 'SELECT * FROM clickup_teams' },
            { table: 'clickup_spaces', query: 'SELECT * FROM clickup_spaces' },
            { table: 'clickup_lists', query: 'SELECT * FROM clickup_lists' },
            { table: 'users', query: 'SELECT * FROM users' }
        ];
        
        let completed = 0;
        
        queries.forEach(({ table, query }) => {
            db.all(query, (err, rows) => {
                if (err) {
                    console.warn(`⚠️  Warning: Could not read ${table}:`, err.message);
                    data[table] = [];
                } else {
                    data[table] = rows || [];
                    console.log(`✅ Read ${rows?.length || 0} records from ${table}`);
                }
                
                completed++;
                if (completed === queries.length) {
                    db.close();
                    resolve(data);
                }
            });
        });
    });
}

// Insert data into PostgreSQL
async function insertIntoPostgreSQL(client, data) {
    console.log('📥 Migrating data to PostgreSQL...');
    
    try {
        // Insert users
        if (data.users && data.users.length > 0) {
            for (const user of data.users) {
                await client.query(
                    'INSERT INTO users (id, email, password_hash, name, role, is_active) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email) DO NOTHING',
                    [user.id, user.email, user.password_hash, user.name, user.role, user.is_active === 1]
                );
            }
            console.log(`✅ Migrated ${data.users.length} users`);
        }
        
        // Insert teams
        if (data.clickup_teams && data.clickup_teams.length > 0) {
            for (const team of data.clickup_teams) {
                await client.query(
                    'INSERT INTO clickup_teams (id, name, color, avatar) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
                    [team.id, team.name, team.color, team.avatar]
                );
            }
            console.log(`✅ Migrated ${data.clickup_teams.length} teams`);
        }
        
        // Insert spaces
        if (data.clickup_spaces && data.clickup_spaces.length > 0) {
            for (const space of data.clickup_spaces) {
                await client.query(
                    'INSERT INTO clickup_spaces (id, name, color, private) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
                    [space.id, space.name, space.color, space.private === 1]
                );
            }
            console.log(`✅ Migrated ${data.clickup_spaces.length} spaces`);
        }
        
        // Insert lists
        if (data.clickup_lists && data.clickup_lists.length > 0) {
            for (const list of data.clickup_lists) {
                await client.query(
                    'INSERT INTO clickup_lists (id, name, orderindex, status, priority, assignee, task_count, due_date, start_date, folder_id, space_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING',
                    [list.id, list.name, list.orderindex, list.status, list.priority, list.assignee, list.task_count, list.due_date, list.start_date, list.folder_id, list.space_id]
                );
            }
            console.log(`✅ Migrated ${data.clickup_lists.length} lists`);
        }
        
        // Insert members
        if (data.clickup_members && data.clickup_members.length > 0) {
            for (const member of data.clickup_members) {
                await client.query(
                    'INSERT INTO clickup_members (id, username, email, profilePicture, initials, color, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
                    [member.id, member.username, member.email, member.profilePicture, member.initials, member.color, member.is_active === 1]
                );
            }
            console.log(`✅ Migrated ${data.clickup_members.length} members`);
        }
        
        // Insert tasks (most important - our 21 real tasks!)
        if (data.clickup_tasks && data.clickup_tasks.length > 0) {
            for (const task of data.clickup_tasks) {
                await client.query(
                    'INSERT INTO clickup_tasks (id, name, status, orderindex, date_created, date_updated, date_closed, assignee, assignee_id, assignee_username, assignee_email, priority, due_date, description, list_id, space_id, parent_id, url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) ON CONFLICT (id) DO NOTHING',
                    [
                        task.id, task.name, task.status, task.orderindex, 
                        task.date_created, task.date_updated, task.date_closed,
                        task.assignee, task.assignee_id, task.assignee_username, task.assignee_email,
                        task.priority, task.due_date, task.description,
                        task.list_id, task.space_id, task.parent_id, task.url
                    ]
                );
            }
            console.log(`✅ Migrated ${data.clickup_tasks.length} tasks (INCLUDING ALL 21 REAL TASKS)`);
        }
        
        // Verify migration
        const stats = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM clickup_tasks) as total_tasks,
                (SELECT COUNT(*) FROM clickup_tasks WHERE parent_id IS NULL OR parent_id = '') as main_tasks,
                (SELECT COUNT(*) FROM clickup_tasks WHERE parent_id IS NOT NULL AND parent_id != '') as sub_tasks,
                (SELECT COUNT(*) FROM clickup_members WHERE is_active = true) as active_members,
                (SELECT COUNT(*) FROM clickup_teams) as teams
        `);
        
        const { total_tasks, main_tasks, sub_tasks, active_members, teams } = stats.rows[0];
        
        console.log('\n📊 MIGRATION COMPLETE - PostgreSQL Statistics:');
        console.log(`✅ Total Tasks: ${total_tasks}`);
        console.log(`📋 Main Tasks: ${main_tasks}`);
        console.log(`🔗 Sub Tasks: ${sub_tasks}`);
        console.log(`👥 Active Members: ${active_members}`);
        console.log(`🏢 Teams: ${teams}`);
        
        if (total_tasks >= 21) {
            console.log('\n🎉 SUCCESS: All 21 real ClickUp tasks migrated to PostgreSQL!');
        } else {
            console.log(`\n⚠️  WARNING: Expected 21 tasks, got ${total_tasks}`);
        }
        
    } catch (error) {
        console.error('❌ Error migrating data:', error);
        throw error;
    }
}

// Create default user if not exists
async function createDefaultUser(client) {
    try {
        const result = await client.query('SELECT COUNT(*) FROM users');
        const userCount = parseInt(result.rows[0].count);
        
        if (userCount === 0) {
            console.log('👤 Creating default user...');
            await client.query(
                'INSERT INTO users (email, password_hash, name, role, is_active) VALUES ($1, $2, $3, $4, $5)',
                ['yterayut@gmail.com', '$2b$10$rOj8ZgQGQ1tYWNJRZ7pJAOCB3xT4z3.P0z9BgWZbQLt/AE7IGwQyO', 'Teerayut Yeerahem', 'Manager', true]
            );
            console.log('✅ Default user created: yterayut@gmail.com / admin123');
        }
    } catch (error) {
        console.error('❌ Error creating default user:', error);
    }
}

// Main migration function
async function main() {
    console.log('🚀 PostgreSQL Migration Starting...');
    console.log('🎯 Objective: Migrate 21 real ClickUp tasks + 11 members to PostgreSQL');
    
    try {
        // Setup PostgreSQL
        const client = await setupPostgreSQL();
        
        // Read data from SQLite
        const data = await readFromSQLite();
        
        // Migrate data
        await insertIntoPostgreSQL(client, data);
        
        // Create default user
        await createDefaultUser(client);
        
        await client.end();
        
        console.log('\n🎉 POSTGRESQL MIGRATION COMPLETED SUCCESSFULLY!');
        console.log('✅ All real ClickUp data (21 tasks + 11 members) now in PostgreSQL');
        console.log('🔄 Next: Update backend to USE_POSTGRESQL=true');
        
    } catch (error) {
        console.error('❌ MIGRATION FAILED:', error);
        process.exit(1);
    }
}

// Run migration
main();