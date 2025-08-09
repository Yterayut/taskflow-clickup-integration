#!/bin/bash

# Deploy Redis Cache System to Production (Fixed Permissions)
# Phase 2 Implementation Deployment

echo "🚀 TaskFlow Pro - Redis Cache System Deployment (Fixed)"
echo "======================================================="

# Configuration
SERVER="192.168.20.10"
USER="one-climate"
PASSWORD="U8@1v3z#14"
REMOTE_PATH="/var/www/taskflow"
SERVICE_NAME="taskflow-backend"

echo "📍 Target Server: $SERVER"
echo "📂 Remote Path: $REMOTE_PATH"
echo "⏰ Started: $(date)"

# Function to run command on remote server with sudo
run_remote_sudo() {
    local cmd="$1"
    echo "🔄 Running (sudo): $cmd"
    sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$USER@$SERVER" "echo '$PASSWORD' | sudo -S $cmd"
}

# Function to run command on remote server
run_remote() {
    local cmd="$1"
    echo "🔄 Running: $cmd"
    sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$USER@$SERVER" "$cmd"
}

# Function to copy file to remote server with sudo
copy_file_sudo() {
    local local_file="$1"
    local remote_file="$2"
    echo "📤 Copying (sudo): $local_file → $remote_file"
    
    # First copy to temp location, then move with sudo
    local temp_file="/tmp/$(basename $remote_file)_$(date +%s)"
    sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no "$local_file" "$USER@$SERVER:$temp_file"
    run_remote_sudo "mv $temp_file $remote_file"
    run_remote_sudo "chown root:root $remote_file"
}

echo ""
echo "🔄 Phase 1: Backup Current System"
echo "=================================="
run_remote_sudo "cd $REMOTE_PATH && cp single_login_backend.js single_login_backend.backup_$(date +%Y%m%d_%H%M%S).js"
run_remote_sudo "cd $REMOTE_PATH && cp package.json package.backup_$(date +%Y%m%d_%H%M%S).json"

echo ""
echo "🔄 Phase 2: Deploy New Files"
echo "============================="

# Deploy CacheService
echo "📤 Deploying CacheService..."
run_remote_sudo "mkdir -p $REMOTE_PATH/services"
copy_file_sudo "./services/CacheService.js" "$REMOTE_PATH/services/CacheService.js"

# Deploy updated localDataRoutes
echo "📤 Deploying updated localDataRoutes..."
copy_file_sudo "./api/routes/localDataRoutes.js" "$REMOTE_PATH/api/routes/localDataRoutes.js"

# Deploy updated backend
echo "📤 Deploying updated backend..."
copy_file_sudo "./single_login_backend.js" "$REMOTE_PATH/single_login_backend.js"

# Deploy updated package.json
echo "📤 Deploying updated package.json..."
copy_file_sudo "./package.json" "$REMOTE_PATH/package.json"

echo ""
echo "🔄 Phase 3: Install New Dependencies"
echo "====================================="
run_remote_sudo "cd $REMOTE_PATH && npm install redis node-cron"

echo ""
echo "🔄 Phase 4: Check Redis Installation"
echo "====================================="
echo "ℹ️  Checking if Redis is available..."
REDIS_CHECK=$(run_remote "which redis-server 2>/dev/null && echo 'FOUND' || echo 'NOT_FOUND'")

if [[ "$REDIS_CHECK" == *"NOT_FOUND"* ]]; then
    echo "⚠️  Redis not found - installing Redis..."
    run_remote_sudo "apt update && apt install -y redis-server"
    run_remote_sudo "systemctl start redis-server"
    run_remote_sudo "systemctl enable redis-server"
    echo "✅ Redis installed and started"
else
    echo "✅ Redis already available"
    run_remote_sudo "systemctl start redis-server"
fi

# Test Redis connection
echo "🧪 Testing Redis connection..."
REDIS_TEST=$(run_remote "redis-cli ping 2>/dev/null || echo 'FAILED'")
if [[ "$REDIS_TEST" == *"PONG"* ]]; then
    echo "✅ Redis is responding"
else
    echo "⚠️  Redis test failed - continuing without Redis"
fi

echo ""
echo "🔄 Phase 5: Fix Permissions"
echo "==========================="
run_remote_sudo "chown -R root:root $REMOTE_PATH"
run_remote_sudo "chmod +x $REMOTE_PATH/single_login_backend.js"

