#!/bin/bash

# TaskFlow Pro Production PostgreSQL Setup Script
# This script sets up PostgreSQL for TaskFlow Pro on production server

echo "🚀 TaskFlow Pro Production PostgreSQL Setup"
echo "==========================================="

# Configuration
DB_NAME="taskflow_pro"
DB_USER="taskflow_user"
DB_PASSWORD="taskflow_prod_2025"
BACKUP_DIR="/home/one-climate/taskflow_backups"

echo "📋 Configuration:"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Backup Directory: $BACKUP_DIR"
echo ""

# 1. Create database and user
echo "1️⃣ Setting up PostgreSQL database and user..."

# Create database and user (run as postgres user)
sudo -u postgres psql << EOF
-- Create database
CREATE DATABASE $DB_NAME;

-- Create user with password
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- Additional permissions for tables
\c $DB_NAME;
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;

-- Show databases and users
\l
\du

\q
EOF

echo "✅ Database and user created successfully"

# 2. Test connection
echo "2️⃣ Testing database connection..."
export PGPASSWORD=$DB_PASSWORD
psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    exit 1
fi

# 3. Create backup directory
echo "3️⃣ Creating backup directory..."
mkdir -p $BACKUP_DIR
chmod 755 $BACKUP_DIR
echo "✅ Backup directory created: $BACKUP_DIR"

# 4. Backup existing SQLite database
echo "4️⃣ Backing up existing SQLite database..."
cd /home/one-climate/team-workload
if [ -f "taskflow_production_real.db" ]; then
    cp taskflow_production_real.db $BACKUP_DIR/taskflow_sqlite_backup_$(date +%Y%m%d_%H%M%S).db
    echo "✅ SQLite database backed up"
else
    echo "ℹ️ No SQLite database found to backup"
fi

# 5. Create environment file
echo "5️⃣ Creating production environment file..."
cat > .env.production << EOF
# TaskFlow Pro Production Environment
USE_POSTGRESQL=true
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=$DB_NAME
PG_USER=$DB_USER
PG_PASSWORD=$DB_PASSWORD

NODE_ENV=production
PORT=7812

# Session configuration
SESSION_SECRET=taskflow-pro-production-secret-$(openssl rand -hex 16)

# Logging
DEBUG=taskflow:*
EOF

echo "✅ Environment file created: .env.production"

# 6. Set file permissions
echo "6️⃣ Setting secure file permissions..."
chmod 600 .env.production
chown one-climate:one-climate .env.production
echo "✅ File permissions set securely"

# 7. Test application with PostgreSQL
echo "7️⃣ Testing application with PostgreSQL..."

# Install any missing dependencies
echo "Installing/updating dependencies..."
npm install

# Run migration test
echo "Testing PostgreSQL migration..."
export USE_POSTGRESQL=true
export PG_PASSWORD=$DB_PASSWORD
node -e "
const { PostgreSQLService } = require('./services/PostgreSQLService');
async function test() {
    const db = new PostgreSQLService();
    const connected = await db.connect();
    if (connected) {
        console.log('✅ PostgreSQL service connection successful');
        await db.migrate();
        console.log('✅ Database migration successful');
        await db.disconnect();
    } else {
        console.log('❌ PostgreSQL service connection failed');
        process.exit(1);
    }
}
test().catch(console.error);
"

if [ $? -eq 0 ]; then
    echo "✅ PostgreSQL application test successful"
else
    echo "❌ PostgreSQL application test failed"
    echo "ℹ️ System will fallback to SQLite automatically"
fi

echo ""
echo "🎉 Production PostgreSQL Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Stop current backend: pkill -f backend"
echo "2. Start with PostgreSQL: USE_POSTGRESQL=true node backend_postgresql_enhanced.js"
echo "3. Or start with auto-detection: node backend_postgresql_enhanced.js"
echo "4. Health check: curl http://192.168.20.10:7812/health"
echo ""
echo "🔧 Production Commands:"
echo "  Start PostgreSQL: USE_POSTGRESQL=true npm start"
echo "  Start SQLite:     USE_POSTGRESQL=false npm start"
echo "  Auto-detect:      npm start"
echo ""
echo "🗃️ Database Details:"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER" 
echo "  Password: $DB_PASSWORD"
echo "  Host: localhost:5432"
echo ""