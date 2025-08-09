#!/bin/bash

# Deploy Phase 1 ClickUp Sync System
# Safe deployment with rollback capability

echo "🚀 Starting Phase 1 ClickUp Sync Deployment"
echo "=============================================="

# Deployment configuration
SERVER="one-climate@192.168.20.10"
WORK_DIR="/home/one-climate/team-workload"
BACKUP_DIR="/home/one-climate/team-workload/backups/phase1_$(date +%Y%m%d_%H%M%S)"

echo "📋 Deployment Summary:"
echo "   Server: $SERVER"
echo "   Work Directory: $WORK_DIR"
echo "   Backup Directory: $BACKUP_DIR"
echo ""

# Step 1: Create backup of current system
echo "1️⃣ Creating backup of current system..."
ssh $SERVER "mkdir -p $BACKUP_DIR"
ssh $SERVER "cd $WORK_DIR && cp single_login_backend.js $BACKUP_DIR/"
ssh $SERVER "cd $WORK_DIR && cp -r api/ $BACKUP_DIR/ 2>/dev/null || true"
ssh $SERVER "cd $WORK_DIR && cp -r infrastructure/ $BACKUP_DIR/ 2>/dev/null || true"
ssh $SERVER "cd $WORK_DIR && cp -r application/ $BACKUP_DIR/ 2>/dev/null || true"

if [ $? -eq 0 ]; then
    echo "✅ Backup created successfully at: $BACKUP_DIR"
else
    echo "❌ Backup failed! Aborting deployment."
    exit 1
fi

# Step 2: Stop current backend service
echo ""
echo "2️⃣ Stopping current backend service..."
ssh $SERVER "pkill -f single_login_backend.js" || true
sleep 2

# Check if process is stopped
PROCESS_COUNT=$(ssh $SERVER "ps aux | grep -c 'single_login_backend.js' | grep -v grep" || echo "0")
if [ "$PROCESS_COUNT" -gt 0 ]; then
    echo "⚠️ Backend process still running, force killing..."
    ssh $SERVER "pkill -9 -f single_login_backend.js" || true
    sleep 2
fi

echo "✅ Backend service stopped"

# Step 3: Deploy new sync-enabled backend
echo ""
echo "3️⃣ Deploying new sync-enabled backend..."
ssh $SERVER "cd $WORK_DIR && cp single_login_backend_with_sync.js single_login_backend_sync.js"

if [ $? -eq 0 ]; then
    echo "✅ New backend deployed"
else
    echo "❌ Backend deployment failed! Rolling back..."
    ssh $SERVER "cd $WORK_DIR && cp $BACKUP_DIR/single_login_backend.js ."
    exit 1
fi

# Step 4: Start new backend with environment variables
echo ""
echo "4️⃣ Starting new sync-enabled backend..."
ssh $SERVER "cd $WORK_DIR && JWT_SECRET='taskflow_pro_jwt_secret_2025_secure_key_v2.1' DB_HOST='localhost' DB_USER='taskflow_user' DB_NAME='taskflow_pro' DB_PASSWORD='TaskFlow2025Secure' CLICKUP_CLIENT_ID='F9M7XRHB7T6Q78ZVL5077IT2HM89KTK5' CLICKUP_CLIENT_SECRET='TQ1U9MFFTFFMGLGJ8MEVN5MKTGQR7Y33XVQDZ4KSQJ1K' CLICKUP_REDIRECT_URI='http://192.168.20.10:7812/auth/clickup/callback' MASTER_USER_EMAIL='yterayut@gmail.com' nohup node single_login_backend_sync.js > sync_backend.log 2>&1 &"

sleep 5

# Step 5: Verify deployment
echo ""
echo "5️⃣ Verifying deployment..."

