#!/bin/bash
# Force PostgreSQL setup - non-interactive
export DEBIAN_FRONTEND=noninteractive

echo "🚀 Force PostgreSQL Setup - Non-interactive..."

# Kill any hanging processes
sudo pkill -f postgresql || true
sudo pkill -f apt-get || true
sudo pkill -f debconf || true

# Clean up any locks
sudo rm -f /var/lib/dpkg/lock-frontend
sudo rm -f /var/lib/dpkg/lock
sudo rm -f /var/cache/apt/archives/lock

# Configure debconf for non-interactive
echo 'debconf debconf/frontend select Noninteractive' | sudo debconf-set-selections
echo 'postgresql-14 postgresql-14/main/remove_db select true' | sudo debconf-set-selections

# Force remove PostgreSQL with auto-yes to all prompts  
sudo apt-get -y --purge remove postgresql postgresql-* 2>/dev/null || true
sudo rm -rf /var/lib/postgresql/ 2>/dev/null || true
sudo rm -rf /etc/postgresql/ 2>/dev/null || true
sudo deluser postgres 2>/dev/null || true

# Clean and update
sudo apt-get -y autoremove
sudo apt-get -y autoclean
sudo apt-get update

# Install PostgreSQL with non-interactive frontend
echo "📦 Installing PostgreSQL with non-interactive mode..."
sudo apt-get -y install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Wait for service to be ready
sleep 10

# Configure with trust authentication directly
echo "🔐 Setting up trust authentication..."
sudo tee /etc/postgresql/14/main/pg_hba.conf > /dev/null << 'EOF'
# PostgreSQL Client Authentication Configuration File
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust  
host    all             all             ::1/128                 trust
local   replication     all                                     trust
host    replication     all             127.0.0.1/32            trust
host    replication     all             ::1/128                 trust
EOF

# Restart with new config
sudo systemctl restart postgresql
sleep 5

echo "🏗️  Creating TaskFlow database..."
# Now we can use psql without password
sudo -u postgres createdb taskflow_pro 2>/dev/null || echo "Database exists"

# Test connection
echo "🧪 Testing PostgreSQL connection..."
sudo -u postgres psql -d taskflow_pro -c "SELECT 'PostgreSQL Ready!' as status;"

echo ""
echo "✅ POSTGRESQL SETUP COMPLETE!"
echo "📋 Connection: postgresql://localhost/taskflow_pro (as postgres user)"
echo "🔧 Backend can use peer authentication"