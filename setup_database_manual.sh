#!/bin/bash

# TaskFlow Pro Database Setup Script (Manual Version)
# This script sets up PostgreSQL database for authentication system

set -e

echo "🚀 TaskFlow Pro Database Setup"
echo "=============================="

# Configuration
DB_NAME="taskflow_pro"
DB_USER="taskflow_user"
DB_PASSWORD=$(openssl rand -base64 32)

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
    echo "❌ PostgreSQL is not running"
    echo "Please run: sudo systemctl start postgresql"
    exit 1
fi

echo ""
echo "🗄️ Setting up database..."

# Generate SQL script for database setup
cat > setup_db.sql << EOF
-- Drop existing database and user if they exist
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;

-- Create new database and user
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER CREATEDB;

-- Show database and user info
\l
\du
EOF

echo "Running database setup as postgres user..."
echo "You may need to enter the postgres user password..."

# Execute as postgres user
sudo -u postgres psql -f setup_db.sql

if [ $? -eq 0 ]; then
    echo "✅ Database and user created successfully!"
else
    echo "❌ Database creation failed!"
    exit 1
fi

# Connect to the new database and grant schema privileges
cat > setup_permissions.sql << EOF
-- Grant schema privileges
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
EOF

sudo -u postgres psql -d $DB_NAME -f setup_permissions.sql

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

# Generate bcrypt hash for password "12345"
# Using Node.js to generate the hash
node -e "
const bcrypt = require('bcrypt');
const password = '12345';
const saltRounds = 12;
bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
        console.error('Error generating hash:', err);
        process.exit(1);
    }
    console.log(hash);
});
" > password_hash.txt 2>/dev/null || echo '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/jsgHgCXj4AJqTwv0C' > password_hash.txt

PASSWORD_HASH=$(cat password_hash.txt)

PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME << EOF
-- Seed initial users with hashed passwords
-- Password for all demo accounts: 12345

INSERT INTO users (email, password_hash, role, full_name) VALUES
('yterayut@gmail.com', '$PASSWORD_HASH', 'master', 'Terayut Yeeraram'),
('chaiwutwck@gmail.com', '$PASSWORD_HASH', 'team_lead', 'Chaiwut Manager'),
('kittipong@example.com', '$PASSWORD_HASH', 'employee', 'Kittipong Employee'),
('manager@taskflow.com', '$PASSWORD_HASH', 'manager', 'Demo Manager'),
('teamlead@taskflow.com', '$PASSWORD_HASH', 'team_lead', 'Demo Team Lead'),
('employee@taskflow.com', '$PASSWORD_HASH', 'employee', 'Demo Employee');

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
PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 'Database connection successful!' as status, count(*) as user_count FROM users;"

if [ $? -eq 0 ]; then
    echo "✅ Database connection test passed!"
else
    echo "❌ Database connection test failed!"
    exit 1
fi

# Cleanup temporary files
rm -f setup_db.sql setup_permissions.sql password_hash.txt

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
echo "1. Install Node.js dependencies: npm install --package-lock=false"
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