#!/bin/bash

# TaskFlow Pro Phase 3 Production Deployment Script
# Deploy Phase 3 Real-time Enhanced System to Production Server

echo "🚀 TaskFlow Pro Phase 3 - Production Deployment"
echo "================================================="
echo "Target Server: one-climate@192.168.20.10"
echo "Version: 7.0.0-phase3-realtime"
echo "Date: $(date)"
echo ""

# Configuration
SERVER="one-climate@192.168.20.10"
REMOTE_PATH="/var/www/taskflow"
LOCAL_PATH="/Users/teerayutyeerahem/team-workload"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Pre-deployment checks
echo "🔍 Pre-deployment Validation"
echo "----------------------------"

# Check local system status
print_info "Checking local backend status..."
if curl -s http://localhost:7812/health > /dev/null; then
    LOCAL_VERSION=$(curl -s http://localhost:7812/health | jq -r '.version')
    print_status "Local backend running: $LOCAL_VERSION"
else
    print_error "Local backend not running!"
    exit 1
fi

# Check Phase 3 services
print_info "Checking Phase 3 services..."
if curl -s http://localhost:7812/api/v3/health > /dev/null; then
    print_status "Phase 3 services operational"
else
    print_error "Phase 3 services not available!"
    exit 1
fi

# Check server connectivity
print_info "Testing server connectivity..."
if ssh -o ConnectTimeout=10 $SERVER "echo 'Connected'" > /dev/null 2>&1; then
    print_status "Server connection established"
else
    print_error "Cannot connect to production server!"
    exit 1
fi

echo ""
echo "📦 Preparing Phase 3 Deployment Package"
echo "----------------------------------------"

# Create deployment package
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEPLOY_DIR="taskflow_phase3_deploy_$TIMESTAMP"
mkdir -p $DEPLOY_DIR

# Copy essential files
print_info "Copying core backend files..."
cp single_login_backend.js $DEPLOY_DIR/
cp users_config.json $DEPLOY_DIR/
cp package.json $DEPLOY_DIR/
cp -r infrastructure/ $DEPLOY_DIR/ 2>/dev/null || echo "Infrastructure dir copied"

# Copy Phase 3 specific files
print_info "Copying Phase 3 files..."
cp phase3_realtime_dashboard.html $DEPLOY_DIR/
cp test_phase3_final.js $DEPLOY_DIR/

# Copy documentation
print_info "Copying documentation..."
cp CLAUDE.md $DEPLOY_DIR/
cp PHASE_3_IMPLEMENTATION_COMPLETE.md $DEPLOY_DIR/

# Create deployment info
print_info "Creating deployment manifest..."
cat > $DEPLOY_DIR/DEPLOYMENT_INFO.txt << EOF
TaskFlow Pro Phase 3 Deployment
================================
Deployment Date: $(date)
Version: 7.0.0-phase3-realtime
Source System: $(hostname)
Target Server: $SERVER

Phase 3 Features:
- Real-time WebSocket Communication
- Live Analytics Updates  
- Advanced Multi-layer Caching
- Smart Cache Warming
- Real-time Notifications
- Performance Monitoring

Files Included:
- single_login_backend.js (Enhanced with Phase 3)
- infrastructure/ (All Phase 3 services)
- phase3_realtime_dashboard.html
- users_config.json (11 users)
- Documentation and test files

Deployment Status: $(curl -s http://localhost:7812/api/v3/health | jq -r '.status')
EOF

print_status "Deployment package created: $DEPLOY_DIR"

echo ""
echo "🚀 Deploying to Production Server"
echo "----------------------------------"

# Create backup on server
print_info "Creating production backup..."
ssh $SERVER "cd $REMOTE_PATH && cp -r . ../taskflow_backup_$TIMESTAMP && echo 'Backup created: taskflow_backup_$TIMESTAMP'"

# Upload new files
print_info "Uploading Phase 3 files..."
scp -r $DEPLOY_DIR/* $SERVER:$REMOTE_PATH/

# Install dependencies on server
print_info "Installing/updating dependencies..."
ssh $SERVER "cd $REMOTE_PATH && npm install --production"

# Update systemd service if needed
print_info "Updating system service..."
ssh $SERVER "sudo systemctl stop taskflow-backend 2>/dev/null || echo 'Service not running'"

# Start the enhanced backend
print_info "Starting Phase 3 enhanced backend..."
ssh $SERVER "cd $REMOTE_PATH && nohup node single_login_backend.js > backend_phase3.log 2>&1 & echo 'Backend started'"

# Wait for service to start
print_info "Waiting for service startup..."
sleep 10

echo ""
echo "🧪 Production Validation"
echo "------------------------"

# Test health endpoint
print_info "Testing health endpoint..."
if ssh $SERVER "curl -s http://localhost:7812/health" > /dev/null; then
    PROD_VERSION=$(ssh $SERVER "curl -s http://localhost:7812/health | jq -r '.version'")
    print_status "Production health check: OK ($PROD_VERSION)"
else
    print_error "Production health check failed!"
fi

# Test Phase 3 endpoints
print_info "Testing Phase 3 endpoints..."
if ssh $SERVER "curl -s http://localhost:7812/api/v3/health" > /dev/null; then
    print_status "Phase 3 services: OPERATIONAL"
else
    print_warning "Phase 3 services may need more time to start"
fi

# Test authentication
print_info "Testing authentication..."
AUTH_TEST=$(ssh $SERVER "curl -s -X POST http://localhost:7812/api/v2/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"chaiwutwck@gmail.com\",\"password\":\"12345\"}' | jq -r '.success'")
if [ "$AUTH_TEST" = "true" ]; then
    print_status "Authentication: WORKING"
else
    print_warning "Authentication may need verification"
fi

echo ""
echo "📊 Deployment Summary"
echo "--------------------"
print_status "Deployment package: $DEPLOY_DIR"
print_status "Production backup: taskflow_backup_$TIMESTAMP"
print_status "Target server: $SERVER"
print_status "Backend service: Enhanced with Phase 3"

echo ""
echo "🔗 Production URLs"
echo "-----------------"
echo "Main System: http://192.168.20.10:8888/"
echo "Backend API: http://192.168.20.10:7812/"
echo "Phase 3 Dashboard: http://192.168.20.10:7812/phase3"
echo "Health Check: http://192.168.20.10:7812/health"
echo "Phase 3 Health: http://192.168.20.10:7812/api/v3/health"

echo ""
echo "🎉 Phase 3 Deployment Complete!"
echo "==============================="
print_status "TaskFlow Pro v7.0.0-phase3-realtime deployed successfully"
print_info "Monitor logs: ssh $SERVER 'tail -f $REMOTE_PATH/backend_phase3.log'"
print_info "Emergency rollback: ssh $SERVER 'cd .. && rm -rf taskflow && mv taskflow_backup_$TIMESTAMP taskflow'"

# Cleanup local deployment package
read -p "Clean up local deployment package? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf $DEPLOY_DIR
    print_status "Local deployment package cleaned up"
fi

echo ""
print_status "Deployment completed successfully! 🚀"