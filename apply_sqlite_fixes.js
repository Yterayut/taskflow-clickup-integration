// Apply SQLite Schema Fixes using Node.js
const Database = require('better-sqlite3');
const fs = require('fs');

try {
    console.log('🔧 Applying SQLite schema fixes...');
    const db = new Database('taskflow.db');
    
    // Begin transaction
    db.exec('BEGIN TRANSACTION');
    
    console.log('1. Adding missing columns...');
    
    // Add columns one by one with error handling
    try {
        db.exec('ALTER TABLE clickup_tasks ADD COLUMN status_type TEXT DEFAULT "custom"');
        console.log('  ✅ Added status_type column');
    } catch(e) {
        if (!e.message.includes('duplicate column')) {
            console.log('  ⚠️ status_type column:', e.message);
        } else {
            console.log('  ✅ status_type column already exists');
        }
    }
    
    try {
        db.exec('ALTER TABLE clickup_tasks ADD COLUMN synced_at DATETIME DEFAULT CURRENT_TIMESTAMP');
        console.log('  ✅ Added synced_at column');
    } catch(e) {
        if (!e.message.includes('duplicate column')) {
            console.log('  ⚠️ synced_at column:', e.message);
        } else {
            console.log('  ✅ synced_at column already exists');
        }
    }
    
    try {
        db.exec('ALTER TABLE clickup_tasks ADD COLUMN parent TEXT');
        console.log('  ✅ Added parent column');
    } catch(e) {
        if (!e.message.includes('duplicate column')) {
            console.log('  ⚠️ parent column:', e.message);
        } else {
            console.log('  ✅ parent column already exists');
        }
    }
    
    console.log('2. Updating parent column with parent_id values...');
    const updateParent = db.prepare('UPDATE clickup_tasks SET parent = parent_id WHERE parent_id IS NOT NULL AND parent_id != ""');
    const parentResult = updateParent.run();
    console.log(`  ✅ Updated ${parentResult.changes} tasks with parent values`);
    
    console.log('3. Setting default values...');
    const updateDefaults = db.prepare('UPDATE clickup_tasks SET synced_at = CURRENT_TIMESTAMP, status_type = "custom" WHERE synced_at IS NULL OR status_type IS NULL');
    const defaultResult = updateDefaults.run();
    console.log(`  ✅ Updated ${defaultResult.changes} tasks with default values`);
    
    console.log('4. Checking existing assignments...');
    const existingAssignments = db.prepare('SELECT COUNT(*) as count FROM clickup_task_assignments').get();
    console.log(`  📊 Current assignments: ${existingAssignments.count}`);
    
    console.log('5. Clearing and rebuilding assignment table...');
    db.exec('DELETE FROM clickup_task_assignments');
    
    console.log('6. Populating assignment table from assignee_id...');
    const insertAssignments = db.prepare(`
        INSERT INTO clickup_task_assignments (task_id, member_id, assigned_at)
        SELECT DISTINCT 
            t.id,
            CAST(t.assignee_id AS INTEGER),
            CURRENT_TIMESTAMP
        FROM clickup_tasks t
        WHERE t.assignee_id IS NOT NULL 
          AND t.assignee_id != '' 
          AND t.assignee_id != '0'
          AND LENGTH(t.assignee_id) > 0
          AND t.assignee_id GLOB '[0-9]*'
          AND EXISTS (SELECT 1 FROM clickup_members m WHERE m.id = CAST(t.assignee_id AS INTEGER))
    `);
    
    const assignmentResult = insertAssignments.run();
    console.log(`  ✅ Created ${assignmentResult.changes} task assignments`);
    
    // Commit transaction
    db.exec('COMMIT');
    
    console.log('7. Verification...');
    const finalCounts = {
        tasks: db.prepare('SELECT COUNT(*) as count FROM clickup_tasks').get().count,
        members: db.prepare('SELECT COUNT(*) as count FROM clickup_members').get().count,
        assignments: db.prepare('SELECT COUNT(*) as count FROM clickup_task_assignments').get().count,
        tasksWithAssignee: db.prepare('SELECT COUNT(*) as count FROM clickup_tasks WHERE assignee_id IS NOT NULL AND assignee_id != ""').get().count,
        tasksWithParent: db.prepare('SELECT COUNT(*) as count FROM clickup_tasks WHERE parent IS NOT NULL').get().count
    };
    
    console.log('\n📊 Final Results:');
    console.log(`  📋 Tasks: ${finalCounts.tasks}`);
    console.log(`  👥 Members: ${finalCounts.members}`);
    console.log(`  🎯 Assignments: ${finalCounts.assignments}`);
    console.log(`  📝 Tasks with assignee_id: ${finalCounts.tasksWithAssignee}`);
    console.log(`  🔗 Subtasks (with parent): ${finalCounts.tasksWithParent}`);
    
    // Show sample assignments
    console.log('\n🎯 Sample Assignments:');
    const sampleAssignments = db.prepare(`
        SELECT 
            t.name as task_name,
            m.username as member_name,
            ta.assigned_at
        FROM clickup_task_assignments ta
        JOIN clickup_tasks t ON ta.task_id = t.id
        JOIN clickup_members m ON ta.member_id = m.id
        LIMIT 5
    `).all();
    
    sampleAssignments.forEach(assignment => {
        console.log(`  📌 "${assignment.task_name}" → ${assignment.member_name}`);
    });
    
    db.close();
    console.log('\n✅ SQLite schema fixes completed successfully!');
    
} catch(error) {
    console.error('❌ Error applying fixes:', error);
    process.exit(1);
}