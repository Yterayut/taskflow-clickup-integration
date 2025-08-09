-- OAuth Setup Migration
-- Add OAuth setup tracking to support hybrid authentication for master user
-- TaskFlow Pro v2.2 - Master User Authentication Enhancement

-- Add OAuth setup tracking columns to users table
ALTER TABLE users 
ADD COLUMN oauth_setup_completed BOOLEAN DEFAULT false,
ADD COLUMN oauth_setup_completed_at TIMESTAMP NULL;

-- Add comment for the new columns
COMMENT ON COLUMN users.oauth_setup_completed IS 'Track if master user has completed OAuth setup (first-time only)';
COMMENT ON COLUMN users.oauth_setup_completed_at IS 'Timestamp when OAuth setup was completed';

-- Enhanced clickup_tokens table for permanent token storage
ALTER TABLE clickup_tokens 
ADD COLUMN is_permanent BOOLEAN DEFAULT false,
ADD COLUMN setup_completed_at TIMESTAMP NULL;

-- Add comments for new token tracking columns
COMMENT ON COLUMN clickup_tokens.is_permanent IS 'Permanent tokens for master user (never expire)';
COMMENT ON COLUMN clickup_tokens.setup_completed_at IS 'When the OAuth setup was completed for permanent storage';

-- Create index for performance on OAuth setup queries
CREATE INDEX idx_users_oauth_setup ON users(email, oauth_setup_completed) WHERE oauth_setup_completed = true;
CREATE INDEX idx_permanent_tokens ON clickup_tokens(user_id, is_permanent) WHERE is_permanent = true;

-- Update role constraint to support enhanced role system
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_user_role;
ALTER TABLE users ADD CONSTRAINT chk_user_role 
CHECK (role IN ('master', 'manager', 'team_lead', 'employee', 'user'));

-- Mark existing master user as requiring OAuth setup (first time)
UPDATE users 
SET oauth_setup_completed = false, 
    role = 'master'
WHERE email = 'yterayut@gmail.com';

-- Migration validation query
-- SELECT email, role, oauth_setup_completed, oauth_setup_completed_at 
-- FROM users WHERE email = 'yterayut@gmail.com';

-- Create migration_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS migration_log (
    id SERIAL PRIMARY KEY,
    version VARCHAR(20) NOT NULL,
    description TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration completion log
INSERT INTO migration_log (version, description, applied_at) 
VALUES ('2.2.0', 'OAuth setup tracking for hybrid master user authentication', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;