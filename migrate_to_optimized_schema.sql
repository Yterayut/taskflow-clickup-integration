-- Migration Script: Current Schema → ClickUp Optimized Schema
-- REAL DATA ONLY - No Demo Data Migration
-- Date: 2025-08-09

BEGIN;

-- Backup existing data before migration
CREATE TABLE IF NOT EXISTS migration_backup_clickup_tasks AS SELECT * FROM clickup_tasks;
CREATE TABLE IF NOT EXISTS migration_backup_clickup_members AS SELECT * FROM clickup_members;
CREATE TABLE IF NOT EXISTS migration_backup_clickup_teams AS SELECT * FROM clickup_teams;
CREATE TABLE IF NOT EXISTS migration_backup_clickup_spaces AS SELECT * FROM clickup_spaces;
CREATE TABLE IF NOT EXISTS migration_backup_clickup_lists AS SELECT * FROM clickup_lists;

-- 1. Create new optimized schema (if not exists)
-- Include the full schema from clickup_optimized_schema.sql here
-- (Schema creation code would be included here)

-- 2. Migrate Teams (existing data)
INSERT INTO clickup_teams (id, name, color, avatar, created_at, updated_at, synced_at)
SELECT DISTINCT 
    id, 
    name, 
    color,
    avatar,
    COALESCE(created_at, CURRENT_TIMESTAMP),
    COALESCE(updated_at, CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM migration_backup_clickup_teams
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    color = EXCLUDED.color,
    avatar = EXCLUDED.avatar,
    updated_at = CURRENT_TIMESTAMP,
    synced_at = CURRENT_TIMESTAMP;

-- 3. Migrate Members (existing data)
INSERT INTO clickup_members (id, username, email, color, initials, profile_picture, role, is_active, team_id, created_at, updated_at, synced_at)
SELECT DISTINCT 
    id::BIGINT,
    username,
    email,
    color,
    initials,
    profile_picture,
    COALESCE(role, 'Member'),
    COALESCE(is_active, true),
    team_id,
    COALESCE(created_at, CURRENT_TIMESTAMP),
    COALESCE(updated_at, CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM migration_backup_clickup_members
WHERE id IS NOT NULL AND id != ''
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    color = EXCLUDED.color,
    initials = EXCLUDED.initials,
    profile_picture = EXCLUDED.profile_picture,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    team_id = EXCLUDED.team_id,
    updated_at = CURRENT_TIMESTAMP,
    synced_at = CURRENT_TIMESTAMP;

-- 4. Migrate Spaces (existing data)
INSERT INTO clickup_spaces (id, name, color, private, avatar, team_id, created_at, updated_at, synced_at)
SELECT DISTINCT 
    id,
    name,
    color,
    COALESCE(private, false),
    avatar,
    team_id,
    COALESCE(created_at, CURRENT_TIMESTAMP),
    COALESCE(updated_at, CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM migration_backup_clickup_spaces
WHERE id IS NOT NULL AND id != ''
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    color = EXCLUDED.color,
    private = EXCLUDED.private,
    avatar = EXCLUDED.avatar,
    team_id = EXCLUDED.team_id,
    updated_at = CURRENT_TIMESTAMP,
    synced_at = CURRENT_TIMESTAMP;

-- 5. Migrate Lists (existing data)
INSERT INTO clickup_lists (id, name, orderindex, status, task_count, space_id, folder_id, folder_name, archived, created_at, updated_at, synced_at)
SELECT DISTINCT 
    id,
    name,
    COALESCE(orderindex, 0),
    status,
    COALESCE(task_count, 0),
    space_id,
    folder_id,
    folder_name,
    COALESCE(archived, false),
    COALESCE(created_at, CURRENT_TIMESTAMP),
    COALESCE(updated_at, CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM migration_backup_clickup_lists
WHERE id IS NOT NULL AND id != ''
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    orderindex = EXCLUDED.orderindex,
    status = EXCLUDED.status,
    task_count = EXCLUDED.task_count,
    space_id = EXCLUDED.space_id,
    folder_id = EXCLUDED.folder_id,
    folder_name = EXCLUDED.folder_name,
    archived = EXCLUDED.archived,
    updated_at = CURRENT_TIMESTAMP,
    synced_at = CURRENT_TIMESTAMP;

-- 6. Migrate Tasks (existing data with new structure)
INSERT INTO clickup_tasks (
    id, name, description, 
    status_id, status_name, status_color,
    priority_id, priority_name, priority_color,
    creator_id, parent,
    team_id, space_id, list_id, list_name, folder_id, folder_name, space_name,
    date_created, date_updated, date_closed, date_done, due_date, start_date,
    time_estimate, time_spent, points, url, text_content,
    watchers, tags, custom_fields, dependencies, linked_tasks,
    archived, created_at, updated_at, synced_at
)
SELECT DISTINCT
    t.id,
    t.name,
    t.description,
    t.status_id,
    t.status_name,
    t.status_color,
    t.priority_id,
    t.priority_name,
    t.priority_color,
    CASE 
        WHEN t.creator_id IS NOT NULL AND t.creator_id != '' 
        THEN t.creator_id::BIGINT 
        ELSE NULL 
    END,
    CASE 
        WHEN t.parent_id IS NOT NULL AND t.parent_id != '' 
        THEN t.parent_id 
        ELSE NULL 
    END,
    t.team_id,
    t.space_id,
    t.list_id,
    t.list_name,
    t.folder_id,
    t.folder_name,
    t.space_name,
    t.date_created,
    t.date_updated,
    t.date_closed,
    t.date_done,
    t.due_date,
    t.start_date,
    t.time_estimate,
    t.time_spent,
    t.points,
    t.url,
    t.text_content,
    t.watchers,
    t.tags,
    t.custom_fields,
    t.dependencies,
    t.linked_tasks,
    COALESCE(t.archived, false),
    COALESCE(t.created_at, CURRENT_TIMESTAMP),
    COALESCE(t.updated_at, CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM migration_backup_clickup_tasks t
WHERE t.id IS NOT NULL AND t.id != ''
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    status_id = EXCLUDED.status_id,
    status_name = EXCLUDED.status_name,
    status_color = EXCLUDED.status_color,
    priority_id = EXCLUDED.priority_id,
    priority_name = EXCLUDED.priority_name,
    priority_color = EXCLUDED.priority_color,
    creator_id = EXCLUDED.creator_id,
    parent = EXCLUDED.parent,
    team_id = EXCLUDED.team_id,
    space_id = EXCLUDED.space_id,
    list_id = EXCLUDED.list_id,
    list_name = EXCLUDED.list_name,
    folder_id = EXCLUDED.folder_id,
    folder_name = EXCLUDED.folder_name,
    space_name = EXCLUDED.space_name,
    date_created = EXCLUDED.date_created,
    date_updated = EXCLUDED.date_updated,
    date_closed = EXCLUDED.date_closed,
    date_done = EXCLUDED.date_done,
    due_date = EXCLUDED.due_date,
    start_date = EXCLUDED.start_date,
    time_estimate = EXCLUDED.time_estimate,
    time_spent = EXCLUDED.time_spent,
    points = EXCLUDED.points,
    url = EXCLUDED.url,
    text_content = EXCLUDED.text_content,
    watchers = EXCLUDED.watchers,
    tags = EXCLUDED.tags,
    custom_fields = EXCLUDED.custom_fields,
    dependencies = EXCLUDED.dependencies,
    linked_tasks = EXCLUDED.linked_tasks,
    archived = EXCLUDED.archived,
    updated_at = CURRENT_TIMESTAMP,
    synced_at = CURRENT_TIMESTAMP;

-- 7. Create task assignments based on existing assignee_id (if any)
-- This handles the old single-assignee system to new multi-assignee system
INSERT INTO clickup_task_assignments (task_id, member_id, assigned_at)
SELECT DISTINCT 
    t.id,
    t.assignee_id::BIGINT,
    CURRENT_TIMESTAMP
FROM migration_backup_clickup_tasks t
WHERE t.assignee_id IS NOT NULL 
  AND t.assignee_id != '' 
  AND t.assignee_id != '0'
  AND EXISTS (SELECT 1 FROM clickup_members m WHERE m.id = t.assignee_id::BIGINT)
ON CONFLICT (task_id, member_id) DO NOTHING;

-- 8. Log migration results
DO $$
DECLARE 
    task_count INTEGER;
    member_count INTEGER;
    team_count INTEGER;
    space_count INTEGER;
    list_count INTEGER;
    assignment_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO task_count FROM clickup_tasks;
    SELECT COUNT(*) INTO member_count FROM clickup_members;
    SELECT COUNT(*) INTO team_count FROM clickup_teams;
    SELECT COUNT(*) INTO space_count FROM clickup_spaces;
    SELECT COUNT(*) INTO list_count FROM clickup_lists;
    SELECT COUNT(*) INTO assignment_count FROM clickup_task_assignments;
    
    RAISE NOTICE 'Migration completed successfully:';
    RAISE NOTICE 'Tasks migrated: %', task_count;
    RAISE NOTICE 'Members migrated: %', member_count;
    RAISE NOTICE 'Teams migrated: %', team_count;
    RAISE NOTICE 'Spaces migrated: %', space_count;
    RAISE NOTICE 'Lists migrated: %', list_count;
    RAISE NOTICE 'Task assignments created: %', assignment_count;
END $$;

-- 9. Update statistics
ANALYZE clickup_tasks;
ANALYZE clickup_members;
ANALYZE clickup_teams;
ANALYZE clickup_spaces;
ANALYZE clickup_lists;
ANALYZE clickup_task_assignments;

COMMIT;