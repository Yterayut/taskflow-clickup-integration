#!/usr/bin/env node
/**
 * Load Real Data to PostgreSQL
 * Match existing schema and insert 21 real tasks + 11 members
 */

const sqlite3 = require('sqlite3').verbose();
const { execSync } = require('child_process');
const fs = require('fs');

// SQLite database path
const SQLITE_DB_PATH = './taskflow.db';

console.log('🚀 Loading Real Data to PostgreSQL (21 tasks + 11 members)');

// Read SQLite data
function readSQLiteData() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(SQLITE_DB_PATH)) {
            console.error('❌ SQLite database not found');
            resolve({});
            return;
        }
        
        const db = new sqlite3.Database(SQLITE_DB_PATH);
        const data = {};
        
        console.log('📖 Reading real data from SQLite...');
        
        // Read tasks
        db.all('SELECT * FROM clickup_tasks', (err, tasks) => {
            if (err) {
                console.error('❌ Error reading tasks:', err);
                data.tasks = [];
            } else {
                data.tasks = tasks || [];
                console.log(`✅ Read ${tasks.length} real tasks`);
            }
            
            // Read members
            db.all('SELECT * FROM clickup_members', (err, members) => {
                if (err) {
                    console.error('❌ Error reading members:', err);
                    data.members = [];
                } else {
                    data.members = members || [];
                    console.log(`✅ Read ${members.length} real members`);
                }
                
                // Read teams
                db.all('SELECT * FROM clickup_teams', (err, teams) => {
                    if (err) {
                        data.teams = [];
                    } else {
                        data.teams = teams || [];
                        console.log(`✅ Read ${teams.length} teams`);
                    }
                    
                    db.close();
                    resolve(data);
                });
            });
        });
    });
}

// Insert data into PostgreSQL
function insertData(data) {
    console.log('📥 Inserting real data into PostgreSQL...');
    
    // Clear existing data
    try {
        execSync('psql -U postgres -d taskflow_pro -c "TRUNCATE clickup_tasks, clickup_members, clickup_teams CASCADE;"', { stdio: 'pipe' });
        console.log('🧹 Cleared existing data');
    } catch (error) {
        console.log('⚠️  Could not truncate tables (might be empty)');
    }
    
    // Insert teams first
    if (data.teams && data.teams.length > 0) {
        console.log('🏢 Inserting teams...');
        
        const teamInserts = data.teams.map(team => {
            return `INSERT INTO clickup_teams (id, name) VALUES ('${team.id}', '${team.name.replace(/'/g, "''")}');`;
        }).join('\\n');
        
        fs.writeFileSync('./insert_teams.sql', teamInserts);
        
        try {
            execSync('psql -U postgres -d taskflow_pro -f insert_teams.sql', { stdio: 'pipe' });
            console.log(`✅ Inserted ${data.teams.length} teams`);
        } catch (error) {
            console.error('❌ Failed to insert teams');
        }
    }
    
    // Insert members
    if (data.members && data.members.length > 0) {
        console.log('👥 Inserting real members...');
        
        const memberInserts = data.members.map(member => {
            const username = member.username ? `'${member.username.replace(/'/g, "''")}'` : 'NULL';
            const email = member.email ? `'${member.email.replace(/'/g, "''")}'` : 'NULL';
            const initials = member.initials ? `'${member.initials.replace(/'/g, "''")}'` : 'NULL';
            const color = member.color ? `'${member.color.replace(/'/g, "''")}'` : 'NULL';
            const isActive = member.is_active === 1 ? 'true' : 'false';
            
            return `INSERT INTO clickup_members (id, username, email, initials, color, is_active) VALUES (${member.id}, ${username}, ${email}, ${initials}, ${color}, ${isActive});`;
        }).join('\\n');
        
        fs.writeFileSync('./insert_members.sql', memberInserts);
        
        try {
            execSync('psql -U postgres -d taskflow_pro -f insert_members.sql', { stdio: 'pipe' });
            console.log(`✅ Inserted ${data.members.length} real members`);
        } catch (error) {
            console.error('❌ Failed to insert members:', error.message);
        }
    }
    
    // Insert tasks (MOST IMPORTANT - our 21 real tasks!)
    if (data.tasks && data.tasks.length > 0) {
        console.log('📋 Inserting 21 REAL TASKS...');
        
        const taskInserts = data.tasks.map(task => {
            const name = task.name ? `'${task.name.replace(/'/g, "''")}'` : 'NULL';
            const description = task.description ? `'${task.description.replace(/'/g, "''")}'` : 'NULL';
            const statusName = task.status ? `'${task.status.replace(/'/g, "''")}'` : "'Open'";
            const assigneeId = task.assignee_id ? task.assignee_id : 'NULL';
            const listId = task.list_id ? `'${task.list_id}'` : 'NULL';
            const spaceId = task.space_id ? `'${task.space_id}'` : 'NULL';
            const parentId = task.parent_id ? `'${task.parent_id}'` : 'NULL';
            const url = task.url ? `'${task.url.replace(/'/g, "''")}'` : 'NULL';
            const dateCreated = task.date_created || 'NULL';
            const dateUpdated = task.date_updated || 'NULL';
            const dueDate = task.due_date || 'NULL';
            
            return `INSERT INTO clickup_tasks (id, name, description, status_name, assignee_id, list_id, space_id, parent_id, url, date_created, date_updated, due_date) VALUES ('${task.id}', ${name}, ${description}, ${statusName}, ${assigneeId}, ${listId}, ${spaceId}, ${parentId}, ${url}, ${dateCreated}, ${dateUpdated}, ${dueDate});`;
        }).join('\\n');
        
        fs.writeFileSync('./insert_tasks.sql', taskInserts);
        
        try {
            execSync('psql -U postgres -d taskflow_pro -f insert_tasks.sql', { stdio: 'pipe' });
            console.log(`✅ Inserted ${data.tasks.length} REAL TASKS!`);
        } catch (error) {
            console.error('❌ Failed to insert tasks:', error.message);
            
            // Try one by one for debugging
            console.log('🔍 Trying to insert tasks one by one...');
            data.tasks.forEach((task, index) => {
                try {
                    const singleInsert = `INSERT INTO clickup_tasks (id, name, status_name) VALUES ('${task.id}', '${task.name.replace(/'/g, "''")}', '${task.status || 'Open'}');`;
                    fs.writeFileSync('./single_task.sql', singleInsert);
                    execSync('psql -U postgres -d taskflow_pro -f single_task.sql', { stdio: 'pipe' });
                    console.log(`  ✅ Task ${index + 1}: ${task.name.substring(0, 50)}...`);
                } catch (singleError) {
                    console.log(`  ❌ Task ${index + 1} failed: ${task.name.substring(0, 30)}`);
                }
            });
        }
    }
    
    // Cleanup temp files
    ['insert_teams.sql', 'insert_members.sql', 'insert_tasks.sql', 'single_task.sql'].forEach(file => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
    });
}

