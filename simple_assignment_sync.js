// Simple Assignment Sync - Fix the Query Issue
const Database = require('better-sqlite3');

try {
    console.log('🔧 Starting simple assignment sync...');
    const db = new Database('taskflow.db');
    
    console.log('1. Checking current state...');
    const taskCount = db.prepare('SELECT COUNT(*) as count FROM clickup_tasks').get();
    const memberCount = db.prepare('SELECT COUNT(*) as count FROM clickup_members').get();
    const currentAssignments = db.prepare('SELECT COUNT(*) as count FROM clickup_task_assignments').get();
    
    console.log(`  📋 Tasks: ${taskCount.count}`);
    console.log(`  👥 Members: ${memberCount.count}`);
    console.log(`  🎯 Current assignments: ${currentAssignments.count}`);
    
    console.log('2. Adding missing columns safely...');
    try {
        db.exec('ALTER TABLE clickup_tasks ADD COLUMN synced_at DATETIME');
        console.log('  ✅ Added synced_at column');
    } catch(e) {
        console.log('  ✅ synced_at column already exists or added');
    }
    
    console.log('3. Updating synced_at values...');
    const updateSynced = db.prepare('UPDATE clickup_tasks SET synced_at = CURRENT_TIMESTAMP WHERE synced_at IS NULL');
    const syncedResult = updateSynced.run();
    console.log(`  ✅ Updated ${syncedResult.changes} tasks with sync timestamp`);
    
    console.log('4. Updating parent column...');
    const updateParent = db.prepare('UPDATE clickup_tasks SET parent = parent_id WHERE parent_id IS NOT NULL AND parent_id != ? AND parent IS NULL');
    const parentResult = updateParent.run('');
    console.log(`  ✅ Updated ${parentResult.changes} tasks with parent values`);
    
    console.log('5. Clearing existing assignments...');
    db.exec('DELETE FROM clickup_task_assignments');
    
    console.log('6. Finding tasks with assignee_id...');
    const tasksWithAssignee = db.prepare('SELECT id, name, assignee_id FROM clickup_tasks WHERE assignee_id IS NOT NULL AND assignee_id != ?').all('');
    console.log(`  📋 Found ${tasksWithAssignee.length} tasks with assignee_id`);
    
    console.log('7. Inserting assignments one by one...');
    const insertAssignment = db.prepare('INSERT INTO clickup_task_assignments (task_id, member_id, assigned_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const task of tasksWithAssignee) {
        try {
            // Check if member exists
            const memberExists = db.prepare('SELECT COUNT(*) as count FROM clickup_members WHERE id = ?').get(parseInt(task.assignee_id));
            
            if (memberExists.count > 0) {
                insertAssignment.run(task.id, parseInt(task.assignee_id));
                console.log(`  ✅ Assigned "${task.name}" to member ${task.assignee_id}`);
                successCount++;
            } else {
                console.log(`  ⚠️ Member ${task.assignee_id} not found for task "${task.name}"`);
                errorCount++;
            }
        } catch (e) {
            console.log(`  ❌ Error assigning task "${task.name}": ${e.message}`);
            errorCount++;
        }
    }
    
    console.log('8. Final verification...');
    const finalAssignments = db.prepare('SELECT COUNT(*) as count FROM clickup_task_assignments').get();
    const assignmentDetails = db.prepare(`
        SELECT 
            t.name as task_name,
            m.username as member_name,
            ta.member_id
        FROM clickup_task_assignments ta
        JOIN clickup_tasks t ON ta.task_id = t.id
        JOIN clickup_members m ON ta.member_id = m.id
        LIMIT 10
    `).all();
    
    console.log('\n📊 Final Results:');
    console.log(`  🎯 Total assignments created: ${finalAssignments.count}`);
    console.log(`  ✅ Successful assignments: ${successCount}`);
    console.log(`  ❌ Failed assignments: ${errorCount}`);
    
    console.log('\n🎯 Sample Assignments:');
    assignmentDetails.forEach(assignment => {
        console.log(`  📌 "${assignment.task_name}" → ${assignment.member_name} (ID: ${assignment.member_id})`);
    });
    
    db.close();
    console.log('\n✅ Simple assignment sync completed!');
    
} catch(error) {
    console.error('❌ Error in assignment sync:', error);
    process.exit(1);
}