-- ============================================================================
-- TaskFlow Pro - ClickUp Local Sync Database Schema
-- ============================================================================

-- Sync Metadata Table
CREATE TABLE IF NOT EXISTS clickup_sync_metadata (
    id SERIAL PRIMARY KEY,
    last_full_sync TIMESTAMP WITH TIME ZONE,
    last_incremental_sync TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'pending', -- pending, syncing, completed, error
    sync_errors JSONB,
    total_teams INTEGER DEFAULT 0,
    total_spaces INTEGER DEFAULT 0,
    total_tasks INTEGER DEFAULT 0,
    total_members INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams/Workspaces Table
CREATE TABLE IF NOT EXISTS clickup_teams (
    id VARCHAR(50) PRIMARY KEY, -- ClickUp team ID
    name VARCHAR(255) NOT NULL,
    color VARCHAR(10),
    avatar_url TEXT,
    member_count INTEGER DEFAULT 0,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    clickup_created_at TIMESTAMP WITH TIME ZONE,
    clickup_updated_at TIMESTAMP WITH TIME ZONE,
    local_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    local_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spaces Table
CREATE TABLE IF NOT EXISTS clickup_spaces (
    id VARCHAR(50) PRIMARY KEY, -- ClickUp space ID
    team_id VARCHAR(50) REFERENCES clickup_teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(10),
    avatar_url TEXT,
    private BOOLEAN DEFAULT false,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    clickup_created_at TIMESTAMP WITH TIME ZONE,
    clickup_updated_at TIMESTAMP WITH TIME ZONE,
    local_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    local_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lists Table (ภายใต้ spaces)
CREATE TABLE IF NOT EXISTS clickup_lists (
    id VARCHAR(50) PRIMARY KEY, -- ClickUp list ID
    space_id VARCHAR(50) REFERENCES clickup_spaces(id) ON DELETE CASCADE,
    folder_id VARCHAR(50), -- nullable for folderless lists
    name VARCHAR(255) NOT NULL,
    color VARCHAR(10),
    status VARCHAR(50),
    priority INTEGER,
    assignee_id VARCHAR(50),
    task_count INTEGER DEFAULT 0,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    clickup_created_at TIMESTAMP WITH TIME ZONE,
    clickup_updated_at TIMESTAMP WITH TIME ZONE,
    local_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    local_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Members Table
CREATE TABLE IF NOT EXISTS clickup_members (
    id VARCHAR(50) PRIMARY KEY, -- ClickUp user ID
    username VARCHAR(255),
    email VARCHAR(255),
    color VARCHAR(10),
    initials VARCHAR(10),
    role_key VARCHAR(50),
    role_subtype INTEGER,
    profile_picture_url TEXT,
    last_active TIMESTAMP WITH TIME ZONE,
    date_joined TIMESTAMP WITH TIME ZONE,
    date_invited TIMESTAMP WITH TIME ZONE,
    
    -- Task statistics (calculated locally)
    tasks_total INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_in_progress INTEGER DEFAULT 0,
    tasks_overdue INTEGER DEFAULT 0,
    
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    local_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    local_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks Table (Main table)
CREATE TABLE IF NOT EXISTS clickup_tasks (
    id VARCHAR(50) PRIMARY KEY, -- ClickUp task ID
    list_id VARCHAR(50) REFERENCES clickup_lists(id) ON DELETE CASCADE,
    space_id VARCHAR(50) REFERENCES clickup_spaces(id) ON DELETE CASCADE,
    team_id VARCHAR(50) REFERENCES clickup_teams(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    description TEXT,
    status_type VARCHAR(50), -- open, closed, custom
    status_name VARCHAR(255),
    status_color VARCHAR(10),
    
    priority_id VARCHAR(50),
    priority_name VARCHAR(100),
    priority_value INTEGER,
    priority_color VARCHAR(10),
    
    due_date TIMESTAMP WITH TIME ZONE,
    start_date TIMESTAMP WITH TIME ZONE,
    time_estimate BIGINT, -- milliseconds
    time_spent BIGINT, -- milliseconds
    
    creator_id VARCHAR(50),
    
    -- Hierarchy
    parent_id VARCHAR(50), -- for subtasks
    is_subtask BOOLEAN DEFAULT false,
    subtask_count INTEGER DEFAULT 0,
    
    -- URLs and external references
    url TEXT,
    custom_id VARCHAR(100),
    
    -- Metadata
    archived BOOLEAN DEFAULT false,
    folder_id VARCHAR(50),
    
    -- Timestamps
    clickup_date_created TIMESTAMP WITH TIME ZONE,
    clickup_date_updated TIMESTAMP WITH TIME ZONE,
    clickup_date_closed TIMESTAMP WITH TIME ZONE,
    
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    local_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    local_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task Assignees Junction Table
CREATE TABLE IF NOT EXISTS clickup_task_assignees (
    task_id VARCHAR(50) REFERENCES clickup_tasks(id) ON DELETE CASCADE,
    member_id VARCHAR(50) REFERENCES clickup_members(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (task_id, member_id)
);

-- Team Members Junction Table
CREATE TABLE IF NOT EXISTS clickup_team_members (
    team_id VARCHAR(50) REFERENCES clickup_teams(id) ON DELETE CASCADE,
    member_id VARCHAR(50) REFERENCES clickup_members(id) ON DELETE CASCADE,
    invited_by_id VARCHAR(50),
    role_key VARCHAR(50),
    custom_role_name VARCHAR(255),
    joined_at TIMESTAMP WITH TIME ZONE,
    invited_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    PRIMARY KEY (team_id, member_id)
);

-- Workload Statistics Table (calculated/cached data)
CREATE TABLE IF NOT EXISTS clickup_workload_stats (
    id SERIAL PRIMARY KEY,
    team_id VARCHAR(50) REFERENCES clickup_teams(id) ON DELETE CASCADE,
    
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    in_progress_tasks INTEGER DEFAULT 0,
    overdue_tasks INTEGER DEFAULT 0,
    
    total_members INTEGER DEFAULT 0,
    active_members INTEGER DEFAULT 0,
    
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Recent Activities Table
CREATE TABLE IF NOT EXISTS clickup_recent_activities (
    id SERIAL PRIMARY KEY,
    activity_type VARCHAR(50), -- task_completed, task_updated, task_created, etc.
    user_id VARCHAR(50),
    user_name VARCHAR(255),
    description TEXT,
    task_id VARCHAR(50),
    task_name TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE,
    
    team_id VARCHAR(50) REFERENCES clickup_teams(id) ON DELETE CASCADE,
    space_id VARCHAR(50),
    list_id VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync Jobs Queue Table
CREATE TABLE IF NOT EXISTS clickup_sync_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50), -- full_sync, incremental_sync, team_sync, task_sync
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed
    priority INTEGER DEFAULT 0, -- higher number = higher priority
    
    entity_type VARCHAR(50), -- team, space, list, task, member
    entity_id VARCHAR(50),
    
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    metadata JSONB
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_list_id ON clickup_tasks(list_id);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_space_id ON clickup_tasks(space_id);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_team_id ON clickup_tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_status ON clickup_tasks(status_type, status_name);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_due_date ON clickup_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_updated ON clickup_tasks(clickup_date_updated);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_active ON clickup_tasks(is_active);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_parent ON clickup_tasks(parent_id);

-- Task assignees indexes
CREATE INDEX IF NOT EXISTS idx_clickup_task_assignees_member ON clickup_task_assignees(member_id);
CREATE INDEX IF NOT EXISTS idx_clickup_task_assignees_task ON clickup_task_assignees(task_id);

-- Members indexes
CREATE INDEX IF NOT EXISTS idx_clickup_members_email ON clickup_members(email);
CREATE INDEX IF NOT EXISTS idx_clickup_members_active ON clickup_members(is_active);

-- Sync jobs indexes
CREATE INDEX IF NOT EXISTS idx_clickup_sync_jobs_status ON clickup_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_clickup_sync_jobs_type ON clickup_sync_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_clickup_sync_jobs_scheduled ON clickup_sync_jobs(scheduled_at);

-- Recent activities indexes  
CREATE INDEX IF NOT EXISTS idx_clickup_activities_team ON clickup_recent_activities(team_id);
CREATE INDEX IF NOT EXISTS idx_clickup_activities_time ON clickup_recent_activities(occurred_at);
CREATE INDEX IF NOT EXISTS idx_clickup_activities_user ON clickup_recent_activities(user_id);

-- ============================================================================
-- TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- ============================================================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_local_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.local_updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all main tables
CREATE TRIGGER tr_clickup_teams_updated_at
    BEFORE UPDATE ON clickup_teams
    FOR EACH ROW EXECUTE FUNCTION update_local_updated_at();

CREATE TRIGGER tr_clickup_spaces_updated_at
    BEFORE UPDATE ON clickup_spaces
    FOR EACH ROW EXECUTE FUNCTION update_local_updated_at();

CREATE TRIGGER tr_clickup_lists_updated_at
    BEFORE UPDATE ON clickup_lists
    FOR EACH ROW EXECUTE FUNCTION update_local_updated_at();

CREATE TRIGGER tr_clickup_members_updated_at
    BEFORE UPDATE ON clickup_members
    FOR EACH ROW EXECUTE FUNCTION update_local_updated_at();

CREATE TRIGGER tr_clickup_tasks_updated_at
    BEFORE UPDATE ON clickup_tasks
    FOR EACH ROW EXECUTE FUNCTION update_local_updated_at();

-- ============================================================================
-- VIEWS FOR EASY DATA ACCESS
-- ============================================================================

-- Complete task information with assignees
CREATE OR REPLACE VIEW v_clickup_tasks_complete AS
SELECT 
    t.*,
    array_agg(DISTINCT m.username) as assignee_names,
    array_agg(DISTINCT m.email) as assignee_emails,
    COUNT(DISTINCT ta.member_id) as assignee_count
FROM clickup_tasks t
LEFT JOIN clickup_task_assignees ta ON t.id = ta.task_id
LEFT JOIN clickup_members m ON ta.member_id = m.id
WHERE t.is_active = true
GROUP BY t.id;

-- Team statistics view
CREATE OR REPLACE VIEW v_clickup_team_stats AS
SELECT 
    t.id as team_id,
    t.name as team_name,
    COUNT(DISTINCT s.id) as spaces_count,
    COUNT(DISTINCT l.id) as lists_count,
    COUNT(DISTINCT tk.id) as tasks_total,
    COUNT(DISTINCT CASE WHEN tk.status_type = 'closed' THEN tk.id END) as tasks_completed,
    COUNT(DISTINCT CASE WHEN tk.status_type != 'closed' AND tk.due_date < NOW() THEN tk.id END) as tasks_overdue,
    COUNT(DISTINCT CASE WHEN tk.status_type != 'closed' AND (tk.due_date IS NULL OR tk.due_date >= NOW()) THEN tk.id END) as tasks_in_progress,
    COUNT(DISTINCT tm.member_id) as members_count
FROM clickup_teams t
LEFT JOIN clickup_spaces s ON t.id = s.team_id AND s.is_active = true
LEFT JOIN clickup_lists l ON s.id = l.space_id AND l.is_active = true
LEFT JOIN clickup_tasks tk ON t.id = tk.team_id AND tk.is_active = true
LEFT JOIN clickup_team_members tm ON t.id = tm.team_id AND tm.is_active = true
WHERE t.is_active = true
GROUP BY t.id, t.name;

-- Member workload view
CREATE OR REPLACE VIEW v_clickup_member_workload AS
SELECT 
    m.id as member_id,
    m.username,
    m.email,
    COUNT(DISTINCT ta.task_id) as total_assigned_tasks,
    COUNT(DISTINCT CASE WHEN t.status_type = 'closed' THEN ta.task_id END) as completed_tasks,
    COUNT(DISTINCT CASE WHEN t.status_type != 'closed' AND t.due_date < NOW() THEN ta.task_id END) as overdue_tasks,
    COUNT(DISTINCT CASE WHEN t.status_type != 'closed' AND (t.due_date IS NULL OR t.due_date >= NOW()) THEN ta.task_id END) as in_progress_tasks
FROM clickup_members m
LEFT JOIN clickup_task_assignees ta ON m.id = ta.member_id
LEFT JOIN clickup_tasks t ON ta.task_id = t.id AND t.is_active = true
WHERE m.is_active = true
GROUP BY m.id, m.username, m.email;

-- Insert initial sync metadata record
INSERT INTO clickup_sync_metadata (sync_status) 
VALUES ('pending') 
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE clickup_sync_metadata IS 'Tracks sync status and metadata for ClickUp data synchronization';
COMMENT ON TABLE clickup_teams IS 'Local copy of ClickUp teams/workspaces';
COMMENT ON TABLE clickup_spaces IS 'Local copy of ClickUp spaces within teams';
COMMENT ON TABLE clickup_lists IS 'Local copy of ClickUp lists within spaces';
COMMENT ON TABLE clickup_members IS 'Local copy of ClickUp team members with task statistics';
COMMENT ON TABLE clickup_tasks IS 'Local copy of ClickUp tasks with complete metadata';
COMMENT ON TABLE clickup_task_assignees IS 'Junction table for task-member assignments';
COMMENT ON TABLE clickup_team_members IS 'Junction table for team-member relationships';
COMMENT ON TABLE clickup_workload_stats IS 'Cached workload statistics for performance';
COMMENT ON TABLE clickup_recent_activities IS 'Recent activities extracted from task updates';
COMMENT ON TABLE clickup_sync_jobs IS 'Queue for managing sync operations';