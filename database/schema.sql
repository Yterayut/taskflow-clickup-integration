-- TaskFlow Pro Authentication Database Schema
-- PostgreSQL Database Schema for User Authentication

-- Drop tables if they exist (for clean migration)
DROP TABLE IF EXISTS clickup_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table for authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    full_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- ClickUp tokens table for master user
CREATE TABLE clickup_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    scope TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_clickup_tokens_user_id ON clickup_tokens(user_id);
CREATE INDEX idx_clickup_tokens_expires_at ON clickup_tokens(expires_at);

-- User roles constraint (simplified to master/user)
ALTER TABLE users ADD CONSTRAINT chk_user_role 
CHECK (role IN ('master', 'user'));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clickup_tokens_updated_at BEFORE UPDATE ON clickup_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE users IS 'User authentication and profile information';
COMMENT ON TABLE clickup_tokens IS 'ClickUp OAuth tokens for master user only';
COMMENT ON COLUMN users.role IS 'User role: master (single ClickUp OAuth user) or user (regular system users)';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hashed password';
COMMENT ON COLUMN clickup_tokens.access_token IS 'ClickUp API access token';