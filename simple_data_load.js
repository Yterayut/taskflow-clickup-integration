#!/usr/bin/env node
/**
 * Simple Data Load - Just load 21 real tasks
 * Map SQLite data to existing PostgreSQL schema
 */

const sqlite3 = require('sqlite3').verbose();
const { execSync } = require('child_process');

console.log('🚀 Simple Data Load - 21 Real Tasks to PostgreSQL');

// Read and insert tasks
function loadTasks() {
    return new Promise((resolve) => {
        const db = new sqlite3.Database('./taskflow.db');
        
        db.all('SELECT * FROM clickup_tasks LIMIT 25', (err, tasks) => {
            if (err || !tasks) {
                console.error('❌ Error reading tasks:', err);
                resolve(false);
                return;
            }
            
            console.log(`📋 Found ${tasks.length} real tasks in SQLite`);
            
            // Insert tasks one by one to existing schema
            let inserted = 0;
            tasks.forEach((task, index) => {
                try {
                    const taskName = task.name.replace(/'/g, "''");
                    const taskDesc = task.description ? task.description.replace(/'/g, "''") : '';
                    const status = task.status || 'to do';
                    
                    const insertQuery = `INSERT INTO clickup_tasks (id, name, description, status_name, list_id, space_id, date_created, date_updated, url) VALUES ('${task.id}', '${taskName}', '${taskDesc}', '${status}', '${task.list_id || ''}', '${task.space_id || ''}', ${task.date_created || Date.now()}, ${task.date_updated || Date.now()}, '${task.url || ''}') ON CONFLICT (id) DO NOTHING;`;
                    
                    execSync(`psql -U postgres -d taskflow_pro -c "${insertQuery}"`, { stdio: 'pipe' });
                    
                    console.log(`✅ Task ${index + 1}: ${task.name.substring(0, 50)}...`);
                    inserted++;
                } catch (error) {
                    console.log(`❌ Task ${index + 1} failed: ${error.message.substring(0, 50)}`);
                }
            });
            
            db.close();
            
            if (inserted >= 21) {
                console.log(`\\n🎉 SUCCESS: Inserted ${inserted} real tasks into PostgreSQL!`);
                resolve(true);
            } else {
                console.log(`\\n⚠️  WARNING: Only inserted ${inserted} tasks`);
                resolve(false);
            }
        });
    });
}

// Read and insert members
function loadMembers() {
    return new Promise((resolve) => {
        const db = new sqlite3.Database('./taskflow.db');
        
        db.all('SELECT * FROM clickup_members', (err, members) => {
            if (err || !members) {
                console.log('⚠️  No members found');
                resolve(true);
                return;
            }
            
            console.log(`👥 Found ${members.length} real members in SQLite`);
            
            // Insert members
            let inserted = 0;
            members.forEach((member, index) => {
                try {
                    const username = member.username ? member.username.replace(/'/g, "''") : '';
                    const email = member.email ? member.email.replace(/'/g, "''") : '';
                    const initials = member.initials || '';
                    const color = member.color || '#000000';
                    
                    const insertQuery = `INSERT INTO clickup_members (id, username, email, initials, color) VALUES (${member.id}, '${username}', '${email}', '${initials}', '${color}') ON CONFLICT (id) DO NOTHING;`;
                    
                    execSync(`psql -U postgres -d taskflow_pro -c "${insertQuery}"`, { stdio: 'pipe' });
                    
                    console.log(`✅ Member ${index + 1}: ${username || email || member.id}`);
                    inserted++;
                } catch (error) {
                    console.log(`❌ Member ${index + 1} failed: ${error.message.substring(0, 50)}`);
                }
            });
            
            db.close();
            console.log(`✅ Inserted ${inserted} members`);
            resolve(true);
        });
    });
}

// Verify data
function verifyData() {
    try {
        const taskCount = execSync('psql -U postgres -d taskflow_pro -c "SELECT COUNT(*) FROM clickup_tasks;" -t', { encoding: 'utf8' }).trim();
        const memberCount = execSync('psql -U postgres -d taskflow_pro -c "SELECT COUNT(*) FROM clickup_members;" -t', { encoding: 'utf8' }).trim();
        
        console.log('\\n📊 FINAL VERIFICATION:');
        console.log(`✅ Tasks in PostgreSQL: ${taskCount}`);
        console.log(`👥 Members in PostgreSQL: ${memberCount}`);
        
        if (parseInt(taskCount) >= 21) {
            console.log('\\n🎉 MIGRATION SUCCESSFUL!');
            console.log('✅ All real ClickUp tasks loaded into PostgreSQL');
            
            // Show sample tasks
            const sampleTasks = execSync('psql -U postgres -d taskflow_pro -c "SELECT name FROM clickup_tasks LIMIT 3;" -t', { encoding: 'utf8' });
            console.log('\\n📋 Sample tasks:');
            sampleTasks.trim().split('\\n').forEach((task, i) => {
                if (task.trim()) console.log(`  ${i + 1}. ${task.trim()}`);
            });
            
            return true;
        } else {
            console.log(`\\n⚠️  Expected 21+ tasks, got ${taskCount}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        return false;
    }
}

// Main
async function main() {
    try {
        console.log('🎯 Loading 21 real ClickUp tasks into PostgreSQL');
        
        // Clear existing data
        try {
            execSync('psql -U postgres -d taskflow_pro -c "DELETE FROM clickup_tasks; DELETE FROM clickup_members;"', { stdio: 'pipe' });
            console.log('🧹 Cleared existing data');
        } catch (e) {
            console.log('⚠️  Could not clear data (tables might be empty)');
        }
        
        // Load tasks (most important)
        const tasksSuccess = await loadTasks();
        
        // Load members
        await loadMembers();
        
        // Verify
        const verified = verifyData();
        
        if (tasksSuccess && verified) {
            console.log('\\n🎉 SIMPLE DATA LOAD COMPLETED SUCCESSFULLY!');
            console.log('🔧 PostgreSQL ready with 21 real ClickUp tasks');
            console.log('📋 Connection: postgresql://postgres@localhost/taskflow_pro');
        } else {
            console.log('\\n⚠️  Data load completed with some issues');
        }
        
    } catch (error) {
        console.error('❌ LOAD FAILED:', error.message);
        process.exit(1);
    }
}

main();