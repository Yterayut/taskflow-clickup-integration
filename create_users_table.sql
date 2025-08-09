-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    clickup_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert admin user with ClickUp token
INSERT INTO users (email, name, password_hash, role, clickup_token) 
VALUES (
    'yterayut@gmail.com', 
    'Teerayut Yeerahem', 
    '$2b$10$dummy.hash.for.testing', 
    'admin', 
    'pk_282686567_9YVTHM0C1HQJDMEUWZP8RTP48S4YV5HL'
)
ON CONFLICT (email) DO UPDATE SET 
    clickup_token = EXCLUDED.clickup_token,
    updated_at = CURRENT_TIMESTAMP;

-- Add more team members based on ClickUp members
INSERT INTO users (email, name, password_hash, role) 
SELECT 
    email,
    username,
    '$2b$10$default.hash.change.me',
    'user'
FROM clickup_members 
WHERE email IS NOT NULL AND email != ''
ON CONFLICT (email) DO NOTHING;