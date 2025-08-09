#!/bin/bash

# TaskFlow Pro Database Setup Script
# This script sets up PostgreSQL database for authentication system

set -e

echo "🚀 TaskFlow Pro Database Setup"
echo "=============================="

# Configuration
DB_NAME="taskflow_pro"
DB_USER="taskflow_user"
DB_PASSWORD=$(openssl rand -base64 32)
POSTGRES_PASSWORD="U8@1v3z#14"

echo "📊 Database Configuration:"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Password: [Generated]"
echo ""

# Check if PostgreSQL is running
echo "🔍 Checking PostgreSQL status..."
if systemctl is-active --quiet postgresql; then
    echo "✅ PostgreSQL is running"
else
    echo "❌ PostgreSQL is not running. Starting..."
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
fi

echo ""
echo "🗄️ Setting up database..."

# Create database and user using postgres superuser
sudo -u postgres psql << EOF
-- Drop existing database and user if they exist
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;

-- Create new database and user
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER CREATEDB;

-- Connect to the new database and grant schema privileges
\c $DB_NAME;
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;

-- Show database and user info
\l
\du
EOF

echo "✅ Database and user created successfully!"
echo ""

# Run schema migration
echo "📋 Running database schema migration..."
PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -f database/schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Schema migration completed successfully!"
else
    echo "❌ Schema migration failed!"
    exit 1
fi

echo ""

# Run data seeding
echo "🌱 Seeding initial data..."
PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME << EOF
-- Seed initial users with hashed passwords
-- Password for all demo accounts: 12345
-- Hash generated with bcrypt cost 12

INSERT INTO users (email, password_hash, role, full_name) VALUES
('yterayut@gmail.com', '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/jsgHgCXj4AJqTwv0C', 'master', 'Terayut Yeeraram'),
('chaiwutwck@gmail.com', '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/jsgHgCXj4AJqTwv0C', 'team_lead', 'Chaiwut Manager'),
('kittipong@example.com', '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/jsgHgCXj4AJqTwv0C', 'employee', 'Kittipong Employee'),
('manager@taskflow.com', '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/jsgHgCXj4AJqTwv0C', 'manager', 'Demo Manager'),
('teamlead@taskflow.com', '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/jsgHgCXj4AJqTwv0C', 'team_lead', 'Demo Team Lead'),
('employee@taskflow.com', '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/jsgHgCXj4AJqTwv0C', 'employee', 'Demo Employee');

-- Verify users were created
SELECT id, email, role, full_name, created_at FROM users ORDER BY role, email;
EOF

if [ $? -eq 0 ]; then
    echo "✅ Data seeding completed successfully!"
else
    echo "❌ Data seeding failed!"
    exit 1
fi

echo ""
echo "💾 Creating environment configuration..."

# Create .env file
cat > .env << EOF
# TaskFlow Pro Authentication Environment Configuration
NODE_ENV=production
AUTH_PORT=7810

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_SSL=false

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 64)
JWT_EXPIRES_IN=24h
JWT_ISSUER=taskflow-pro
JWT_AUDIENCE=taskflow-users

# Bcrypt Configuration
BCRYPT_SALT_ROUNDS=12

# ClickUp OAuth Configuration
CLICKUP_CLIENT_ID=DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL
CLICKUP_CLIENT_SECRET=your_clickup_client_secret
CLICKUP_REDIRECT_URI=http://192.168.20.10:7810/auth/callback

# Frontend URLs
FRONTEND_URL=http://192.168.20.10:8888
DASHBOARD_URL=http://192.168.20.10:8888

# Security Configuration
COOKIE_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=5

# Logging
LOG_LEVEL=info
LOG_FILE=auth_service.log

# CORS Origins
CORS_ORIGINS=http://192.168.20.10:8888,http://localhost:8888,http://127.0.0.1:8888
EOF

echo "✅ Environment configuration created: .env"
echo ""

# Test database connection
echo "🔍 Testing database connection..."
PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 'Database connection successful!' as status;"

if [ $? -eq 0 ]; then
    echo "✅ Database connection test passed!"
else
    echo "❌ Database connection test failed!"
    exit 1
fi

echo ""
echo "🎉 Database Setup Complete!"
echo "========================="
echo "✅ PostgreSQL database created: $DB_NAME"
echo "✅ User created: $DB_USER"
echo "✅ Schema migrated successfully"
echo "✅ Demo users seeded"
echo "✅ Environment configured"
echo ""
echo "📋 Next Steps:"
echo "1. Install Node.js dependencies: npm install"
echo "2. Start authentication server: node auth_server.js"
echo "3. Test login at: http://192.168.20.10:7810/login"
echo ""
echo "🔐 Demo Accounts:"
echo "   Master: yterayut@gmail.com / 12345"
echo "   Team Lead: chaiwutwck@gmail.com / 12345"
echo "   Employee: kittipong@example.com / 12345"
echo ""
echo "💾 Database credentials saved in .env file"
echo "🔒 Keep .env file secure and never commit to version control"