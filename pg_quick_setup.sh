#!/bin/bash
# Quick PostgreSQL setup with trust authentication
echo "🚀 Setting up PostgreSQL with trust authentication..."

# Backup and modify pg_hba.conf
sudo cp /etc/postgresql/14/main/pg_hba.conf /etc/postgresql/14/main/pg_hba.conf.backup

# Set trust authentication for local connections
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

# Wait for service
sleep 3

echo "✅ PostgreSQL configured with trust authentication"

# Test connection
psql -U postgres -d postgres -c "SELECT version();" | head -1

# Create database and user
psql -U postgres -c "CREATE DATABASE taskflow_pro;" 2>/dev/null || echo "Database exists"
psql -U postgres -c "CREATE USER taskflow WITH PASSWORD 'taskflow123';" 2>/dev/null || echo "User exists"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE taskflow_pro TO taskflow;"
psql -U postgres -c "ALTER USER taskflow CREATEDB;"

echo "✅ Database and user created"
echo "📋 Connection: postgresql://postgres@localhost/taskflow_pro"