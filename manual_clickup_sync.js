#!/usr/bin/env node
/**
 * Manual ClickUp Data Sync Script
 * Sync real ClickUp data to database immediately
 */

const sqlite3 = require('sqlite3').verbose();

// ClickUp API Configuration
const CLICKUP_TOKEN = 'pk_282686567_9YVTHM0C1HQJDMEUWZP8RTP48S4YV5HL';
const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

// Database connection
const db = new sqlite3.Database('./taskflow_production_real.db');

// Initialize tables
async function initializeTables() {
    return new Promise((resolve, reject) => {
        const queries = [
            `CREATE TABLE IF NOT EXISTS clickup_tasks (
                id TEXT PRIMARY KEY,
                name TEXT,
                status TEXT,
                orderindex TEXT,
                date_created INTEGER,
                date_updated INTEGER,
                date_closed INTEGER,
                assignee TEXT,
                assignee_id TEXT,
                assignee_username TEXT,
                assignee_email TEXT,
                priority TEXT,
                due_date INTEGER,
                description TEXT,
                list_id TEXT,
                space_id TEXT,
                parent_id TEXT,
                url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS clickup_members (
                id TEXT PRIMARY KEY,
                username TEXT,
                email TEXT,
                profilePicture TEXT,
                initials TEXT,
                color TEXT,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS clickup_teams (
                id TEXT PRIMARY KEY,
                name TEXT,
                color TEXT,
                avatar TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS clickup_spaces (
                id TEXT PRIMARY KEY,
                name TEXT,
                color TEXT,
                private INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS clickup_lists (
                id TEXT PRIMARY KEY,
                name TEXT,
                orderindex INTEGER,
                status TEXT,
                priority TEXT,
                assignee TEXT,
                task_count INTEGER,
                due_date INTEGER,
                start_date INTEGER,
                folder_id TEXT,
                space_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        let completed = 0;
        queries.forEach(query => {
            db.run(query, (err) => {
                if (err) {
                    console.error('Table creation error:', err);
                    return reject(err);
                }
                completed++;
                if (completed === queries.length) {
                    console.log('✅ All tables initialized');
                    resolve();
                }
            });
        });
    });
}

// Fetch from ClickUp API
async function fetchClickUpData(endpoint) {
    const fetch = (await import('node-fetch')).default;
    
    try {
        console.log(`📡 Fetching: ${endpoint}`);
        const response = await fetch(`${CLICKUP_API_BASE}${endpoint}`, {
            headers: {
                'Authorization': CLICKUP_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log(`✅ Fetched data from ${endpoint}:`, Object.keys(data));
        return data;
    } catch (error) {
        console.error(`❌ Error fetching ${endpoint}:`, error.message);
        throw error;
    }
}

// Sync teams
async function syncTeams() {
    try {
        const data = await fetchClickUpData('/team');
        const teams = data.teams || [];
        
        console.log(`📥 Syncing ${teams.length} teams...`);
        
        for (const team of teams) {
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT OR REPLACE INTO clickup_teams (id, name, color, avatar) VALUES (?, ?, ?, ?)',
                    [team.id, team.name, team.color, team.avatar],
                    (err) => err ? reject(err) : resolve()
                );
            });
            
            // Sync team members
            if (team.members && team.members.length > 0) {
                console.log(`👥 Syncing ${team.members.length} members from team ${team.name}...`);
                
                for (const member of team.members) {
                    await new Promise((resolve, reject) => {
                        db.run(
                            'INSERT OR REPLACE INTO clickup_members (id, username, email, profilePicture, initials, color, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [
                                member.user.id,
                                member.user.username,
                                member.user.email,
                                member.user.profilePicture,
                                member.user.initials,
                                member.user.color,
                                1
                            ],
                            (err) => err ? reject(err) : resolve()
                        );
                    });
                }
            }
        }
        
        console.log(`✅ Teams and members synced successfully`);
        return teams;
    } catch (error) {
        console.error('❌ Error syncing teams:', error);
        throw error;
    }
}

// Sync spaces and lists
async function syncSpacesAndLists(teamId) {
    try {
        const spacesData = await fetchClickUpData(`/team/${teamId}/space?archived=false`);
        const spaces = spacesData.spaces || [];
        
        console.log(`📥 Syncing ${spaces.length} spaces...`);
        
        for (const space of spaces) {
            // Insert space
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT OR REPLACE INTO clickup_spaces (id, name, color, private) VALUES (?, ?, ?, ?)',
                    [space.id, space.name, space.color, space.private ? 1 : 0],
                    (err) => err ? reject(err) : resolve()
                );
            });
            
            // Get lists in space
            const listsData = await fetchClickUpData(`/space/${space.id}/list`);
            const lists = listsData.lists || [];
            
            console.log(`📋 Syncing ${lists.length} lists from space ${space.name}...`);
            
            for (const list of lists) {
                await new Promise((resolve, reject) => {
                    db.run(
                        'INSERT OR REPLACE INTO clickup_lists (id, name, orderindex, status, priority, assignee, task_count, due_date, start_date, space_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [
                            list.id,
                            list.name,
                            list.orderindex,
                            list.status,
                            list.priority?.priority || null,
                            list.assignee?.id || null,
                            list.task_count || 0,
                            list.due_date || null,
                            list.start_date || null,
                            space.id
                        ],
                        (err) => err ? reject(err) : resolve()
                    );
                });
            }
        }
        
        console.log(`✅ Spaces and lists synced successfully`);
        return spaces;
    } catch (error) {
        console.error('❌ Error syncing spaces and lists:', error);
        throw error;
    }
}

// Sync tasks from a list
async function syncTasksFromList(listId) {
    try {
        const tasksData = await fetchClickUpData(`/list/${listId}/task?archived=false`);
        const tasks = tasksData.tasks || [];
        
        console.log(`📋 Syncing ${tasks.length} tasks from list ${listId}...`);
        
        for (const task of tasks) {
            const assignee = task.assignees?.[0];
            
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT OR REPLACE INTO clickup_tasks (id, name, status, orderindex, date_created, date_updated, date_closed, assignee, assignee_id, assignee_username, assignee_email, priority, due_date, description, list_id, space_id, parent_id, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        task.id,
                        task.name,
                        task.status?.status || 'Open',
                        task.orderindex,
                        task.date_created ? parseInt(task.date_created) : null,
                        task.date_updated ? parseInt(task.date_updated) : null,
                        task.date_closed ? parseInt(task.date_closed) : null,
                        assignee?.username || null,
                        assignee?.id || null,
                        assignee?.username || null,
                        assignee?.email || null,
                        task.priority?.priority || null,
                        task.due_date || null,
                        task.description || null,
                        task.list?.id || listId,
                        task.space?.id || null,
                        task.parent || null,
                        task.url || null
                    ],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }
        
        return tasks.length;
    } catch (error) {
        console.error(`❌ Error syncing tasks from list ${listId}:`, error);
        return 0;
    }
}

// Main sync function
async function main() {
    console.log('🚀 Starting ClickUp Data Sync...');
    
    try {
        // Initialize database tables
        await initializeTables();
        
        // Sync teams and members
        const teams = await syncTeams();
        
        if (teams.length === 0) {
            console.log('❌ No teams found');
            return;
        }
        
        let totalTasks = 0;
        
        // For each team, sync spaces, lists, and tasks
        for (const team of teams) {
            console.log(`🏢 Processing team: ${team.name} (ID: ${team.id})`);
            
            const spaces = await syncSpacesAndLists(team.id);
            
            // Get all lists from database for this team's spaces
            const lists = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT id, name FROM clickup_lists WHERE space_id IN (SELECT id FROM clickup_spaces)',
                    (err, rows) => err ? reject(err) : resolve(rows)
                );
            });
            
            console.log(`📋 Found ${lists.length} lists to sync tasks from`);
            
            // Sync tasks from each list
            for (const list of lists) {
                const taskCount = await syncTasksFromList(list.id);
                totalTasks += taskCount;
                console.log(`  ✅ List "${list.name}": ${taskCount} tasks synced`);
            }
        }
        
        // Final statistics
        const stats = await new Promise((resolve, reject) => {
            db.get(
                'SELECT COUNT(*) as total_tasks, COUNT(CASE WHEN parent_id IS NULL THEN 1 END) as main_tasks, COUNT(CASE WHEN parent_id IS NOT NULL THEN 1 END) as sub_tasks FROM clickup_tasks',
                (err, row) => err ? reject(err) : resolve(row)
            );
        });
        
        console.log('\n📊 SYNC COMPLETE - STATISTICS:');
        console.log(`✅ Total Tasks: ${stats.total_tasks}`);
        console.log(`📋 Main Tasks: ${stats.main_tasks}`);
        console.log(`🔗 Sub Tasks: ${stats.sub_tasks}`);
        console.log(`👥 Teams: ${teams.length}`);
        
        if (stats.total_tasks > 0) {
            console.log('\n🎉 SUCCESS: Real ClickUp data synced successfully!');
        } else {
            console.log('\n⚠️  WARNING: No tasks were synced - check ClickUp API permissions');
        }
        
    } catch (error) {
        console.error('❌ SYNC FAILED:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

// Run the sync
main();