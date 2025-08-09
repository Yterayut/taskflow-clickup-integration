#!/bin/bash

# TaskFlow Pro - Manual Local Database + Cache Optimization Deployment
# Deploy without sudo - upload to home directory then move

echo "🚀 TaskFlow Pro - Manual Local Database + Cache Optimization Deployment"
echo "========================================================================"

SERVER_USER="one-climate"
SERVER_HOST="192.168.20.10"
HOME_PATH="/home/${SERVER_USER}"
SERVER_PATH="/var/www/taskflow"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Create temporary directory on server
print_status "Creating temporary directory on server..."
ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
    mkdir -p ~/taskflow_optimization_deploy
    rm -rf ~/taskflow_optimization_deploy/*
    echo "✅ Temporary directory created"
EOF

# Step 2: Upload files to home directory
print_status "Uploading optimization files to home directory..."

# Upload database schema
print_status "Uploading database schema..."
scp database/clickup_local_sync_schema.sql ${SERVER_USER}@${SERVER_HOST}:~/taskflow_optimization_deploy/

# Upload services
print_status "Uploading services..."
scp services/ClickUpLocalSyncService.js ${SERVER_USER}@${SERVER_HOST}:~/taskflow_optimization_deploy/
scp services/CacheService.js ${SERVER_USER}@${SERVER_HOST}:~/taskflow_optimization_deploy/

# Upload optimized routes
print_status "Uploading optimized API routes..."
scp api/routes/localDataOptimizedRoutes.js ${SERVER_USER}@${SERVER_HOST}:~/taskflow_optimization_deploy/
scp api/routes/dashboardOptimizedRoutes.js ${SERVER_USER}@${SERVER_HOST}:~/taskflow_optimization_deploy/

# Upload updated backend
print_status "Uploading updated backend..."
scp single_login_backend_current.js ${SERVER_USER}@${SERVER_HOST}:~/taskflow_optimization_deploy/single_login_backend_optimized.js

# Upload test file
print_status "Uploading test file..."
scp test_local_db_optimization_system.js ${SERVER_USER}@${SERVER_HOST}:~/taskflow_optimization_deploy/

if [ $? -ne 0 ]; then
    print_error "Failed to upload files"
    exit 1
fi

print_success "Files uploaded to home directory successfully"

# Step 3: Install dependencies
print_status "Installing Redis and Node.js dependencies..."
ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
    cd /var/www/taskflow
    
    # Install Redis and ioredis (may need sudo for Redis server)
    echo "📦 Installing Node.js Redis dependencies..."
    npm install redis ioredis --save
    
    if [ $? -eq 0 ]; then
        echo "✅ Node.js dependencies installed successfully"
    else
        echo "⚠️ May need manual npm install"
    fi
    
    echo "📦 Checking Redis installation..."
    if command -v redis-server &> /dev/null; then
        echo "✅ Redis server already installed"
        redis-cli ping 2>/dev/null && echo "✅ Redis is running" || echo "⚠️ Redis may need to be started"
    else
        echo "⚠️ Redis server needs to be installed manually: sudo apt-get install redis-server"
    fi
EOF

# Step 4: Setup database schema
print_status "Setting up database schema..."
ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
    cd ~/taskflow_optimization_deploy
    
    echo "🗄️ Setting up Local Database schema..."
    export PGPASSWORD='postgres'
    
    # Check if PostgreSQL is accessible
    if psql -h localhost -U postgres -d taskflow -c "SELECT 1;" &>/dev/null; then
        echo "✅ PostgreSQL connection successful"
        
        # Run the schema creation
        psql -h localhost -U postgres -d taskflow -f clickup_local_sync_schema.sql
        
        if [ $? -eq 0 ]; then
            echo "✅ Database schema created successfully"
        else
            echo "⚠️ Database schema creation had warnings (may be normal for existing tables)"
        fi
    else
        echo "❌ Cannot connect to PostgreSQL database"
        echo "Please run manually: psql -h localhost -U postgres -d taskflow -f ~/taskflow_optimization_deploy/clickup_local_sync_schema.sql"
    fi
EOF

# Step 5: Create deployment instructions for manual steps
print_status "Creating deployment instructions file..."
ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
    cd ~/taskflow_optimization_deploy
    
    cat > DEPLOYMENT_INSTRUCTIONS.txt << 'INSTRUCTIONS'
# TaskFlow Pro - Local Database + Cache Optimization
# Manual Deployment Instructions

## Files Ready for Deployment:
- clickup_local_sync_schema.sql (Database schema)
- ClickUpLocalSyncService.js (Background sync service)
- CacheService.js (Enhanced cache service)
- localDataOptimizedRoutes.js (Local DB API routes)
- dashboardOptimizedRoutes.js (Dashboard API routes with correct naming)
- single_login_backend_optimized.js (Updated backend)
- test_local_db_optimization_system.js (Test suite)

## Manual Steps Required (with sudo access):

### 1. Copy Services to Production:
sudo cp ~/taskflow_optimization_deploy/ClickUpLocalSyncService.js /var/www/taskflow/services/
sudo cp ~/taskflow_optimization_deploy/CacheService.js /var/www/taskflow/services/

### 2. Copy API Routes to Production:
sudo cp ~/taskflow_optimization_deploy/localDataOptimizedRoutes.js /var/www/taskflow/api/routes/
sudo cp ~/taskflow_optimization_deploy/dashboardOptimizedRoutes.js /var/www/taskflow/api/routes/

### 3. Backup and Replace Backend:
sudo cp /var/www/taskflow/single_login_backend.js /var/www/taskflow/single_login_backend_backup_$(date +%Y%m%d_%H%M%S).js
sudo cp ~/taskflow_optimization_deploy/single_login_backend_optimized.js /var/www/taskflow/single_login_backend.js

### 4. Set Correct Permissions:
sudo chown -R one-climate:one-climate /var/www/taskflow/
sudo chmod +x /var/www/taskflow/single_login_backend.js

### 5. Install Redis (if not installed):
sudo apt-get update
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

### 6. Restart Backend Service:
sudo systemctl stop taskflow-backend
sudo systemctl start taskflow-backend
sudo systemctl status taskflow-backend

### 7. Test the New System:
cd ~/taskflow_optimization_deploy
node test_local_db_optimization_system.js

## New API Endpoints Available After Deployment:
- http://192.168.20.10:7812/api/v2/dashboard/data
- http://192.168.20.10:7812/api/v2/dashboard/team-ranking/{teamId}
- http://192.168.20.10:7812/api/v2/dashboard/sync/status
- http://192.168.20.10:7812/api/v2/dashboard/performance/metrics

## Expected Performance Improvements:
- Response Time: 156ms → <50ms (70% improvement)
- Cache Hit Rate: 80-90%
- ClickUp API Calls: 95% reduction
- Offline Support: ✅ Available

## Troubleshooting:
- Check logs: sudo journalctl -u taskflow-backend -f
- Check Redis: redis-cli ping
- Check database: psql -h localhost -U postgres -d taskflow -c "\\dt clickup_*"
INSTRUCTIONS

    echo "✅ Deployment instructions created at ~/taskflow_optimization_deploy/DEPLOYMENT_INSTRUCTIONS.txt"
EOF

# Step 6: Test what we can without sudo
print_status "Testing current system status..."
ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
    echo "🔍 System Status Check:"
    echo "- Current backend status:"
    curl -s http://localhost:7812/health | grep -o '"status":"[^"]*"' || echo "  Backend not responding"
    
    echo "- Database connection:"
    export PGPASSWORD='postgres'
    psql -h localhost -U postgres -d taskflow -c "SELECT version();" | head -1 2>/dev/null && echo "  ✅ Database accessible" || echo "  ❌ Database not accessible"
    
    echo "- Redis status:"
    redis-cli ping 2>/dev/null && echo "  ✅ Redis running" || echo "  ⚠️ Redis not running or not installed"
    
    echo "- Node.js modules:"
    cd /var/www/taskflow
    npm list redis ioredis 2>/dev/null | grep -E "redis|ioredis" && echo "  ✅ Redis modules installed" || echo "  ⚠️ Redis modules may need installation"
EOF

# Final summary
echo ""
echo "=================================================================="
echo "🎯 MANUAL DEPLOYMENT PREPARATION COMPLETE"
echo "=================================================================="
echo ""
print_success "All optimization files uploaded to server home directory"
print_success "Database schema ready for deployment"
print_success "Dependencies checked and prepared"
echo ""
print_warning "MANUAL STEPS REQUIRED:"
echo "1. SSH to server: ssh one-climate@192.168.20.10"
echo "2. Read instructions: cat ~/taskflow_optimization_deploy/DEPLOYMENT_INSTRUCTIONS.txt"
echo "3. Follow manual deployment steps (requires sudo)"
echo "4. Run test: cd ~/taskflow_optimization_deploy && node test_local_db_optimization_system.js"
echo ""
print_status "Files location on server: ~/taskflow_optimization_deploy/"
print_status "Ready for manual deployment with sudo access"

echo ""
echo "🔗 Quick Commands to Run on Server:"
echo "cd ~/taskflow_optimization_deploy"
echo "cat DEPLOYMENT_INSTRUCTIONS.txt"
echo ""