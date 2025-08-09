#!/bin/bash
# Fresh PostgreSQL installation - complete reset and reinstall
echo "🔥 Fresh PostgreSQL Installation - Complete Reset..."

# Stop PostgreSQL service
sudo systemctl stop postgresql

# Remove PostgreSQL completely
echo "🗑️  Removing PostgreSQL completely..."
sudo apt-get --purge remove postgresql postgresql-* -y
sudo rm -rf /var/lib/postgresql/
sudo rm -rf /etc/postgresql/
sudo rm -rf /var/log/postgresql/
sudo deluser postgres 2>/dev/null || true

# Clean package cache
sudo apt-get autoremove -y
sudo apt-get autoclean

# Update package list
sudo apt-get update

# Install PostgreSQL fresh
echo "📦 Installing PostgreSQL fresh..."
sudo apt-get install postgresql postgresql-contrib -y

# Wait for installation to complete
sleep 5

# Set postgres user password
echo "🔐 Setting up postgres user..."
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'taskflow123';"

# Configure authentication - use trust for localhost
echo "⚙️  Configuring authentication..."
sudo tee /etc/postgresql/14/main/pg_hba.conf > /dev/null << 'EOF'
# PostgreSQL Client Authentication Configuration File
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# "local" is for Unix domain socket connections only
local   all             postgres                                trust
local   all             all                                     trust

# IPv4 local connections:
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust

# Allow replication connections from localhost  
local   replication     all                                     trust
host    replication     all             127.0.0.1/32            trust
host    replication     all             ::1/128                 trust
EOF

# Restart PostgreSQL
sudo systemctl restart postgresql
sudo systemctl enable postgresql

# Wait for service to be ready
sleep 10

echo "🧪 Testing PostgreSQL..."
# Test connection
psql -U postgres -c "SELECT version();" | head -2

# Create TaskFlow database and user
echo "🏗️  Setting up TaskFlow database..."
psql -U postgres -c "CREATE DATABASE taskflow_pro;" 2>/dev/null || echo "Database exists"
psql -U postgres -c "CREATE USER taskflow WITH PASSWORD 'taskflow123';" 2>/dev/null || echo "User exists"  
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE taskflow_pro TO taskflow;"
psql -U postgres -c "ALTER USER taskflow CREATEDB SUPERUSER;"

# Test TaskFlow database
psql -U postgres -d taskflow_pro -c "SELECT 'TaskFlow DB Ready' as status;"

echo ""
echo "✅ FRESH POSTGRESQL INSTALLATION COMPLETE!"
echo "📋 Connection Details:"
echo "   Host: localhost"
echo "   Database: taskflow_pro"
echo "   User: postgres (no password needed)"
echo "   Alternative User: taskflow / taskflow123"
echo "   Connection String: postgresql://postgres@localhost/taskflow_pro"
echo ""
echo "🎯 Ready for TaskFlow Pro migration!"