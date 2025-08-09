-- Performance Optimization for TaskFlow Pro PostgreSQL Database
-- Add advanced indexes and query optimization
-- Date: 2025-08-09

BEGIN;

-- 1. Advanced Composite Indexes for Common Queries
-- Dashboard analytics optimization
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_analytics ON clickup_tasks(archived, status_name, priority_name);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_completion ON clickup_tasks(archived, date_updated, status_name) WHERE status_name ILIKE '%complete%' OR status_name ILIKE '%done%';

-- Assignment queries optimization  
CREATE INDEX IF NOT EXISTS idx_clickup_task_assignments_member_task ON clickup_task_assignments(member_id, task_id);
CREATE INDEX IF NOT EXISTS idx_clickup_task_assignments_with_tasks ON clickup_task_assignments(task_id, member_id, assigned_at);

-- Team performance optimization
CREATE INDEX IF NOT EXISTS idx_clickup_members_active ON clickup_members(is_active, id) WHERE is_active = true;

-- Task filtering optimization
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_status_updated ON clickup_tasks(status_name, date_updated DESC, archived) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_priority_updated ON clickup_tasks(priority_name, date_updated DESC, archived) WHERE archived = false;

-- 2. Full-text Search Optimization
-- Task name and description search
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_name_gin ON clickup_tasks USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_description_gin ON clickup_tasks USING gin(to_tsvector('english', coalesce(description, '')));

-- Combined search index
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_fulltext ON clickup_tasks USING gin(
    (setweight(to_tsvector('english', name), 'A') || setweight(to_tsvector('english', coalesce(description, '')), 'B'))
);

-- 3. Date/Time Query Optimization
-- Recent activity queries
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_recent_activity ON clickup_tasks(date_updated DESC) 
WHERE archived = false AND date_updated IS NOT NULL;

-- Due date tracking
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_due_date ON clickup_tasks(due_date, status_name) 
WHERE archived = false AND due_date IS NOT NULL;

-- 4. Hierarchy and Relationship Optimization
-- Parent-child relationships (subtasks)
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_hierarchy ON clickup_tasks(parent, id) WHERE parent IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_main_tasks ON clickup_tasks(id, name, status_name) WHERE parent IS NULL;

-- Space and list relationships
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_space_list ON clickup_tasks(space_id, list_id, archived);

-- 5. Partial Indexes for Common Filters
-- Active tasks only
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_active ON clickup_tasks(id, name, status_name, date_updated DESC) 
WHERE archived = false;

-- In-progress tasks
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_in_progress ON clickup_tasks(id, name, assigned_at) 
WHERE archived = false AND status_name ILIKE '%progress%';

-- High priority tasks
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_high_priority ON clickup_tasks(id, name, priority_name, due_date) 
WHERE archived = false AND priority_name IN ('urgent', 'high');

-- 6. Analytics and Reporting Optimization
-- Status distribution queries
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_status_stats ON clickup_tasks(status_name, status_color) 
WHERE archived = false AND status_name IS NOT NULL;

-- Priority distribution queries  
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_priority_stats ON clickup_tasks(priority_name, priority_color) 
WHERE archived = false AND priority_name IS NOT NULL;

-- Member assignment statistics
CREATE INDEX IF NOT EXISTS idx_assignment_stats ON clickup_task_assignments(member_id) 
INCLUDE (task_id, assigned_at);

-- 7. Maintenance and Statistics Update
-- Update table statistics for query planner
ANALYZE clickup_tasks;
ANALYZE clickup_members;
ANALYZE clickup_task_assignments;
ANALYZE clickup_teams;
ANALYZE clickup_spaces;
ANALYZE clickup_lists;

-- 8. Create Materialized View for Dashboard (Optional)
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_stats AS
SELECT 
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status_name ILIKE '%complete%' OR status_name ILIKE '%done%' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN status_name ILIKE '%progress%' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN parent IS NOT NULL THEN 1 END) as subtasks,
    COUNT(CASE WHEN parent IS NULL THEN 1 END) as main_tasks,
    (SELECT COUNT(*) FROM clickup_members WHERE is_active = true) as active_members,
    (SELECT COUNT(*) FROM clickup_task_assignments) as total_assignments,
    CURRENT_TIMESTAMP as last_updated
FROM clickup_tasks 
WHERE archived = false;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_stats_unique ON dashboard_stats(last_updated);

-- 9. Function for Refreshing Materialized View
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- 10. Index Usage Monitoring
-- Create function to check index usage
CREATE OR REPLACE FUNCTION get_index_usage_stats()
RETURNS TABLE(
    schemaname text,
    tablename text,
    indexname text,
    idx_scans bigint,
    idx_tup_read bigint,
    idx_tup_fetch bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname::text,
        s.tablename::text,
        s.indexname::text,
        s.idx_scan,
        s.idx_tup_read,
        s.idx_tup_fetch
    FROM pg_stat_user_indexes s
    WHERE s.schemaname = 'public'
    ORDER BY s.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Performance Tips:
-- 1. Run VACUUM ANALYZE regularly to maintain statistics
-- 2. Monitor index usage with get_index_usage_stats()
-- 3. Refresh dashboard_stats materialized view periodically
-- 4. Consider partitioning if data grows beyond 1M records