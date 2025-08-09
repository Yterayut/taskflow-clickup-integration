-- Apply Schema Optimization: Add missing columns to existing database
-- This script adds ClickUp API compatible columns without breaking existing data
-- Date: 2025-08-09

BEGIN;

-- 1. Add missing columns to clickup_tasks table (if not exists)
-- These columns are needed for ClickUp API compatibility

-- Status columns
ALTER TABLE clickup_tasks ADD COLUMN IF NOT EXISTS status_type VARCHAR(50);
ALTER TABLE clickup_tasks ADD COLUMN IF NOT EXISTS status_orderindex INTEGER;

-- Parent column (for subtasks) - rename from parent_id
ALTER TABLE clickup_tasks ADD COLUMN IF NOT EXISTS parent VARCHAR(50);

-- Sync tracking
ALTER TABLE clickup_tasks ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Priority orderindex
ALTER TABLE clickup_tasks ADD COLUMN IF NOT EXISTS priority_orderindex INTEGER;

-- 2. Create clickup_task_assignments table if not exists
-- This is the critical missing table for multiple assignees
CREATE TABLE IF NOT EXISTS clickup_task_assignments (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(50) NOT NULL,
    member_id BIGINT NOT NULL,
    assigned_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, member_id)
);

-- 3. Add foreign key constraints (with proper error handling)
-- Remove existing constraints first if they exist
DO $$ 
BEGIN
    -- Add foreign key for task assignments
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_task_assignments_task_id'
    ) THEN
        ALTER TABLE clickup_task_assignments 
        ADD CONSTRAINT fk_task_assignments_task_id 
        FOREIGN KEY (task_id) REFERENCES clickup_tasks(id) ON DELETE CASCADE;
    END IF;

    -- Add foreign key for member assignments
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_task_assignments_member_id'
    ) THEN
        ALTER TABLE clickup_task_assignments 
        ADD CONSTRAINT fk_task_assignments_member_id 
        FOREIGN KEY (member_id) REFERENCES clickup_members(id) ON DELETE CASCADE;
    END IF;

    -- Add foreign key for parent tasks (subtasks)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_tasks_parent'
    ) THEN
        ALTER TABLE clickup_tasks 
        ADD CONSTRAINT fk_tasks_parent 
        FOREIGN KEY (parent) REFERENCES clickup_tasks(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_synced_at ON clickup_tasks(synced_at);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_parent ON clickup_tasks(parent);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_status_type ON clickup_tasks(status_type);
CREATE INDEX IF NOT EXISTS idx_clickup_task_assignments_task_id ON clickup_task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_clickup_task_assignments_member_id ON clickup_task_assignments(member_id);

-- 5. Update existing data with default values
UPDATE clickup_tasks SET synced_at = CURRENT_TIMESTAMP WHERE synced_at IS NULL;
UPDATE clickup_tasks SET status_type = 'custom' WHERE status_type IS NULL AND status_name IS NOT NULL;

-- 6. Migrate existing single assignee to new assignment table
-- This handles the critical assignment migration
INSERT INTO clickup_task_assignments (task_id, member_id, assigned_at)
SELECT DISTINCT 
    t.id,
    t.assignee_id::BIGINT,
    CURRENT_TIMESTAMP
FROM clickup_tasks t
WHERE t.assignee_id IS NOT NULL 
  AND t.assignee_id != '' 
  AND t.assignee_id != '0'
  AND LENGTH(t.assignee_id) > 0
  AND t.assignee_id ~ '^[0-9]+$'  -- Only numeric IDs
  AND EXISTS (SELECT 1 FROM clickup_members m WHERE m.id = t.assignee_id::BIGINT)
  AND NOT EXISTS (SELECT 1 FROM clickup_task_assignments a WHERE a.task_id = t.id AND a.member_id = t.assignee_id::BIGINT)
ON CONFLICT (task_id, member_id) DO NOTHING;

-- 7. Show results
DO $$
DECLARE 
    task_count INTEGER;
    member_count INTEGER;
    assignment_count INTEGER;
    parent_task_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO task_count FROM clickup_tasks;
    SELECT COUNT(*) INTO member_count FROM clickup_members;
    SELECT COUNT(*) INTO assignment_count FROM clickup_task_assignments;
    SELECT COUNT(*) INTO parent_task_count FROM clickup_tasks WHERE parent IS NOT NULL;
    
    RAISE NOTICE 'Schema optimization completed:';
    RAISE NOTICE 'Total tasks: %', task_count;
    RAISE NOTICE 'Total members: %', member_count;
    RAISE NOTICE 'Task assignments: %', assignment_count;
    RAISE NOTICE 'Subtasks (with parent): %', parent_task_count;
END $$;

COMMIT;