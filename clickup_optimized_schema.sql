-- ClickUp Optimized PostgreSQL Schema
-- Designed based on ClickUp API v2 Documentation
-- Supports: Tasks, Subtasks, Multiple Assignees, Members, Workspaces

-- 1. ClickUp Teams/Workspaces
CREATE TABLE IF NOT EXISTS clickup_teams (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7),
    avatar VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. ClickUp Members (Users)
CREATE TABLE IF NOT EXISTS clickup_members (
    id BIGINT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    color VARCHAR(7),
    initials VARCHAR(10),
    profile_picture VARCHAR(500),
    role VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    team_id VARCHAR(50) REFERENCES clickup_teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. ClickUp Spaces
CREATE TABLE IF NOT EXISTS clickup_spaces (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7),
    private BOOLEAN DEFAULT FALSE,
    avatar VARCHAR(500),
    admin_can_manage BOOLEAN DEFAULT TRUE,
    statuses JSONB,
    multiple_assignees BOOLEAN DEFAULT TRUE,
    features JSONB,
    team_id VARCHAR(50) REFERENCES clickup_teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. ClickUp Lists
CREATE TABLE IF NOT EXISTS clickup_lists (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    orderindex INTEGER DEFAULT 0,
    status VARCHAR(50),
    priority JSONB,
    assignee BIGINT REFERENCES clickup_members(id),
    task_count INTEGER DEFAULT 0,
    due_date BIGINT,
    start_date BIGINT,
    space_id VARCHAR(50) REFERENCES clickup_spaces(id) ON DELETE CASCADE,
    folder_id VARCHAR(50),
    folder_name VARCHAR(255),
    archived BOOLEAN DEFAULT FALSE,
    override_statuses BOOLEAN DEFAULT FALSE,
    permission_level VARCHAR(50),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. ClickUp Tasks (Main and Subtasks)
CREATE TABLE IF NOT EXISTS clickup_tasks (
    id VARCHAR(50) PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Status Information
    status_id VARCHAR(50),
    status_name VARCHAR(255),
    status_color VARCHAR(7),
    status_type VARCHAR(50),
    status_orderindex INTEGER,
    
    -- Priority Information
    priority_id VARCHAR(50),
    priority_name VARCHAR(50),
    priority_color VARCHAR(7),
    priority_orderindex INTEGER,
    
    -- Assignment & Ownership
    creator_id BIGINT REFERENCES clickup_members(id),
    
    -- Hierarchy (Parent-Child for Subtasks)
    parent VARCHAR(50) REFERENCES clickup_tasks(id) ON DELETE CASCADE,
    
    -- Location in ClickUp
    team_id VARCHAR(50) REFERENCES clickup_teams(id) ON DELETE CASCADE,
    space_id VARCHAR(50) REFERENCES clickup_spaces(id) ON DELETE CASCADE,
    list_id VARCHAR(50) REFERENCES clickup_lists(id) ON DELETE CASCADE,
    list_name VARCHAR(255),
    folder_id VARCHAR(50),
    folder_name VARCHAR(255),
    space_name VARCHAR(255),
    
    -- Timestamps (ClickUp uses milliseconds since epoch)
    date_created BIGINT,
    date_updated BIGINT,
    date_closed BIGINT,
    date_done BIGINT,
    due_date BIGINT,
    start_date BIGINT,
    
    -- Time Tracking
    time_estimate BIGINT,
    time_spent BIGINT,
    
    -- Additional Data
    points NUMERIC(10,2),
    url TEXT,
    text_content TEXT,
    
    -- JSON Fields for Complex Data
    watchers JSONB,
    tags JSONB,
    custom_fields JSONB,
    dependencies JSONB,
    linked_tasks JSONB,
    sharing JSONB,
    
    -- Archive Status
    archived BOOLEAN DEFAULT FALSE,
    
    -- System Timestamps
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Task Assignments (Many-to-Many)
-- Handle multiple assignees per task
CREATE TABLE IF NOT EXISTS clickup_task_assignments (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(50) REFERENCES clickup_tasks(id) ON DELETE CASCADE,
    member_id BIGINT REFERENCES clickup_members(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, member_id)
);

-- 7. Task Dependencies
CREATE TABLE IF NOT EXISTS clickup_task_dependencies (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(50) REFERENCES clickup_tasks(id) ON DELETE CASCADE,
    depends_on_task_id VARCHAR(50) REFERENCES clickup_tasks(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) DEFAULT 'blocking',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, depends_on_task_id)
);

-- 8. Task Comments/Activities
CREATE TABLE IF NOT EXISTS clickup_task_comments (
    id BIGINT PRIMARY KEY,
    task_id VARCHAR(50) REFERENCES clickup_tasks(id) ON DELETE CASCADE,
    comment_text TEXT,
    comment_type VARCHAR(50),
    user_id BIGINT REFERENCES clickup_members(id),
    assigned_by BIGINT REFERENCES clickup_members(id),
    resolved BOOLEAN DEFAULT FALSE,
    date BIGINT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_team_id ON clickup_tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_space_id ON clickup_tasks(space_id);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_list_id ON clickup_tasks(list_id);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_parent ON clickup_tasks(parent);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_creator_id ON clickup_tasks(creator_id);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_status_name ON clickup_tasks(status_name);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_priority_name ON clickup_tasks(priority_name);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_date_created ON clickup_tasks(date_created);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_date_updated ON clickup_tasks(date_updated);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_due_date ON clickup_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_archived ON clickup_tasks(archived);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_synced_at ON clickup_tasks(synced_at);

-- Assignment indexes
CREATE INDEX IF NOT EXISTS idx_clickup_task_assignments_task_id ON clickup_task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_clickup_task_assignments_member_id ON clickup_task_assignments(member_id);

-- Member indexes  
CREATE INDEX IF NOT EXISTS idx_clickup_members_email ON clickup_members(email);
CREATE INDEX IF NOT EXISTS idx_clickup_members_team_id ON clickup_members(team_id);
CREATE INDEX IF NOT EXISTS idx_clickup_members_is_active ON clickup_members(is_active);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_team_status ON clickup_tasks(team_id, status_name);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_team_priority ON clickup_tasks(team_id, priority_name);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_assignee_status ON clickup_task_assignments(member_id, task_id);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_name_fts ON clickup_tasks USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_description_fts ON clickup_tasks USING gin(to_tsvector('english', description));

-- Update triggers for timestamp maintenance
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clickup_tasks_updated_at BEFORE UPDATE ON clickup_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clickup_members_updated_at BEFORE UPDATE ON clickup_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clickup_teams_updated_at BEFORE UPDATE ON clickup_teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clickup_spaces_updated_at BEFORE UPDATE ON clickup_spaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clickup_lists_updated_at BEFORE UPDATE ON clickup_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();