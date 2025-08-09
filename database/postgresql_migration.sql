-- TaskFlow Pro PostgreSQL Migration Schema
-- Migration from SQLite to PostgreSQL for production database

-- Enable UUID extension for ID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table with enhanced PostgreSQL features
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255),
    role VARCHAR(50) DEFAULT 'Employee',
    permissions JSONB DEFAULT '["dashboard","analytics"]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ClickUp Teams table
CREATE TABLE clickup_teams (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(10),
    avatar TEXT,
    members JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ClickUp Spaces table
CREATE TABLE clickup_spaces (
    id VARCHAR(255) PRIMARY KEY,
    team_id VARCHAR(255) REFERENCES clickup_teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(10),
    private BOOLEAN DEFAULT FALSE,
    statuses JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ClickUp Lists table
CREATE TABLE clickup_lists (
    id VARCHAR(255) PRIMARY KEY,
    space_id VARCHAR(255) REFERENCES clickup_spaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50),
    task_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ClickUp Tasks table with hierarchical support
CREATE TABLE clickup_tasks (
    id VARCHAR(255) PRIMARY KEY,
    list_id VARCHAR(255) REFERENCES clickup_lists(id) ON DELETE CASCADE,
    parent_id VARCHAR(255) REFERENCES clickup_tasks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status VARCHAR(50),
    priority INTEGER,
    assignees JSONB DEFAULT '[]'::jsonb,
    due_date TIMESTAMPTZ,
    time_estimate INTEGER,
    time_spent INTEGER DEFAULT 0,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ClickUp Members table
CREATE TABLE clickup_members (
    id VARCHAR(255) PRIMARY KEY,
    team_id VARCHAR(255) REFERENCES clickup_teams(id) ON DELETE CASCADE,
    username VARCHAR(255),
    email VARCHAR(255),
    color VARCHAR(10),
    profile_picture TEXT,
    initials VARCHAR(5),
    role INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Sync metadata for background service tracking
CREATE TABLE sync_metadata (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(100),
    last_sync_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    records_synced INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes for optimal query performance
CREATE INDEX idx_clickup_tasks_status ON clickup_tasks(status);
CREATE INDEX idx_clickup_tasks_parent_id ON clickup_tasks(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_clickup_tasks_due_date ON clickup_tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_clickup_tasks_assignees ON clickup_tasks USING GIN(assignees);
CREATE INDEX idx_clickup_tasks_list_id ON clickup_tasks(list_id);
CREATE INDEX idx_clickup_members_team_id ON clickup_members(team_id);
CREATE INDEX idx_clickup_members_email ON clickup_members(email);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sync_metadata_type_time ON sync_metadata(sync_type, last_sync_time DESC);

-- Update trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clickup_teams_updated_at BEFORE UPDATE ON clickup_teams 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clickup_spaces_updated_at BEFORE UPDATE ON clickup_spaces 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clickup_lists_updated_at BEFORE UPDATE ON clickup_lists 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clickup_tasks_updated_at BEFORE UPDATE ON clickup_tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clickup_members_updated_at BEFORE UPDATE ON clickup_members 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Initial user data (migrate from existing config)
INSERT INTO users (email, name, role, permissions) VALUES
('yterayut@gmail.com', 'Teerayut Yeerahem', 'Admin', '["all"]'),
('chaiwutwck@gmail.com', 'ชัยวุฒิ ไวเชิงค้า', 'Manager', '["dashboard","analytics","team","projects"]')
ON CONFLICT (email) DO NOTHING;