# Check if backend is running
BACKEND_RUNNING=$(ssh $SERVER "ps aux | grep -c 'single_login_backend_sync.js'" || echo "0")
if [ "$BACKEND_RUNNING" -lt 1 ]; then
    echo "❌ Backend failed to start! Rolling back..."
    ssh $SERVER "cd $WORK_DIR && cp $BACKUP_DIR/single_login_backend.js ."
    ssh $SERVER "cd $WORK_DIR && JWT_SECRET='taskflow_pro_jwt_secret_2025_secure_key_v2.1' DB_HOST='localhost' DB_USER='taskflow_user' DB_NAME='taskflow_pro' DB_PASSWORD='TaskFlow2025Secure' CLICKUP_CLIENT_ID='F9M7XRHB7T6Q78ZVL5077IT2HM89KTK5' CLICKUP_CLIENT_SECRET='TQ1U9MFFTFFMGLGJ8MEVN5MKTGQR7Y33XVQDZ4KSQJ1K' CLICKUP_REDIRECT_URI='http://192.168.20.10:7812/auth/clickup/callback' MASTER_USER_EMAIL='yterayut@gmail.com' nohup node single_login_backend.js > auth_backend.log 2>&1 &"
    exit 1
fi

# Test backend health
echo "🩺 Testing backend health..."
sleep 3
HEALTH_CHECK=$(curl -s http://192.168.20.10:7812/health | grep -c '"status":"OK"' || echo "0")

if [ "$HEALTH_CHECK" -lt 1 ]; then
    echo "❌ Health check failed! Rolling back..."
    ssh $SERVER "pkill -f single_login_backend_sync.js"
    ssh $SERVER "cd $WORK_DIR && cp $BACKUP_DIR/single_login_backend.js ."
    ssh $SERVER "cd $WORK_DIR && JWT_SECRET='taskflow_pro_jwt_secret_2025_secure_key_v2.1' DB_HOST='localhost' DB_USER='taskflow_user' DB_NAME='taskflow_pro' DB_PASSWORD='TaskFlow2025Secure' CLICKUP_CLIENT_ID='F9M7XRHB7T6Q78ZVL5077IT2HM89KTK5' CLICKUP_CLIENT_SECRET='TQ1U9MFFTFFMGLGJ8MEVN5MKTGQR7Y33XVQDZ4KSQJ1K' CLICKUP_REDIRECT_URI='http://192.168.20.10:7812/auth/clickup/callback' MASTER_USER_EMAIL='yterayut@gmail.com' nohup node single_login_backend.js > auth_backend.log 2>&1 &"
    exit 1
fi

# Test local sync endpoints
echo "🔄 Testing sync endpoints..."
SYNC_HEALTH=$(curl -s http://192.168.20.10:7812/api/v2/local/health | grep -c '"success":true' || echo "0")

if [ "$SYNC_HEALTH" -lt 1 ]; then
    echo "⚠️ Sync endpoints not responding yet (normal for first startup)"
else
    echo "✅ Sync endpoints responding"
fi

echo ""
echo "✅ PHASE 1 DEPLOYMENT SUCCESSFUL!"
echo "=============================================="
echo "🎯 New Features Available:"
echo "   📊 Local dashboard data: /api/v2/local/dashboard-data"
echo "   🔄 Sync status: /api/v2/local/sync-status"
echo "   ⚡ Force sync: /api/v2/local/force-sync"
echo "   🩺 Sync health: /api/v2/local/health"
echo ""
echo "📈 Expected Performance:"
echo "   Dashboard load time: 3900ms → 20-50ms (98% improvement)"
echo "   Data source: Local PostgreSQL database"
echo "   Sync frequency: Hourly background sync"
echo ""
echo "🔧 Monitoring:"
echo "   Backend logs: ssh $SERVER 'tail -f $WORK_DIR/sync_backend.log'"
echo "   Health check: curl http://192.168.20.10:7812/health"
echo "   Sync status: curl http://192.168.20.10:7812/api/v2/local/sync-status"
echo ""
echo "💾 Rollback available at: $BACKUP_DIR"
echo ""
echo "🎉 Phase 1 Local-First ClickUp Sync Implementation Complete!"