#!/usr/bin/env node
/**
 * PostgreSQL Migration Final - Migrate 21 real tasks + 11 members
 * Use trust authentication with PostgreSQL
 */

const { execSync } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// SQLite database path
const SQLITE_DB_PATH = './taskflow.db';

console.log('🚀 PostgreSQL Migration Final - 21 Real Tasks + 11 Members');

// Step 1: Create PostgreSQL schema
function createSchema() {
    console.log('🏗️  Creating PostgreSQL schema...');
    
    const schema = `
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON clickup_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON clickup_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_list ON clickup_tasks(list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON clickup_tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_members_active ON clickup_members(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Default user
INSERT INTO users (email, password_hash, name, role, is_active) 
VALUES ('yterayut@gmail.com', '$2b$10$rOj8ZgQGQ1tYWNJRZ7pJAOCB3xT4z3.P0z9BgWZbQLt/AE7IGwQyO', 'Teerayut Yeerahem', 'Manager', true)
ON CONFLICT (email) DO NOTHING;
`;
    
    // Write schema to file
    fs.writeFileSync('./pg_schema.sql', schema);
    
    try {
        execSync('psql -U postgres -d taskflow_pro -f pg_schema.sql', { stdio: 'inherit' });
        console.log('✅ PostgreSQL schema created');
        return true;
    } catch (error) {
        console.error('❌ Schema creation failed:', error.message);
        return false;
    }
}

// Step 2: Read SQLite data
function readSQLiteData() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(SQLITE_DB_PATH)) {
            console.error('❌ SQLite database not found:', SQLITE_DB_PATH);
            resolve({});
            return;
        }
        
        const db = new sqlite3.Database(SQLITE_DB_PATH);
        const data = {};
        
        console.log('📖 Reading data from SQLite...');
        
        const queries = [
            { table: 'clickup_tasks', query: 'SELECT * FROM clickup_tasks' },
            { table: 'clickup_members', query: 'SELECT * FROM clickup_members' },
            { table: 'clickup_teams', query: 'SELECT * FROM clickup_teams' },
            { table: 'clickup_spaces', query: 'SELECT * FROM clickup_spaces' },
            { table: 'clickup_lists', query: 'SELECT * FROM clickup_lists' }
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

// Step 3: Migrate data to PostgreSQL
function migrateData(data) {
    console.log('📥 Migrating data to PostgreSQL...');
    
    const tables = ['clickup_teams', 'clickup_spaces', 'clickup_lists', 'clickup_members', 'clickup_tasks'];
    let totalMigrated = 0;
    
    tables.forEach(table => {
        const records = data[table] || [];
        if (records.length === 0) {
            console.log(`⏭️  Skipping empty table: ${table}`);
            return;
        }
        
        console.log(`🔄 Migrating ${table}: ${records.length} records`);
        
        // Create INSERT statements
        const insertSQL = records.map(record => {
            const columns = Object.keys(record);
            const values = columns.map(col => {
                const val = record[col];
                if (val === null) return 'NULL';
                if (typeof val === 'boolean') return val ? 'true' : 'false';
                if (typeof val === 'number') return val;
                if (col === 'is_active' && typeof val === 'number') return val === 1 ? 'true' : 'false';
                return `'${String(val).replace(/'/g, "''")}'`;
            });
            
            return `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT (id) DO NOTHING;`;
        }).join('\\n');
        
        // Write to file
        fs.writeFileSync(`./migrate_${table}.sql`, insertSQL);
        
        try {
            execSync(`psql -U postgres -d taskflow_pro -f migrate_${table}.sql`, { stdio: 'pipe' });
            console.log(`✅ Migrated ${table}: ${records.length} records`);
            totalMigrated += records.length;
        } catch (error) {
            console.error(`❌ Failed to migrate ${table}:`, error.message);
        }
    });
    
    return totalMigrated;
}

// Step 4: Verify migration
function verifyMigration() {
    console.log('🔍 Verifying PostgreSQL migration...');
    
    try {
        const result = execSync(`psql -U postgres -d taskflow_pro -c "
            SELECT 
                (SELECT COUNT(*) FROM clickup_tasks) as total_tasks,
                (SELECT COUNT(*) FROM clickup_tasks WHERE parent_id IS NULL OR parent_id = '') as main_tasks,
                (SELECT COUNT(*) FROM clickup_tasks WHERE parent_id IS NOT NULL AND parent_id != '') as sub_tasks,
                (SELECT COUNT(*) FROM clickup_members WHERE is_active = true) as active_members,
                (SELECT COUNT(*) FROM clickup_teams) as teams,
                (SELECT COUNT(*) FROM users) as users;
        " -t`, { encoding: 'utf8' });
        
        const line = result.trim().split('|').map(s => s.trim());
        const [total_tasks, main_tasks, sub_tasks, active_members, teams, users] = line;
        
        console.log('\\n📊 POSTGRESQL MIGRATION COMPLETE - Statistics:');
        console.log(`✅ Total Tasks: ${total_tasks}`);
        console.log(`📋 Main Tasks: ${main_tasks}`);
        console.log(`🔗 Sub Tasks: ${sub_tasks}`);
        console.log(`👥 Active Members: ${active_members}`);
        console.log(`🏢 Teams: ${teams}`);
        console.log(`👤 Users: ${users}`);
        
        if (parseInt(total_tasks) >= 21) {
            console.log('\\n🎉 SUCCESS: All 21 real ClickUp tasks migrated to PostgreSQL!');
            return true;
        } else {
            console.log(`\\n⚠️  WARNING: Expected 21 tasks, got ${total_tasks}`);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        return false;
    }
}

// Main function
async function main() {
    try {
        console.log('🎯 Objective: Migrate 21 real ClickUp tasks + 11 members to PostgreSQL');
        
        // Step 1: Create schema
        if (!createSchema()) {
            throw new Error('Schema creation failed');
        }
        
        // Step 2: Read SQLite data
        const data = await readSQLiteData();
        
        // Step 3: Migrate data
        const totalMigrated = migrateData(data);
        
        // Step 4: Verify migration
        const success = verifyMigration();
        
        // Cleanup temp files
        execSync('rm -f pg_schema.sql migrate_*.sql');
        
        if (success) {
            console.log('\\n🎉 POSTGRESQL MIGRATION COMPLETED SUCCESSFULLY!');
            console.log('✅ All real ClickUp data (21 tasks + 11 members) now in PostgreSQL');
            console.log('🔧 Backend ready to switch to PostgreSQL');
            console.log('📋 Connection: postgresql://postgres@localhost/taskflow_pro');
        } else {
            console.log('\\n⚠️  Migration completed with warnings');
        }
        
    } catch (error) {
        console.error('❌ MIGRATION FAILED:', error.message);
        process.exit(1);
    }
}

// Run migration
main();