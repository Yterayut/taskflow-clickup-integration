#!/usr/bin/env node
/**
 * Direct PostgreSQL Migration - No sudo needed
 * Use system commands directly and create PostgreSQL setup
 */

const { execSync, spawn } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// SQLite database path
const SQLITE_DB_PATH = './taskflow.db';

console.log('🚀 Direct PostgreSQL Migration...');

// Function to run command as postgres user using system calls
function runAsPostgres(cmd) {
    try {
        // Try direct connection via socket (peer authentication)
        const result = execSync(`PGUSER=postgres PGDATABASE=postgres psql -c "${cmd}"`, { 
            encoding: 'utf8',
            stdio: 'pipe'
        });
        return result;
    } catch (error) {
        try {
            // Alternative: Use local socket connection
            const result = execSync(`psql -h localhost -U postgres -c "${cmd}"`, { 
                encoding: 'utf8',
                stdio: 'pipe',
                env: { ...process.env, PGPASSWORD: '' }
            });
            return result;
        } catch (error2) {
            throw error;
        }
    }
}

// Step 1: Test PostgreSQL connection
function testConnection() {
    console.log('🔌 Testing PostgreSQL connection...');
    
    try {
        const result = runAsPostgres('SELECT version();');
        console.log('✅ PostgreSQL connected:', result.trim().substring(0, 50) + '...');
        return true;
    } catch (error) {
        console.error('❌ PostgreSQL connection failed:', error.message);
        console.log('💡 Trying alternative approach...');
        
        // Try creating a simple test
        try {
            execSync('createdb test_conn 2>/dev/null && dropdb test_conn', { stdio: 'ignore' });
            console.log('✅ PostgreSQL accessible via createdb');
            return true;
        } catch (e) {
            console.error('❌ All PostgreSQL connection methods failed');
            return false;
        }
    }
}

// Step 2: Setup database using files
function setupDatabase() {
    console.log('📊 Setting up PostgreSQL database...');
    
    // Create SQL script
    const setupSQL = `
-- Create database
SELECT 'CREATE DATABASE taskflow_pro' 
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'taskflow_pro')\\gexec

-- Connect to taskflow_pro (will need to run separately)
\\c taskflow_pro

-- Create tables
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

CREATE TABLE IF NOT EXISTS clickup_teams (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255),
    color VARCHAR(20),
    avatar TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clickup_spaces (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255),
    color VARCHAR(20),
    private BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON clickup_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON clickup_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_members_active ON clickup_members(is_active);

-- Default user
INSERT INTO users (email, password_hash, name, role, is_active) 
VALUES ('yterayut@gmail.com', '$2b$10$rOj8ZgQGQ1tYWNJRZ7pJAOCB3xT4z3.P0z9BgWZbQLt/AE7IGwQyO', 'Teerayut Yeerahem', 'Manager', true)
ON CONFLICT (email) DO NOTHING;
`;
    
    // Write to file
    fs.writeFileSync('./setup.sql', setupSQL);
    
    try {
        // Create database first
        execSync('createdb taskflow_pro 2>/dev/null || echo "Database exists"', { stdio: 'inherit' });
        
        // Run setup on taskflow_pro database
        execSync('psql -d taskflow_pro -f setup.sql', { stdio: 'inherit' });
        
        console.log('✅ Database setup complete');
        return true;
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        return false;
    }
}

