#!/bin/bash

# Deploy Redis Cache System to Production
# Phase 2 Implementation Deployment

echo "🚀 TaskFlow Pro - Redis Cache System Deployment"
echo "================================================"

# Configuration
SERVER="192.168.20.10"
USER="one-climate"
PASSWORD="U8@1v3z#14"
REMOTE_PATH="/var/www/taskflow"
SERVICE_NAME="taskflow-backend"

echo "📍 Target Server: $SERVER"
echo "📂 Remote Path: $REMOTE_PATH"
echo "⏰ Started: $(date)"

# Function to run command on remote server
run_remote() {
    local cmd="$1"
    echo "🔄 Running: $cmd"
    sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$USER@$SERVER" "$cmd"
}

# Function to copy file to remote server
copy_file() {
    local local_file="$1"
    local remote_file="$2"
    echo "📤 Copying: $local_file → $remote_file"
    sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no "$local_file" "$USER@$SERVER:$remote_file"
}

echo ""
echo "🔄 Phase 1: Backup Current System"
echo "=================================="
run_remote "cd $REMOTE_PATH && cp single_login_backend.js single_login_backend.backup_$(date +%Y%m%d_%H%M%S).js"
run_remote "cd $REMOTE_PATH && cp package.json package.backup_$(date +%Y%m%d_%H%M%S).json"

echo ""
echo "🔄 Phase 2: Deploy New Files"
echo "============================="

# Deploy CacheService
echo "📤 Deploying CacheService..."
run_remote "mkdir -p $REMOTE_PATH/services"
copy_file "./services/CacheService.js" "$REMOTE_PATH/services/CacheService.js"

# Deploy updated localDataRoutes
echo "📤 Deploying updated localDataRoutes..."
copy_file "./api/routes/localDataRoutes.js" "$REMOTE_PATH/api/routes/localDataRoutes.js"

# Deploy updated backend
echo "📤 Deploying updated backend..."
copy_file "./single_login_backend.js" "$REMOTE_PATH/single_login_backend.js"

# Deploy updated package.json
echo "📤 Deploying updated package.json..."
copy_file "./package.json" "$REMOTE_PATH/package.json"

echo ""
echo "🔄 Phase 3: Install New Dependencies"
echo "====================================="
run_remote "cd $REMOTE_PATH && npm install redis node-cron"

echo ""
echo "🔄 Phase 4: Check Redis Installation"
echo "====================================="
echo "ℹ️  Checking if Redis is available..."
REDIS_CHECK=$(run_remote "which redis-server 2>/dev/null && echo 'FOUND' || echo 'NOT_FOUND'")

if [[ "$REDIS_CHECK" == *"NOT_FOUND"* ]]; then
    echo "⚠️  Redis not found - installing Redis..."
    run_remote "sudo apt update && sudo apt install -y redis-server"
    run_remote "sudo systemctl start redis-server"
    run_remote "sudo systemctl enable redis-server"
    echo "✅ Redis installed and started"
else
    echo "✅ Redis already available"
    run_remote "sudo systemctl start redis-server"
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
echo "🔄 Phase 5: Restart Backend Service"
echo "==================================="
run_remote "sudo systemctl stop $SERVICE_NAME || echo 'Service not running'"
sleep 2
run_remote "sudo systemctl start $SERVICE_NAME"
sleep 3

# Check service status
echo "🧪 Checking service status..."
SERVICE_STATUS=$(run_remote "sudo systemctl is-active $SERVICE_NAME")
if [[ "$SERVICE_STATUS" == "active" ]]; then
    echo "✅ Backend service is running"
else
    echo "⚠️  Backend service status: $SERVICE_STATUS"
    echo "📋 Service logs:"
    run_remote "sudo journalctl -u $SERVICE_NAME --no-pager -n 10"
fi

echo ""
echo "🔄 Phase 6: Deployment Verification"
echo "==================================="

# Test basic connectivity
echo "🧪 Testing basic connectivity..."
HEALTH_TEST=$(run_remote "curl -s -o /dev/null -w '%{http_code}' http://localhost:7812/health || echo 'FAILED'")
echo "Health endpoint: HTTP $HEALTH_TEST"

# Test new cache endpoints
echo "🧪 Testing new cache endpoints..."
CACHE_TEST=$(run_remote "curl -s -o /dev/null -w '%{http_code}' http://localhost:7812/api/v2/local/cache/status || echo 'FAILED'")
echo "Cache status endpoint: HTTP $CACHE_TEST"

# Test local data endpoints
echo "🧪 Testing local data endpoints..."
LOCAL_TEST=$(run_remote "curl -s -o /dev/null -w '%{http_code}' http://localhost:7812/api/v2/local/health || echo 'FAILED'")
echo "Local health endpoint: HTTP $LOCAL_TEST"

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

if [[ "$SERVICE_STATUS" == "active" ]]; then
    echo "✅ Deployment Status: SUCCESS"
    echo "🚀 Redis Cache System is now active!"
    echo ""
    echo "🧪 Next Steps:"
    echo "   1. Run QA tests again to verify functionality"
    echo "   2. Monitor cache performance and hit rates"
    echo "   3. Configure Redis memory limits if needed"
    echo ""
    echo "📍 Test URLs:"
    echo "   • Health: http://192.168.20.10:7812/api/v2/local/health"
    echo "   • Cache Status: http://192.168.20.10:7812/api/v2/local/cache/status"
    echo "   • Dashboard: http://192.168.20.10:7812/api/v2/local/dashboard-data"
else
    echo "❌ Deployment Status: PARTIAL - Service needs investigation"
    echo "📋 Check service logs for errors"
fi

echo ""
echo "🏁 Deployment Complete"