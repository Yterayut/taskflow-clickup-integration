#!/bin/bash
# Reset PostgreSQL and setup for TaskFlow Pro
# Create new database and user with proper permissions

echo "🚀 Resetting PostgreSQL for TaskFlow Pro..."

# Stop PostgreSQL service
echo "⏹️  Stopping PostgreSQL service..."
sudo systemctl stop postgresql

# Switch to postgres user and reset
echo "🔄 Resetting PostgreSQL authentication..."

# Create setup script for postgres user
cat > /tmp/pg_setup.sql << 'EOF'
-- Reset postgres user password
ALTER USER postgres PASSWORD 'taskflow123';

-- Create taskflow user
DROP USER IF EXISTS taskflow;
CREATE USER taskflow WITH PASSWORD 'taskflow123';

-- Create taskflow_pro database
DROP DATABASE IF EXISTS taskflow_pro;
CREATE DATABASE taskflow_pro OWNER taskflow;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE taskflow_pro TO taskflow;
ALTER USER taskflow CREATEDB;

-- Allow connections
ALTER SYSTEM SET listen_addresses = 'localhost';
SELECT pg_reload_conf();
EOF

# Start PostgreSQL
echo "🚀 Starting PostgreSQL service..."
sudo systemctl start postgresql

# Wait a moment for service to start
sleep 3

# Configure authentication
echo "🔐 Configuring authentication..."
sudo -u postgres bash -c "
    # Update pg_hba.conf to allow password authentication
    PG_VERSION=\$(ls /etc/postgresql/ | head -n1)
    HBA_FILE=\"/etc/postgresql/\$PG_VERSION/main/pg_hba.conf\"
    
    # Backup original
    cp \$HBA_FILE \${HBA_FILE}.backup
    
    # Update authentication methods
    sed -i 's/local   all             postgres                                peer/local   all             postgres                                md5/' \$HBA_FILE
    sed -i 's/local   all             all                                     peer/local   all             all                                     md5/' \$HBA_FILE
    sed -i 's/host    all             all             127.0.0.1\/32            scram-sha-256/host    all             all             127.0.0.1\/32            md5/' \$HBA_FILE
    
    echo 'host    taskflow_pro    taskflow        127.0.0.1/32            md5' >> \$HBA_FILE
    echo 'local   taskflow_pro    taskflow                                md5' >> \$HBA_FILE
"

# Restart PostgreSQL to apply authentication changes
echo "🔄 Restarting PostgreSQL with new configuration..."
sudo systemctl restart postgresql

# Wait for service to be ready
sleep 5

# Run setup as postgres user
echo "⚙️  Setting up database and users..."
sudo -u postgres psql -f /tmp/pg_setup.sql

# Test connections
echo "🧪 Testing connections..."
echo "Testing postgres user:"
PGPASSWORD='taskflow123' psql -h localhost -U postgres -d postgres -c "SELECT 'Postgres user OK' as status;"

echo "Testing taskflow user:"
PGPASSWORD='taskflow123' psql -h localhost -U taskflow -d taskflow_pro -c "SELECT 'TaskFlow user OK' as status;"

# Cleanup
rm -f /tmp/pg_setup.sql

echo "✅ PostgreSQL reset complete!"
echo "📋 Connection details:"
echo "   Host: localhost"
echo "   Port: 5432"
echo "   Database: taskflow_pro"
echo "   User: taskflow"
echo "   Password: taskflow123"
echo ""
echo "🔧 Alternative admin access:"
echo "   User: postgres"
echo "   Password: taskflow123"