// Verify insertion
function verifyData() {
    console.log('🔍 Verifying real data in PostgreSQL...');
    
    try {
        const result = execSync(`psql -U postgres -d taskflow_pro -c "
            SELECT 
                (SELECT COUNT(*) FROM clickup_tasks) as total_tasks,
                (SELECT COUNT(*) FROM clickup_members WHERE is_active = true) as active_members,
                (SELECT COUNT(*) FROM clickup_teams) as teams;
        " -t`, { encoding: 'utf8' });
        
        const line = result.trim().split('|').map(s => s.trim());
        const [totalTasks, activeMembers, teams] = line;
        
        console.log('\\n📊 REAL DATA IN POSTGRESQL:');
        console.log(`✅ Total Tasks: ${totalTasks}`);
        console.log(`👥 Active Members: ${activeMembers}`);
        console.log(`🏢 Teams: ${teams}`);
        
        if (parseInt(totalTasks) >= 21) {
            console.log('\\n🎉 SUCCESS: All 21 real ClickUp tasks loaded into PostgreSQL!');
            
            // Show sample tasks
            const sampleTasks = execSync(`psql -U postgres -d taskflow_pro -c "SELECT name FROM clickup_tasks LIMIT 5;" -t`, { encoding: 'utf8' });
            console.log('\\n📋 Sample real tasks:');
            sampleTasks.trim().split('\\n').forEach((task, i) => {
                if (task.trim()) console.log(`  ${i + 1}. ${task.trim()}`);
            });
            
            return true;
        } else {
            console.log(`\\n⚠️  WARNING: Expected 21 tasks, got ${totalTasks}`);
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
        console.log('🎯 Goal: Load 21 real ClickUp tasks into PostgreSQL');
        
        // Read SQLite data
        const data = await readSQLiteData();
        
        if (!data.tasks || data.tasks.length === 0) {
            console.error('❌ No tasks found in SQLite database');
            process.exit(1);
        }
        
        // Insert data
        insertData(data);
        
        // Verify
        const success = verifyData();
        
        if (success) {
            console.log('\\n✅ REAL DATA LOADING COMPLETE!');
            console.log('🔧 PostgreSQL ready for TaskFlow Pro backend');
        } else {
            console.log('\\n⚠️  Data loading completed with warnings');
        }
        
    } catch (error) {
        console.error('❌ DATA LOADING FAILED:', error.message);
        process.exit(1);
    }
}

// Run
main();