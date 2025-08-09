-- ClickUp Local Database Sync Schema
-- สำหรับเก็บข้อมูล ClickUp ในระบบ local เพื่อประสิทธิภาพและความเร็ว
-- Version: 1.0.0

-- Drop existing ClickUp sync tables if they exist
DROP TABLE IF EXISTS clickup_task_members CASCADE;
DROP TABLE IF EXISTS clickup_task_dependencies CASCADE;
DROP TABLE IF EXISTS clickup_tasks CASCADE;
DROP TABLE IF EXISTS clickup_members CASCADE;
DROP TABLE IF EXISTS clickup_teams CASCADE;
DROP TABLE IF EXISTS clickup_sync_status CASCADE;

-- ClickUp Teams table (สำหรับเก็บข้อมูล workspace/team)
CREATE TABLE clickup_teams (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7),
    avatar TEXT,
    member_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ClickUp Members table (สำหรับเก็บข้อมูลสมาชิกในทีม)
CREATE TABLE clickup_members (
    id BIGINT PRIMARY KEY,
    team_id VARCHAR(50) REFERENCES clickup_teams(id) ON DELETE CASCADE,
    username VARCHAR(255),
    email VARCHAR(255),
    color VARCHAR(7),
    profile_picture TEXT,
    initials VARCHAR(10),
    role INTEGER,
    role_subtype INTEGER,
    role_key VARCHAR(50),
    custom_role VARCHAR(255),
    last_active BIGINT,
    date_joined BIGINT,
    date_invited BIGINT,
    invited_by_id BIGINT,
    invited_by_username VARCHAR(255),
    invited_by_email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ClickUp Tasks table (สำหรับเก็บข้อมูล tasks ทั้งหมด)
CREATE TABLE clickup_tasks (
    id VARCHAR(50) PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status_id VARCHAR(50),
    status_name VARCHAR(255),
    status_color VARCHAR(7),
    priority_id VARCHAR(50),
    priority_name VARCHAR(50),
    priority_color VARCHAR(7),
    assignee_id BIGINT REFERENCES clickup_members(id),
    creator_id BIGINT REFERENCES clickup_members(id),
    team_id VARCHAR(50) REFERENCES clickup_teams(id) ON DELETE CASCADE,
    list_id VARCHAR(50),
    list_name VARCHAR(255),
    folder_id VARCHAR(50),
    folder_name VARCHAR(255),
    space_id VARCHAR(50),
    space_name VARCHAR(255),
    date_created BIGINT,
    date_updated BIGINT,
    date_closed BIGINT,
    date_done BIGINT,
    due_date BIGINT,
    start_date BIGINT,
    time_estimate BIGINT,
    time_spent BIGINT,
    points DECIMAL(10,2),
    url TEXT,
    watchers JSONB,
    tags JSONB,
    custom_fields JSONB,
    subtasks JSONB,
    dependencies JSONB,
    linked_tasks JSONB,
    archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ClickUp Task Members junction table (many-to-many สำหรับ assignees)
CREATE TABLE clickup_task_members (
    task_id VARCHAR(50) REFERENCES clickup_tasks(id) ON DELETE CASCADE,
    member_id BIGINT REFERENCES clickup_members(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'assignee',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, member_id)
);

-- ClickUp Task Dependencies table (สำหรับเก็บความสัมพันธ์ระหว่าง tasks)
CREATE TABLE clickup_task_dependencies (
    task_id VARCHAR(50) REFERENCES clickup_tasks(id) ON DELETE CASCADE,
    depends_on_task_id VARCHAR(50) REFERENCES clickup_tasks(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) DEFAULT 'blocking',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, depends_on_task_id)
);

-- ClickUp Sync Status table (สำหรับติดตาม sync status)
CREATE TABLE clickup_sync_status (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(50) NOT NULL, -- 'teams', 'members', 'tasks', 'full_sync'
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    total_records INTEGER,
    synced_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    error_message TEXT,
    sync_duration_ms INTEGER,
    clickup_api_calls INTEGER DEFAULT 0,
    last_sync_token VARCHAR(255),
    next_sync_scheduled TIMESTAMP,
    created_by VARCHAR(255) DEFAULT 'system'
);

-- Performance Indexes
CREATE INDEX idx_clickup_teams_name ON clickup_teams(name);
CREATE INDEX idx_clickup_teams_synced_at ON clickup_teams(synced_at);

CREATE INDEX idx_clickup_members_team_id ON clickup_members(team_id);
CREATE INDEX idx_clickup_members_email ON clickup_members(email);
CREATE INDEX idx_clickup_members_role_key ON clickup_members(role_key);
CREATE INDEX idx_clickup_members_synced_at ON clickup_members(synced_at);

CREATE INDEX idx_clickup_tasks_team_id ON clickup_tasks(team_id);
CREATE INDEX idx_clickup_tasks_assignee_id ON clickup_tasks(assignee_id);
CREATE INDEX idx_clickup_tasks_status_name ON clickup_tasks(status_name);
CREATE INDEX idx_clickup_tasks_priority_name ON clickup_tasks(priority_name);
CREATE INDEX idx_clickup_tasks_date_created ON clickup_tasks(date_created);
CREATE INDEX idx_clickup_tasks_date_updated ON clickup_tasks(date_updated);
CREATE INDEX idx_clickup_tasks_due_date ON clickup_tasks(due_date);
CREATE INDEX idx_clickup_tasks_archived ON clickup_tasks(archived);
CREATE INDEX idx_clickup_tasks_synced_at ON clickup_tasks(synced_at);

CREATE INDEX idx_clickup_sync_status_type ON clickup_sync_status(sync_type);
CREATE INDEX idx_clickup_sync_status_status ON clickup_sync_status(status);
CREATE INDEX idx_clickup_sync_status_started_at ON clickup_sync_status(started_at);
CREATE INDEX idx_clickup_sync_next_sync ON clickup_sync_status(next_sync_scheduled);

-- Full-text search indexes
CREATE INDEX idx_clickup_tasks_name_fts ON clickup_tasks USING gin(to_tsvector('english', name));
CREATE INDEX idx_clickup_tasks_description_fts ON clickup_tasks USING gin(to_tsvector('english', description));

-- Composite indexes for common queries
CREATE INDEX idx_clickup_tasks_team_status ON clickup_tasks(team_id, status_name);
CREATE INDEX idx_clickup_tasks_assignee_status ON clickup_tasks(assignee_id, status_name);
CREATE INDEX idx_clickup_tasks_team_priority ON clickup_tasks(team_id, priority_name);

-- Add updated_at trigger for all ClickUp tables
CREATE TRIGGER update_clickup_teams_updated_at BEFORE UPDATE ON clickup_teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clickup_members_updated_at BEFORE UPDATE ON clickup_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clickup_tasks_updated_at BEFORE UPDATE ON clickup_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE VIEW v_team_task_summary AS
SELECT 
    t.id as team_id,
    t.name as team_name,
    COUNT(DISTINCT tm.id) as total_members,
    COUNT(DISTINCT CASE WHEN tk.archived = false THEN tk.id END) as active_tasks,
    COUNT(DISTINCT CASE WHEN tk.status_name = 'Complete' THEN tk.id END) as completed_tasks,
    COUNT(DISTINCT CASE WHEN tk.due_date IS NOT NULL AND tk.due_date < EXTRACT(epoch FROM NOW()) * 1000 AND tk.status_name != 'Complete' THEN tk.id END) as overdue_tasks,
    AVG(CASE WHEN tk.status_name = 'Complete' AND tk.time_spent > 0 THEN tk.time_spent END) as avg_completion_time
FROM clickup_teams t
LEFT JOIN clickup_members tm ON t.id = tm.team_id
LEFT JOIN clickup_tasks tk ON t.id = tk.team_id
GROUP BY t.id, t.name;

CREATE VIEW v_member_workload AS
SELECT 
    m.id as member_id,
    m.username,
    m.email,
    m.team_id,
    COUNT(DISTINCT tk.id) as total_tasks,
    COUNT(DISTINCT CASE WHEN tk.status_name != 'Complete' AND tk.archived = false THEN tk.id END) as active_tasks,
    COUNT(DISTINCT CASE WHEN tk.status_name = 'Complete' THEN tk.id END) as completed_tasks,
    COUNT(DISTINCT CASE WHEN tk.due_date IS NOT NULL AND tk.due_date < EXTRACT(epoch FROM NOW()) * 1000 AND tk.status_name != 'Complete' THEN tk.id END) as overdue_tasks,
    SUM(CASE WHEN tk.time_estimate > 0 THEN tk.time_estimate END) as total_estimated_time,
    SUM(CASE WHEN tk.time_spent > 0 THEN tk.time_spent END) as total_time_spent
FROM clickup_members m
LEFT JOIN clickup_tasks tk ON m.id = tk.assignee_id
GROUP BY m.id, m.username, m.email, m.team_id;

-- Comments for documentation
COMMENT ON TABLE clickup_teams IS 'ClickUp workspace/team data synced from ClickUp API';
COMMENT ON TABLE clickup_members IS 'ClickUp team members data synced from ClickUp API';
COMMENT ON TABLE clickup_tasks IS 'ClickUp tasks data synced from ClickUp API with full task details';
COMMENT ON TABLE clickup_task_members IS 'Many-to-many relationship for task assignees';
COMMENT ON TABLE clickup_task_dependencies IS 'Task dependency relationships';
COMMENT ON TABLE clickup_sync_status IS 'Track sync operations and status for monitoring';

COMMENT ON VIEW v_team_task_summary IS 'Summary view of team performance and task statistics';
COMMENT ON VIEW v_member_workload IS 'Individual member workload and performance metrics';

-- Data retention policy (optional - remove old sync logs after 30 days)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('clickup-sync-cleanup', '0 2 * * *', 'DELETE FROM clickup_sync_status WHERE completed_at < NOW() - INTERVAL ''30 days'';');