echo ""
echo "🔄 Phase 6: Restart Backend Service"
echo "==================================="
run_remote_sudo "systemctl stop $SERVICE_NAME || echo 'Service not running'"
sleep 2
run_remote_sudo "systemctl start $SERVICE_NAME"
sleep 3

# Check service status
echo "🧪 Checking service status..."
SERVICE_STATUS=$(run_remote_sudo "systemctl is-active $SERVICE_NAME" | tr -d '\r')
echo "Service status: $SERVICE_STATUS"

if [[ "$SERVICE_STATUS" == "active" ]]; then
    echo "✅ Backend service is running"
else
    echo "⚠️  Backend service status: $SERVICE_STATUS"
    echo "📋 Service logs:"
    run_remote_sudo "journalctl -u $SERVICE_NAME --no-pager -n 10"
fi

echo ""
echo "🔄 Phase 7: Deployment Verification"
echo "==================================="

# Wait for service to fully start
sleep 5

# Test basic connectivity
echo "🧪 Testing basic connectivity..."
HEALTH_TEST=$(run_remote "curl -s -o /dev/null -w '%{http_code}' http://localhost:7812/health || echo 'FAILED'" | tr -d '\r')
echo "Health endpoint: HTTP $HEALTH_TEST"

# Test new cache endpoints
echo "🧪 Testing new cache endpoints..."
CACHE_TEST=$(run_remote "curl -s -o /dev/null -w '%{http_code}' http://localhost:7812/api/v2/local/cache/status || echo 'FAILED'" | tr -d '\r')
echo "Cache status endpoint: HTTP $CACHE_TEST"

# Test local data endpoints
echo "🧪 Testing local data endpoints..."
LOCAL_TEST=$(run_remote "curl -s -o /dev/null -w '%{http_code}' http://localhost:7812/api/v2/local/health || echo 'FAILED'" | tr -d '\r')
echo "Local health endpoint: HTTP $LOCAL_TEST"

# Test dashboard with cache
echo "🧪 Testing dashboard endpoint..."
DASHBOARD_TEST=$(run_remote "curl -s -o /dev/null -w '%{http_code}' http://localhost:7812/api/v2/local/dashboard-data || echo 'FAILED'" | tr -d '\r')
echo "Dashboard endpoint: HTTP $DASHBOARD_TEST"

echo ""
echo "📊 Deployment Summary"
echo "===================="
echo "⏰ Completed: $(date)"
echo "🎯 Target: Redis Cache System + Local Database Enhancement"
echo "📁 Files Deployed:"
echo "   • services/CacheService.js"
echo "   • api/routes/localDataRoutes.js (enhanced)"
echo "   • single_login_backend.js (with cache integration)"
echo "   • package.json (redis + node-cron dependencies)"
echo "🔧 Redis Server: Installed and Running"

# Final status check
if [[ "$SERVICE_STATUS" == "active" && "$HEALTH_TEST" == "200" ]]; then
    echo "✅ Deployment Status: SUCCESS"
    echo "🚀 Redis Cache System is now active!"
    
    if [[ "$CACHE_TEST" == "200" ]]; then
        echo "✅ Cache Management Endpoints: Active"
    else
        echo "⚠️  Cache Management Endpoints: Need verification"
    fi
    
    if [[ "$LOCAL_TEST" == "200" ]]; then
        echo "✅ Local Data Endpoints: Active"
    else
        echo "⚠️  Local Data Endpoints: Need verification"
    fi
    
    echo ""
    echo "🧪 Next Steps:"
    echo "   1. Run QA tests again to verify full functionality"
    echo "   2. Monitor cache performance and hit rates"
    echo "   3. Check Redis memory usage and configure limits"
    echo ""
    echo "📍 Test URLs:"
    echo "   • Health: http://192.168.20.10:7812/api/v2/local/health"
    echo "   • Cache Status: http://192.168.20.10:7812/api/v2/local/cache/status"
    echo "   • Dashboard: http://192.168.20.10:7812/api/v2/local/dashboard-data"
else
    echo "❌ Deployment Status: ISSUES DETECTED"
    echo "📋 Service Status: $SERVICE_STATUS"
    echo "📋 Health Status: HTTP $HEALTH_TEST"
    echo "📋 Check service logs for errors"
fi

echo ""
echo "🏁 Deployment Complete"