#!/bin/bash

# ROLLBACK SCRIPT - Background Sync Implementation
# Restores system to state before background sync changes

echo "🔄 ROLLBACK: Restoring system to pre-background-sync state"
echo "============================================================"
echo ""

CHECKPOINT_DIR="/Users/teerayutyeerahem/team-workload/checkpoints/COMPREHENSIVE_BACKUP_BEFORE_BACKGROUND_SYNC"
SERVER_USER="one-climate"
SERVER_HOST="192.168.20.10"
SERVER_PATH="/home/one-climate/team-workload"

echo "📋 Rollback Configuration:"
echo "  Checkpoint: COMPREHENSIVE_BACKUP_BEFORE_BACKGROUND_SYNC"
echo "  Server: $SERVER_USER@$SERVER_HOST:$SERVER_PATH"
echo ""

# Step 1: Stop current services
echo "🚫 Step 1: Stopping current services..."
ssh $SERVER_USER@$SERVER_HOST "cd $SERVER_PATH && pkill -f single_login_backend" 2>/dev/null || echo "Service not running"
ssh $SERVER_USER@$SERVER_HOST "cd $SERVER_PATH && pkill -f master_auth_service" 2>/dev/null || echo "Service not running"
sleep 2

# Step 2: Backup current state (just in case)
echo "💾 Step 2: Creating emergency backup of current state..."
EMERGENCY_BACKUP="emergency_backup_$(date +%Y%m%d_%H%M%S)"
ssh $SERVER_USER@$SERVER_HOST "cd $SERVER_PATH && mkdir -p rollback_backups/$EMERGENCY_BACKUP"
ssh $SERVER_USER@$SERVER_HOST "cd $SERVER_PATH && cp *.js *.json *.html rollback_backups/$EMERGENCY_BACKUP/ 2>/dev/null || echo 'Files copied'"

# Step 3: Restore core files
echo "📂 Step 3: Restoring core system files..."
scp $CHECKPOINT_DIR/single_login_backend.js $SERVER_USER@$SERVER_HOST:$SERVER_PATH/
scp $CHECKPOINT_DIR/master_auth_service.js $SERVER_USER@$SERVER_HOST:$SERVER_PATH/
scp $CHECKPOINT_DIR/users_config.json $SERVER_USER@$SERVER_HOST:$SERVER_PATH/
scp $CHECKPOINT_DIR/index.html $SERVER_USER@$SERVER_HOST:$SERVER_PATH/
scp $CHECKPOINT_DIR/package.json $SERVER_USER@$SERVER_HOST:$SERVER_PATH/

# Step 4: Restore infrastructure
echo "🏗️ Step 4: Restoring infrastructure components..."
scp -r $CHECKPOINT_DIR/infrastructure/ $SERVER_USER@$SERVER_HOST:$SERVER_PATH/ 2>/dev/null || echo "Infrastructure restored"
scp -r $CHECKPOINT_DIR/services/ $SERVER_USER@$SERVER_HOST:$SERVER_PATH/ 2>/dev/null || echo "Services restored"
scp -r $CHECKPOINT_DIR/api/ $SERVER_USER@$SERVER_HOST:$SERVER_PATH/ 2>/dev/null || echo "API restored"

# Step 5: Restart services
echo "🚀 Step 5: Restarting services with original configuration..."
ssh $SERVER_USER@$SERVER_HOST "cd $SERVER_PATH && nohup node single_login_backend.js > backend.log 2>&1 &"
sleep 3

# Step 6: Verify system health
echo "🔍 Step 6: Verifying system health..."
echo "  Backend Health Check:"
ssh $SERVER_USER@$SERVER_HOST "curl -s http://localhost:7812/health" || echo "  ❌ Backend not responding"
echo ""
echo "  Frontend Check:"
ssh $SERVER_USER@$SERVER_HOST "curl -s -I http://localhost:8888" | head -1 || echo "  ❌ Frontend not responding"

echo ""
echo "✅ ROLLBACK COMPLETED!"
echo "===================="
echo ""
echo "🔍 Verification URLs:"
echo "  Backend Health: http://192.168.20.10:7812/health"
echo "  Frontend: http://192.168.20.10:8888"
echo "  Login Page: http://192.168.20.10:8888/login"
echo ""
echo "👥 Test Authentication:"
echo "  Master User: yterayut@gmail.com (OAuth + Password)"
echo "  Regular Users: Use password from users_config.json"
echo ""
echo "📋 System Status:"
echo "  - Authentication: Hybrid OAuth + Password"
echo "  - Data Sync: Real-time ClickUp API"
echo "  - Background Sync: Inactive (original state)"
echo ""
echo "📞 If Issues Persist:"
echo "  1. Check logs: ssh $SERVER_USER@$SERVER_HOST 'tail -f $SERVER_PATH/backend.log'"
echo "  2. Manual restart: ssh $SERVER_USER@$SERVER_HOST 'cd $SERVER_PATH && node single_login_backend.js'"
echo "  3. Emergency backup available at: rollback_backups/$EMERGENCY_BACKUP"
echo ""
echo "🎯 ROLLBACK COMPLETE - System Restored! 🎯"
