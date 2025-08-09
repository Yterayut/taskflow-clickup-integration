-- TaskFlow Pro: Enhanced Database Schema for Background Sync
-- Phase 2: Local Database Enhancement
-- Created: August 7, 2025

-- ==================================================
-- SYNC METADATA TABLES
-- ==================================================

-- Main sync metadata tracking
CREATE TABLE IF NOT EXISTS sync_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    last_sync_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sync_status VARCHAR(50) DEFAULT 'pending',
    priority_level VARCHAR(20) DEFAULT 'medium',
    error_count INTEGER DEFAULT 0,
    next_sync_time TIMESTAMP,
    data_freshness_minutes INTEGER DEFAULT 0,
    records_synced INTEGER DEFAULT 0,
    sync_duration_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(table_name)
);

-- Sync performance logging
CREATE TABLE IF NOT EXISTS sync_performance_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_type VARCHAR(50) NOT NULL,
    priority_level VARCHAR(20) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    duration_ms INTEGER NOT NULL,
    records_synced INTEGER DEFAULT 0,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    error_count INTEGER DEFAULT 0,
    memory_usage_mb INTEGER,
    cpu_usage_percent DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================================================
-- CACHED DATA TABLES
-- ==================================================

-- Dashboard data cache for different user roles
CREATE TABLE IF NOT EXISTS cached_dashboard_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_role VARCHAR(50) NOT NULL,
    data_type VARCHAR(100) NOT NULL,
    cached_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    data_size_bytes INTEGER DEFAULT 0,
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_role, data_type)
);

-- Task data cache (high priority)
CREATE TABLE IF NOT EXISTS cached_tasks (
    id VARCHAR(255) PRIMARY KEY,
    clickup_id VARCHAR(255) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status JSONB,
    priority JSONB,
    assignees JSONB DEFAULT '[]',
    due_date TIMESTAMP,
    start_date TIMESTAMP,
    created_date TIMESTAMP,
    updated_date TIMESTAMP,
    list_id VARCHAR(255),
    space_id VARCHAR(255),
    team_id VARCHAR(255),
    parent_task_id VARCHAR(255),
    is_subtask BOOLEAN DEFAULT FALSE,
    time_estimate INTEGER,
    time_spent INTEGER,
    tags JSONB DEFAULT '[]',
    custom_fields JSONB DEFAULT '{}',
    url TEXT,
    archived BOOLEAN DEFAULT FALSE,
    sync_status VARCHAR(50) DEFAULT 'synced',
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team/Space data cache (medium priority)
CREATE TABLE IF NOT EXISTS cached_spaces (
    id VARCHAR(255) PRIMARY KEY,
    clickup_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7),
    avatar TEXT,
    private BOOLEAN DEFAULT FALSE,
    archived BOOLEAN DEFAULT FALSE,
    team_id VARCHAR(255),
    features JSONB DEFAULT '{}',
    statuses JSONB DEFAULT '[]',
    multiple_assignees BOOLEAN DEFAULT TRUE,
    task_count INTEGER DEFAULT 0,
    sync_status VARCHAR(50) DEFAULT 'synced',
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- List data cache (medium priority)  
CREATE TABLE IF NOT EXISTS cached_lists (
    id VARCHAR(255) PRIMARY KEY,
    clickup_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7),
    space_id VARCHAR(255),
    folder_id VARCHAR(255),
    orderindex INTEGER DEFAULT 0,
    archived BOOLEAN DEFAULT FALSE,
    permission_level VARCHAR(50),
    task_count INTEGER DEFAULT 0,
    sync_status VARCHAR(50) DEFAULT 'synced',
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team members cache (medium priority)
CREATE TABLE IF NOT EXISTS cached_members (
    id VARCHAR(255) PRIMARY KEY,
    clickup_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255),
    email VARCHAR(255),
    color VARCHAR(7),
    profile_picture TEXT,
    initials VARCHAR(10),
    role VARCHAR(100),
    role_key VARCHAR(100),
    last_active TIMESTAMP,
    date_joined TIMESTAMP,
    date_invited TIMESTAMP,
    invited_by VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    team_ids JSONB DEFAULT '[]',
    sync_status VARCHAR(50) DEFAULT 'synced',
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teams cache (low priority)
CREATE TABLE IF NOT EXISTS cached_teams (
    id VARCHAR(255) PRIMARY KEY,
    clickup_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7),
    avatar TEXT,
    member_count INTEGER DEFAULT 0,
    date_created TIMESTAMP,
    date_updated TIMESTAMP,
    sync_status VARCHAR(50) DEFAULT 'synced',
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================================================
-- CACHE PERFORMANCE TABLES
-- ==================================================

-- Cache access statistics
CREATE TABLE IF NOT EXISTS cache_access_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    access_type VARCHAR(50) NOT NULL, -- 'hit', 'miss', 'write', 'evict'
    user_role VARCHAR(50),
    response_time_ms INTEGER,
    data_size_bytes INTEGER,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cache_key VARCHAR(255)
);

