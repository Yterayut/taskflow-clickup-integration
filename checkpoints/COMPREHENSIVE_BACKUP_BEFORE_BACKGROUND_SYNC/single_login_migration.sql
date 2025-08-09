-- TaskFlow Pro v2.1 - Single Login Implementation
-- Database Migration Script
-- Date: July 2, 2025

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create system_status table for health monitoring
CREATE TABLE IF NOT EXISTS system_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clickup_connected BOOLEAN DEFAULT FALSE,
    last_token_refresh TIMESTAMP,
    last_health_check TIMESTAMP DEFAULT NOW(),
    master_token_expires_at TIMESTAMP,
    total_active_sessions INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_status_updated_at ON system_status(updated_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_clickup_tokens_user_id ON clickup_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_clickup_tokens_expires_at ON clickup_tokens(expires_at);

-- Add new columns to existing tables if they don't exist
DO $$
BEGIN
    -- Add scope column to clickup_tokens if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'clickup_tokens' AND column_name = 'scope') THEN
        ALTER TABLE clickup_tokens ADD COLUMN scope TEXT;
    END IF;
    
    -- Add token_type column to clickup_tokens if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'clickup_tokens' AND column_name = 'token_type') THEN
        ALTER TABLE clickup_tokens ADD COLUMN token_type VARCHAR(50) DEFAULT 'Bearer';
    END IF;
    
    -- Add last_refresh_attempt to clickup_tokens if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'clickup_tokens' AND column_name = 'last_refresh_attempt') THEN
        ALTER TABLE clickup_tokens ADD COLUMN last_refresh_attempt TIMESTAMP;
    END IF;
    
    -- Add refresh_attempts_count to clickup_tokens if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'clickup_tokens' AND column_name = 'refresh_attempts_count') THEN
        ALTER TABLE clickup_tokens ADD COLUMN refresh_attempts_count INTEGER DEFAULT 0;
    END IF;
END
$$;

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clickup_tokens_updated_at ON clickup_tokens;
CREATE TRIGGER update_clickup_tokens_updated_at 
    BEFORE UPDATE ON clickup_tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_status_updated_at ON system_status;
CREATE TRIGGER update_system_status_updated_at 
    BEFORE UPDATE ON system_status 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial system status record
INSERT INTO system_status (clickup_connected, last_health_check)
VALUES (FALSE, NOW())
ON CONFLICT DO NOTHING;

-- Create views for easier data access
CREATE OR REPLACE VIEW v_master_user_status AS
SELECT 
    u.id as user_id,
    u.email,
    u.role,
    u.last_login,
    ct.access_token IS NOT NULL as has_clickup_token,
    ct.expires_at as token_expires_at,
    ct.expires_at > NOW() as token_is_valid,
    ct.last_refresh_attempt,
    ct.refresh_attempts_count,
    ss.clickup_connected as system_connected
FROM users u
LEFT JOIN clickup_tokens ct ON u.id = ct.user_id
CROSS JOIN (SELECT clickup_connected FROM system_status ORDER BY updated_at DESC LIMIT 1) ss
WHERE u.role = 'master';

CREATE OR REPLACE VIEW v_system_health AS
SELECT 
    ss.clickup_connected,
    ss.last_token_refresh,
    ss.last_health_check,
    ss.master_token_expires_at,
    ss.total_active_sessions,
    CASE 
        WHEN ss.clickup_connected = FALSE THEN 'not_connected'
        WHEN ss.master_token_expires_at < NOW() THEN 'token_expired'
        WHEN ss.master_token_expires_at < NOW() + INTERVAL '24 hours' THEN 'token_expires_soon'
        ELSE 'healthy'
    END as status,
    ss.updated_at
FROM system_status ss
ORDER BY ss.updated_at DESC
LIMIT 1;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO taskflow_user;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO taskflow_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO taskflow_user;

-- Log migration completion
INSERT INTO system_status (clickup_connected, last_health_check)
VALUES (FALSE, NOW())
ON CONFLICT DO NOTHING;

-- Migration completed successfully
SELECT 'Single Login Migration Completed Successfully' as status;