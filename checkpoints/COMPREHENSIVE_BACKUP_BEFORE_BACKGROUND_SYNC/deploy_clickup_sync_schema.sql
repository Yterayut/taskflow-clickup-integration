-- ============================================================================
-- TaskFlow Pro - Phase 1 ClickUp Sync Schema Deployment
-- ============================================================================

-- This script deploys the ClickUp sync schema for Phase 1 implementation
-- Safe deployment with rollback capability and zero downtime

BEGIN;

-- Check if sync tables already exist (safety check)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clickup_sync_metadata') THEN
        RAISE NOTICE 'ClickUp sync tables already exist. Skipping deployment.';
    ELSE
        RAISE NOTICE 'Deploying ClickUp sync schema...';
    END IF;
END $$;

-- Create sync metadata table
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spaces Table
CREATE TABLE IF NOT EXISTS clickup_spaces (
    id VARCHAR(50) PRIMARY KEY, -- ClickUp space ID
    team_id VARCHAR(50) REFERENCES clickup_teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(10),
    avatar_url TEXT,
    private BOOLEAN DEFAULT false,
    archived BOOLEAN DEFAULT false,
    multiple_assignees BOOLEAN DEFAULT true,
    features JSONB, -- Store space features configuration
    statuses JSONB, -- Store custom statuses
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    clickup_created_at TIMESTAMP WITH TIME ZONE,
    clickup_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lists Table
CREATE TABLE IF NOT EXISTS clickup_lists (
    id VARCHAR(50) PRIMARY KEY, -- ClickUp list ID
    space_id VARCHAR(50) REFERENCES clickup_spaces(id) ON DELETE CASCADE,
    folder_id VARCHAR(50), -- Can be null for folderless lists
    name VARCHAR(255) NOT NULL,
    color VARCHAR(10),
    orderindex BIGINT,
    archived BOOLEAN DEFAULT false,
    permission_level VARCHAR(50),
    task_count INTEGER DEFAULT 0,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    clickup_created_at TIMESTAMP WITH TIME ZONE,
    clickup_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS clickup_tasks (
    id VARCHAR(50) PRIMARY KEY, -- ClickUp task ID
    list_id VARCHAR(50) REFERENCES clickup_lists(id) ON DELETE CASCADE,
    parent_id VARCHAR(50), -- For subtasks, references another task
    name VARCHAR(500) NOT NULL,
    description TEXT,
    status_id VARCHAR(50),
    status_name VARCHAR(100),
    status_color VARCHAR(10),
    status_type VARCHAR(20), -- open, custom, closed
    priority_id VARCHAR(10),
    priority_name VARCHAR(20),
    priority_color VARCHAR(10),
    assignee_ids TEXT[], -- Array of assignee IDs
    watcher_ids TEXT[], -- Array of watcher IDs
    creator_id VARCHAR(50),
    orderindex BIGINT,
    archived BOOLEAN DEFAULT false,
    date_created TIMESTAMP WITH TIME ZONE,
    date_updated TIMESTAMP WITH TIME ZONE,
    date_closed TIMESTAMP WITH TIME ZONE,
    date_done TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    start_date TIMESTAMP WITH TIME ZONE,
    time_estimate BIGINT, -- In milliseconds
    time_spent BIGINT, -- In milliseconds
    points DECIMAL,
    url TEXT,
    custom_fields JSONB,
    tags TEXT[],
    dependencies JSONB,
    linked_tasks JSONB,
    is_subtask BOOLEAN DEFAULT false,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Members Table
CREATE TABLE IF NOT EXISTS clickup_members (
    id VARCHAR(50) PRIMARY KEY, -- ClickUp user ID
    username VARCHAR(255),
    email VARCHAR(255),
    color VARCHAR(10),
    profile_picture TEXT,
    initials VARCHAR(10),
    role_id INTEGER,
    role_name VARCHAR(50),
    last_active TIMESTAMP WITH TIME ZONE,
    date_joined TIMESTAMP WITH TIME ZONE,
    date_invited TIMESTAMP WITH TIME ZONE,
    invited_by_id VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team Members Relationship Table
CREATE TABLE IF NOT EXISTS clickup_team_members (
    team_id VARCHAR(50) REFERENCES clickup_teams(id) ON DELETE CASCADE,
    member_id VARCHAR(50) REFERENCES clickup_members(id) ON DELETE CASCADE,
    role_key VARCHAR(50),
    custom_role VARCHAR(100),
    banned_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (team_id, member_id)
);

-- Sync Jobs Queue Table
CREATE TABLE IF NOT EXISTS clickup_sync_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL, -- full_sync, incremental_sync, team_sync, etc.
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed
    priority INTEGER DEFAULT 5, -- 1-10, 1 = highest priority
    payload JSONB,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_list_id ON clickup_tasks(list_id);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_parent_id ON clickup_tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_status_name ON clickup_tasks(status_name);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_assignee_ids ON clickup_tasks USING GIN(assignee_ids);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_due_date ON clickup_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_clickup_tasks_last_synced ON clickup_tasks(last_synced);
CREATE INDEX IF NOT EXISTS idx_clickup_members_email ON clickup_members(email);
CREATE INDEX IF NOT EXISTS idx_clickup_sync_jobs_status ON clickup_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_clickup_sync_jobs_scheduled_at ON clickup_sync_jobs(scheduled_at);

-- Insert initial sync metadata record
INSERT INTO clickup_sync_metadata (sync_status, created_at) 
VALUES ('pending', NOW()) 
ON CONFLICT DO NOTHING;

-- Performance optimization: Update statistics
ANALYZE clickup_teams;
ANALYZE clickup_spaces;
ANALYZE clickup_lists;
ANALYZE clickup_tasks;
ANALYZE clickup_members;

COMMIT;

-- Success notification
SELECT 'ClickUp Sync Schema Deployment: SUCCESS' as deployment_status,
       COUNT(*) as tables_created
FROM information_schema.tables 
WHERE table_name LIKE 'clickup_%';