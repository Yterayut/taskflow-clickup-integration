-- Fix SQLite Schema for Assignment Compatibility
-- Add missing columns and fix constraints for ClickUp API v2
-- Date: 2025-08-09

BEGIN TRANSACTION;

-- 1. Add missing columns to clickup_tasks
ALTER TABLE clickup_tasks ADD COLUMN status_type TEXT DEFAULT 'custom';
ALTER TABLE clickup_tasks ADD COLUMN synced_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE clickup_tasks ADD COLUMN priority_orderindex INTEGER DEFAULT 0;
ALTER TABLE clickup_tasks ADD COLUMN status_orderindex INTEGER DEFAULT 0;

-- 2. Add parent column (ClickUp API uses 'parent' not 'parent_id')
ALTER TABLE clickup_tasks ADD COLUMN parent TEXT;

-- 3. Update parent column with parent_id values
UPDATE clickup_tasks SET parent = parent_id WHERE parent_id IS NOT NULL AND parent_id != '';

-- 4. Set default values for new columns
UPDATE clickup_tasks SET 
    synced_at = CURRENT_TIMESTAMP,
    status_type = 'custom'
WHERE synced_at IS NULL OR status_type IS NULL;

-- 5. Clear existing assignment table and rebuild
DELETE FROM clickup_task_assignments;

-- 6. Populate assignment table from current assignee_id
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
  AND t.assignee_id GLOB '[0-9]*'  -- Only numeric IDs
  AND EXISTS (SELECT 1 FROM clickup_members m WHERE m.id = CAST(t.assignee_id AS INTEGER));

COMMIT;