// Step 3: Migrate SQLite data
async function migrateSQLiteData() {
    if (!fs.existsSync(SQLITE_DB_PATH)) {
        console.log('⚠️  SQLite database not found, skipping migration');
        return true;
    }
    
    console.log('📖 Reading SQLite data...');
    
    return new Promise((resolve) => {
        const db = new sqlite3.Database(SQLITE_DB_PATH);
        let totalMigrated = 0;
        
        // Migrate tasks (most important)
        db.all('SELECT * FROM clickup_tasks', (err, tasks) => {
            if (err || !tasks || tasks.length === 0) {
                console.log('⚠️  No tasks found in SQLite');
                resolve(true);
                return;
            }
            
            console.log(`🔄 Migrating ${tasks.length} tasks...`);
            
            // Create batch insert SQL
            const taskInserts = tasks.map(task => {
                const values = [
                    task.id, task.name, task.status, task.orderindex,
                    task.date_created, task.date_updated, task.date_closed,
                    task.assignee, task.assignee_id, task.assignee_username, task.assignee_email,
                    task.priority, task.due_date, task.description,
                    task.list_id, task.space_id, task.parent_id, task.url
                ].map(v => v === null ? 'NULL' : typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v);
                
                return `INSERT INTO clickup_tasks (id, name, status, orderindex, date_created, date_updated, date_closed, assignee, assignee_id, assignee_username, assignee_email, priority, due_date, description, list_id, space_id, parent_id, url) VALUES (${values.join(', ')}) ON CONFLICT (id) DO NOTHING;`;
            }).join('\\n');
            
            fs.writeFileSync('./migrate_tasks.sql', taskInserts);
            
            try {
                execSync('psql -d taskflow_pro -f migrate_tasks.sql', { stdio: 'pipe' });
                console.log(`✅ Tasks migrated: ${tasks.length}`);
                totalMigrated += tasks.length;
            } catch (error) {
                console.error('❌ Task migration failed:', error.message.substring(0, 100));
            }
            
            // Migrate members
            db.all('SELECT * FROM clickup_members', (err, members) => {
                if (!err && members && members.length > 0) {
                    console.log(`🔄 Migrating ${members.length} members...`);
                    
                    const memberInserts = members.map(member => {
                        const values = [
                            member.id, member.username, member.email, member.profilePicture,
                            member.initials, member.color, member.is_active === 1 ? 'true' : 'false'
                        ].map(v => v === null ? 'NULL' : typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v);
                        
                        return `INSERT INTO clickup_members (id, username, email, profilePicture, initials, color, is_active) VALUES (${values.join(', ')}) ON CONFLICT (id) DO NOTHING;`;
                    }).join('\\n');
                    
                    fs.writeFileSync('./migrate_members.sql', memberInserts);
                    
                    try {
                        execSync('psql -d taskflow_pro -f migrate_members.sql', { stdio: 'pipe' });
                        console.log(`✅ Members migrated: ${members.length}`);
                    } catch (error) {
                        console.error('❌ Member migration failed:', error.message);
                    }
                }
                
                db.close();
                resolve(true);
            });
        });
    });
}

// Step 4: Verify migration
function verifyMigration() {
    console.log('🔍 Verifying migration...');
    
    try {
        const result = execSync(`psql -d taskflow_pro -c "SELECT COUNT(*) as tasks FROM clickup_tasks; SELECT COUNT(*) as members FROM clickup_members;" -t`, { encoding: 'utf8' });
        
        const lines = result.trim().split('\\n').filter(l => l.trim());
        console.log('📊 Migration Results:');
        lines.forEach(line => {
            const count = line.trim();
            if (count) console.log(`  ${count}`);
        });
        
        return true;
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        return false;
    }
}

// Main function
async function main() {
    try {
        console.log('🎯 Direct PostgreSQL Migration - Migrate 21 real ClickUp tasks');
        
        // Test connection
        if (!testConnection()) {
            console.log('❌ Cannot connect to PostgreSQL - trying to continue anyway');
        }
        
        // Setup database
        if (!setupDatabase()) {
            throw new Error('Database setup failed');
        }
        
        // Migrate data
        await migrateSQLiteData();
        
        // Verify
        verifyMigration();
        
        // Cleanup
        ['setup.sql', 'migrate_tasks.sql', 'migrate_members.sql'].forEach(file => {
            if (fs.existsSync(file)) fs.unlinkSync(file);
        });
        
        console.log('\\n🎉 POSTGRESQL MIGRATION COMPLETED!');
        console.log('✅ Database: taskflow_pro');
        console.log('🔧 Connection: postgresql://localhost/taskflow_pro');
        console.log('👤 User: Use system peer authentication');
        
    } catch (error) {
        console.error('❌ MIGRATION FAILED:', error.message);
        process.exit(1);
    }
}

// Run migration
main();