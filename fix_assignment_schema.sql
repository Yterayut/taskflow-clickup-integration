-- Fix Assignment Schema for SQLite Database
-- Add clickup_task_assignments table for many-to-many relationships

-- 1. Create clickup_task_assignments table
CREATE TABLE IF NOT EXISTS clickup_task_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    member_name TEXT,
    member_email TEXT,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, member_id),
    FOREIGN KEY (task_id) REFERENCES clickup_tasks(id) ON DELETE CASCADE
);

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id ON clickup_task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_member_id ON clickup_task_assignments(member_id);

-- 3. Migrate existing assignments from clickup_tasks to clickup_task_assignments
INSERT OR IGNORE INTO clickup_task_assignments (task_id, member_id, member_name)
SELECT 
    id as task_id,
    assignee_id as member_id, 
    assignee as member_name
FROM clickup_tasks 
WHERE assignee_id IS NOT NULL AND assignee_id != '';

-- 4. Create view for backward compatibility
CREATE VIEW IF NOT EXISTS task_assignments_view AS
SELECT 
    t.id,
    t.name,
    t.status,
    t.priority,
    t.due_date,
    GROUP_CONCAT(ta.member_name, ', ') as assignees,
    GROUP_CONCAT(ta.member_id, ', ') as assignee_ids,
    COUNT(ta.member_id) as assignee_count
FROM clickup_tasks t
LEFT JOIN clickup_task_assignments ta ON t.id = ta.task_id
GROUP BY t.id, t.name, t.status, t.priority, t.due_date;