// Check Current Database Schema Structure
const Database = require('better-sqlite3');

try {
    const db = new Database('taskflow.db');

    console.log('=== Checking Current SQLite Schema ===');
    const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='clickup_tasks'").get();
    console.log('Current schema:', schema?.sql);

    console.log('\n=== Checking for Assignment Columns ===');
    const columns = db.prepare('PRAGMA table_info(clickup_tasks)').all();
    const hasParent = columns.find(c => c.name === 'parent');
    const hasParentId = columns.find(c => c.name === 'parent_id');
    const hasAssigneeId = columns.find(c => c.name === 'assignee_id');
    const hasSyncedAt = columns.find(c => c.name === 'synced_at');
    const hasStatusType = columns.find(c => c.name === 'status_type');
    
    console.log('Has parent column:', !!hasParent);
    console.log('Has parent_id column:', !!hasParentId);
    console.log('Has assignee_id column:', !!hasAssigneeId);
    console.log('Has synced_at column:', !!hasSyncedAt);
    console.log('Has status_type column:', !!hasStatusType);

    console.log('\n=== Checking Assignment Table ===');
    try {
        const assignments = db.prepare('SELECT COUNT(*) as count FROM clickup_task_assignments').get();
        console.log('Assignment table exists, records:', assignments.count);
    } catch(e) {
        console.log('Assignment table does not exist:', e.message);
    }

    console.log('\n=== Checking Current Data ===');
    const taskCount = db.prepare('SELECT COUNT(*) as count FROM clickup_tasks').get();
    const memberCount = db.prepare('SELECT COUNT(*) as count FROM clickup_members').get();
    const tasksWithAssignee = db.prepare('SELECT COUNT(*) as count FROM clickup_tasks WHERE assignee_id IS NOT NULL AND assignee_id != ""').get();
    
    console.log('Total tasks:', taskCount.count);
    console.log('Total members:', memberCount.count);
    console.log('Tasks with assignee_id:', tasksWithAssignee.count);

    console.log('\n=== Sample Task Data ===');
    const sampleTasks = db.prepare('SELECT id, name, assignee_id FROM clickup_tasks WHERE assignee_id IS NOT NULL LIMIT 3').all();
    sampleTasks.forEach(task => {
        console.log(`Task: ${task.name} -> assignee_id: ${task.assignee_id}`);
    });

    db.close();
    console.log('\n✅ Schema check completed');

} catch(error) {
    console.error('❌ Error checking schema:', error.message);
    process.exit(1);
}