-- Data freshness tracking
CREATE TABLE IF NOT EXISTS data_freshness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    data_type VARCHAR(100) NOT NULL,
    last_update TIMESTAMP NOT NULL,
    staleness_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_update)) / 60
    ) STORED,
    is_stale BOOLEAN GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_update)) / 60 > 10
    ) STORED,
    priority_level VARCHAR(20) DEFAULT 'medium',
    max_staleness_minutes INTEGER DEFAULT 10,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(table_name, data_type)
);

-- ==================================================
-- INDEXES FOR PERFORMANCE
-- ==================================================

-- Sync metadata indexes
CREATE INDEX IF NOT EXISTS idx_sync_metadata_table_name ON sync_metadata(table_name);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_status ON sync_metadata(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_priority ON sync_metadata(priority_level);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_next_sync ON sync_metadata(next_sync_time);

-- Performance log indexes
CREATE INDEX IF NOT EXISTS idx_sync_performance_type ON sync_performance_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_performance_time ON sync_performance_log(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sync_performance_success ON sync_performance_log(success);

-- Dashboard cache indexes
CREATE INDEX IF NOT EXISTS idx_cached_dashboard_role ON cached_dashboard_data(user_role);
CREATE INDEX IF NOT EXISTS idx_cached_dashboard_expires ON cached_dashboard_data(expires_at);
CREATE INDEX IF NOT EXISTS idx_cached_dashboard_accessed ON cached_dashboard_data(last_accessed DESC);

-- Task cache indexes
CREATE INDEX IF NOT EXISTS idx_cached_tasks_status ON cached_tasks USING GIN(status);
CREATE INDEX IF NOT EXISTS idx_cached_tasks_assignees ON cached_tasks USING GIN(assignees);
CREATE INDEX IF NOT EXISTS idx_cached_tasks_due_date ON cached_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_cached_tasks_updated ON cached_tasks(updated_date DESC);
CREATE INDEX IF NOT EXISTS idx_cached_tasks_list ON cached_tasks(list_id);
CREATE INDEX IF NOT EXISTS idx_cached_tasks_space ON cached_tasks(space_id);
CREATE INDEX IF NOT EXISTS idx_cached_tasks_sync_status ON cached_tasks(sync_status);
CREATE INDEX IF NOT EXISTS idx_cached_tasks_last_synced ON cached_tasks(last_synced DESC);

-- Space cache indexes
CREATE INDEX IF NOT EXISTS idx_cached_spaces_team ON cached_spaces(team_id);
CREATE INDEX IF NOT EXISTS idx_cached_spaces_archived ON cached_spaces(archived);
CREATE INDEX IF NOT EXISTS idx_cached_spaces_sync_status ON cached_spaces(sync_status);

-- List cache indexes
CREATE INDEX IF NOT EXISTS idx_cached_lists_space ON cached_lists(space_id);
CREATE INDEX IF NOT EXISTS idx_cached_lists_folder ON cached_lists(folder_id);
CREATE INDEX IF NOT EXISTS idx_cached_lists_archived ON cached_lists(archived);

-- Member cache indexes
CREATE INDEX IF NOT EXISTS idx_cached_members_email ON cached_members(email);
CREATE INDEX IF NOT EXISTS idx_cached_members_role ON cached_members(role);
CREATE INDEX IF NOT EXISTS idx_cached_members_status ON cached_members(status);
CREATE INDEX IF NOT EXISTS idx_cached_members_team_ids ON cached_members USING GIN(team_ids);

-- Cache stats indexes
CREATE INDEX IF NOT EXISTS idx_cache_access_table ON cache_access_stats(table_name);
CREATE INDEX IF NOT EXISTS idx_cache_access_type ON cache_access_stats(access_type);
CREATE INDEX IF NOT EXISTS idx_cache_access_time ON cache_access_stats(accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_access_role ON cache_access_stats(user_role);

-- Data freshness indexes
CREATE INDEX IF NOT EXISTS idx_data_freshness_table ON data_freshness(table_name);
CREATE INDEX IF NOT EXISTS idx_data_freshness_stale ON data_freshness(is_stale);
CREATE INDEX IF NOT EXISTS idx_data_freshness_staleness ON data_freshness(staleness_minutes);

-- ==================================================
-- FUNCTIONS AND TRIGGERS
-- ==================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_sync_metadata_updated_at BEFORE UPDATE ON sync_metadata 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cached_tasks_updated_at BEFORE UPDATE ON cached_tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cached_spaces_updated_at BEFORE UPDATE ON cached_spaces 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cached_lists_updated_at BEFORE UPDATE ON cached_lists 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cached_members_updated_at BEFORE UPDATE ON cached_members 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cached_teams_updated_at BEFORE UPDATE ON cached_teams 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up old cache data
CREATE OR REPLACE FUNCTION cleanup_old_cache_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired dashboard cache
    DELETE FROM cached_dashboard_data WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old performance logs (keep last 30 days)
    DELETE FROM sync_performance_log WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    -- Delete old cache access stats (keep last 7 days)
    DELETE FROM cache_access_stats WHERE accessed_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- INITIAL DATA
-- ==================================================

-- Insert initial sync metadata for each table
INSERT INTO sync_metadata (table_name, priority_level, max_staleness_minutes) VALUES
    ('cached_tasks', 'high', 5),
    ('cached_spaces', 'medium', 15),
    ('cached_lists', 'medium', 15),
    ('cached_members', 'medium', 30),
    ('cached_teams', 'low', 60)
ON CONFLICT (table_name) DO NOTHING;

-- Insert initial data freshness tracking
INSERT INTO data_freshness (table_name, data_type, last_update, priority_level, max_staleness_minutes) VALUES
    ('cached_tasks', 'task_data', CURRENT_TIMESTAMP, 'high', 5),
    ('cached_spaces', 'space_data', CURRENT_TIMESTAMP, 'medium', 15),
    ('cached_lists', 'list_data', CURRENT_TIMESTAMP, 'medium', 15),
    ('cached_members', 'member_data', CURRENT_TIMESTAMP, 'medium', 30),
    ('cached_teams', 'team_data', CURRENT_TIMESTAMP, 'low', 60),
    ('cached_dashboard_data', 'dashboard_cache', CURRENT_TIMESTAMP, 'high', 5)
ON CONFLICT (table_name, data_type) DO NOTHING;

-- ==================================================
-- VIEWS FOR EASY ACCESS
-- ==================================================

-- View for sync status overview
CREATE OR REPLACE VIEW sync_status_overview AS
SELECT 
    sm.table_name,
    sm.priority_level,
    sm.sync_status,
    sm.last_sync_time,
    sm.next_sync_time,
    sm.error_count,
    sm.records_synced,
    sm.sync_duration_ms,
    df.staleness_minutes,
    df.is_stale,
    CASE 
        WHEN df.is_stale THEN 'STALE'
        WHEN sm.sync_status = 'error' THEN 'ERROR'
        WHEN sm.sync_status = 'syncing' THEN 'SYNCING'
        ELSE 'HEALTHY'
    END as overall_status
FROM sync_metadata sm
LEFT JOIN data_freshness df ON sm.table_name = df.table_name AND df.data_type LIKE '%_data';

-- View for cache performance metrics
CREATE OR REPLACE VIEW cache_performance_metrics AS
SELECT 
    table_name,
    access_type,
    COUNT(*) as access_count,
    AVG(response_time_ms) as avg_response_time_ms,
    MAX(response_time_ms) as max_response_time_ms,
    AVG(data_size_bytes) as avg_data_size_bytes,
    DATE_TRUNC('hour', accessed_at) as hour_bucket
FROM cache_access_stats 
WHERE accessed_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY table_name, access_type, DATE_TRUNC('hour', accessed_at)
ORDER BY hour_bucket DESC;

-- View for dashboard data summary
CREATE OR REPLACE VIEW dashboard_cache_summary AS
SELECT 
    user_role,
    COUNT(*) as cached_items,
    SUM(data_size_bytes) as total_size_bytes,
    AVG(access_count) as avg_access_count,
    MIN(expires_at) as earliest_expiry,
    MAX(last_accessed) as most_recent_access
FROM cached_dashboard_data
GROUP BY user_role;

COMMENT ON SCHEMA public IS 'TaskFlow Pro - Enhanced Database Schema for Background Sync (Phase 2)';
