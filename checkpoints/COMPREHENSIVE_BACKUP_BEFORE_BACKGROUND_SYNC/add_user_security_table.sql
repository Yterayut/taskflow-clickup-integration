-- Add user_security table for account lockout and security tracking
-- Phase 1 Week 1: Account Security Enhancement

-- Create user_security table
CREATE TABLE IF NOT EXISTS user_security (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    
    -- Failed login tracking
    failed_attempts INTEGER DEFAULT 0,
    last_failed_attempt TIMESTAMP,
    last_failed_ip INET,
    last_failed_user_agent TEXT,
    
    -- Account lockout
    locked_until TIMESTAMP,
    lockout_count INTEGER DEFAULT 0,
    
    -- Successful login tracking  
    last_successful_login TIMESTAMP,
    last_login_ip INET,
    last_user_agent TEXT,
    
    -- CAPTCHA and security flags
    requires_captcha BOOLEAN DEFAULT FALSE,
    security_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_security_email ON user_security(email);
CREATE INDEX IF NOT EXISTS idx_user_security_locked_until ON user_security(locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_security_failed_attempts ON user_security(failed_attempts) WHERE failed_attempts > 0;
CREATE INDEX IF NOT EXISTS idx_user_security_last_failed ON user_security(last_failed_attempt) WHERE last_failed_attempt IS NOT NULL;

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_user_security_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_security_updated_at
    BEFORE UPDATE ON user_security
    FOR EACH ROW
    EXECUTE FUNCTION update_user_security_timestamp();

-- Insert comment
COMMENT ON TABLE user_security IS 'Account security tracking for failed logins, lockouts, and CAPTCHA requirements';
COMMENT ON COLUMN user_security.failed_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN user_security.locked_until IS 'Account locked until this timestamp';
COMMENT ON COLUMN user_security.lockout_count IS 'Total number of times account has been locked';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_security TO teamworkflow;