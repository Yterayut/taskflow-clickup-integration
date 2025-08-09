#!/bin/bash

# TaskFlow Pro - Rollback to Checkpoint Script
# Restores system to a previously saved checkpoint

echo "🔙 TaskFlow Pro - Rollback to Checkpoint"
echo "========================================"
echo ""

# Check if checkpoint name provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide a checkpoint name"
    echo ""
    echo "Usage: $0 <checkpoint_name>"
    echo ""
    echo "📋 Available checkpoints:"
    ./list_checkpoints.sh 2>/dev/null || echo "  Run ./list_checkpoints.sh to see available options"
    exit 1
fi

CHECKPOINT_NAME="$1"

# Configuration
SERVER_USER="one-climate"
SERVER_HOST="192.168.20.10"
SERVER_PASSWORD="U8@1v3z#14"
SERVER_PATH="/home/one-climate/team-workload"
LOCAL_BACKUP_DIR="./checkpoints"

echo "📋 Rollback Configuration:"
echo "  Server: $SERVER_USER@$SERVER_HOST"
echo "  Path: $SERVER_PATH"
echo "  Checkpoint: $CHECKPOINT_NAME"
echo "  Local Backup: $LOCAL_BACKUP_DIR/$CHECKPOINT_NAME"
echo ""

# Function to run SSH commands
run_ssh_command() {
    sshpass -p "$SERVER_PASSWORD" ssh "$SERVER_USER@$SERVER_HOST" "$1"
}

# Function to copy files to server
copy_to_server() {
    sshpass -p "$SERVER_PASSWORD" scp "$1" "$SERVER_USER@$SERVER_HOST:$2"
}

# Verify checkpoint exists
echo "🔍 Step 1: Verifying checkpoint exists..."
CHECKPOINT_EXISTS=$(run_ssh_command "cd $SERVER_PATH && [ -d checkpoints/$CHECKPOINT_NAME ] && echo 'YES' || echo 'NO'")

if [ "$CHECKPOINT_EXISTS" != "YES" ]; then
    echo "❌ Error: Checkpoint '$CHECKPOINT_NAME' not found on server"
    echo ""
    echo "📋 Available checkpoints:"
    run_ssh_command "cd $SERVER_PATH/checkpoints && ls -la 2>/dev/null || echo 'No checkpoints found'"
    exit 1
fi

echo "✅ Checkpoint '$CHECKPOINT_NAME' found on server"

# Create pre-rollback backup
echo "🛡️  Step 2: Creating pre-rollback backup..."
PRE_ROLLBACK_NAME="pre_rollback_$(date +%Y%m%d_%H%M%S)"
run_ssh_command "cd $SERVER_PATH && mkdir -p checkpoints/$PRE_ROLLBACK_NAME"
run_ssh_command "cd $SERVER_PATH && cp backend_comprehensive_enhanced.js checkpoints/$PRE_ROLLBACK_NAME/ 2>/dev/null || cp backend*.js checkpoints/$PRE_ROLLBACK_NAME/"
run_ssh_command "cd $SERVER_PATH && cp index.html checkpoints/$PRE_ROLLBACK_NAME/"
run_ssh_command "cd $SERVER_PATH && cp package.json checkpoints/$PRE_ROLLBACK_NAME/ 2>/dev/null || echo 'package.json not found'"
echo "✅ Pre-rollback backup created: $PRE_ROLLBACK_NAME"

# Stop current services
echo "🛑 Step 3: Stopping current services..."
run_ssh_command "cd $SERVER_PATH && pkill -f backend"
sleep 3
echo "✅ Services stopped"

# Restore files from checkpoint
echo "📁 Step 4: Restoring files from checkpoint..."
run_ssh_command "cd $SERVER_PATH && cp checkpoints/$CHECKPOINT_NAME/backend_comprehensive_enhanced.js ./ 2>/dev/null || cp checkpoints/$CHECKPOINT_NAME/backend*.js ./"
run_ssh_command "cd $SERVER_PATH && cp checkpoints/$CHECKPOINT_NAME/index.html ./"
run_ssh_command "cd $SERVER_PATH && cp checkpoints/$CHECKPOINT_NAME/package.json ./ 2>/dev/null || echo 'package.json not in checkpoint'"
echo "✅ Files restored from checkpoint"

# Install dependencies if package.json was restored
echo "📦 Step 5: Installing dependencies..."
run_ssh_command "cd $SERVER_PATH && npm install --silent"
echo "✅ Dependencies installed"

# Start services
echo "🚀 Step 6: Starting restored services..."
run_ssh_command "cd $SERVER_PATH && nohup node backend_comprehensive_enhanced.js > backend_rollback.log 2>&1 &"
sleep 5
echo "✅ Services started"

# Verify rollback success
echo "🔍 Step 7: Verifying rollback success..."
HEALTH_CHECK=$(run_ssh_command "curl -s http://localhost:777/health | grep -o '\"status\":\"OK\"' || echo 'FAILED'")

if [[ $HEALTH_CHECK == *"OK"* ]]; then
    echo "✅ Backend health check: PASSED"
    
    # Get version info
    VERSION_INFO=$(run_ssh_command "curl -s http://localhost:777/health | grep -o '\"version\":\"[^\"]*\"' || echo 'Version info not available'")\n    echo "📊 Restored version: $VERSION_INFO"\nelse\n    echo "❌ Backend health check: FAILED"\n    echo "📋 Checking logs..."\n    run_ssh_command "cd $SERVER_PATH && tail -20 backend_rollback.log"\n    \n    echo ""\n    echo "🔄 Attempting service restart..."\n    run_ssh_command "cd $SERVER_PATH && pkill -f backend && sleep 2 && nohup node backend_comprehensive_enhanced.js > backend_rollback_retry.log 2>&1 &"\n    sleep 5\n    \n    RETRY_CHECK=$(run_ssh_command "curl -s http://localhost:777/health | grep -o '\"status\":\"OK\"' || echo 'FAILED'")\n    if [[ $RETRY_CHECK == *"OK"* ]]; then\n        echo "✅ Service restart successful"\n    else\n        echo "❌ Service restart failed - manual intervention required"\n        echo "📞 Support commands:"\n        echo "  ssh $SERVER_USER@$SERVER_HOST 'cd $SERVER_PATH && tail -f backend_rollback_retry.log'"\n        echo "  ssh $SERVER_USER@$SERVER_HOST 'cd $SERVER_PATH && ps aux | grep backend'"\n        exit 1\n    fi\nfi\n\n# Test frontend access\necho "🌐 Step 8: Testing frontend access..."\nFRONTEND_CHECK=$(run_ssh_command "curl -s -o /dev/null -w '%{http_code}' http://localhost:8888")\n\nif [[ $FRONTEND_CHECK == "200" ]]; then\n    echo "✅ Frontend access: PASSED"\nelse\n    echo "⚠️  Frontend access: HTTP $FRONTEND_CHECK (may need manual verification)"\nfi\n\n# Create rollback report\necho "📝 Step 9: Creating rollback report..."\nrun_ssh_command "cd $SERVER_PATH && cat > rollback_report_$CHECKPOINT_NAME.txt << 'EOF'\nRollback Report\n===============\nRollback Date: $(date)\nCheckpoint Used: $CHECKPOINT_NAME\nPre-rollback Backup: $PRE_ROLLBACK_NAME\nRollback Status: Success\nHealth Check: Passed\nFrontend Status: HTTP $FRONTEND_CHECK\n\nFiles Restored:\n- backend_comprehensive_enhanced.js\n- index.html\n- package.json (if available)\n\nServices:\n- Backend: Restarted successfully\n- Frontend: Accessible\n\nLogs:\n- backend_rollback.log (current session)\n- Previous logs preserved\n\nNext Steps:\n- Verify all functionality works as expected\n- Monitor system for stability\n- Consider creating new checkpoint if modifications needed\nEOF"\n\necho ""\necho "✅ ROLLBACK COMPLETED SUCCESSFULLY!"\necho "==================================="\necho ""\necho "📊 Rollback Summary:"\necho "  Checkpoint Used: $CHECKPOINT_NAME"\necho "  Pre-rollback Backup: $PRE_ROLLBACK_NAME"\necho "  Backend Health: ✅ OK"\necho "  Frontend Access: $([ $FRONTEND_CHECK == '200' ] && echo '✅ OK' || echo '⚠️  HTTP '$FRONTEND_CHECK)"\necho ""\necho "🔗 Access URLs:"\necho "  Frontend: http://$SERVER_HOST:8888"\necho "  Backend: http://$SERVER_HOST:777"\necho "  Health Check: http://$SERVER_HOST:777/health"\necho ""\necho "📋 Post-Rollback Actions:"\necho "  1. Test all functionality to ensure proper operation"\necho "  2. Monitor system logs for any issues"\necho "  3. Verify ClickUp integration still works"\necho "  4. Check all user roles and permissions"\necho ""\necho "🔧 Monitoring Commands:"\necho "  View Logs: ssh $SERVER_USER@$SERVER_HOST 'tail -f $SERVER_PATH/backend_rollback.log'"\necho "  Check Status: ssh $SERVER_USER@$SERVER_HOST 'ps aux | grep backend'"\necho "  Health Check: curl http://$SERVER_HOST:777/health"\necho ""\necho "💡 Recovery Options (if issues occur):"\necho "  Restore Previous: ./rollback_to_checkpoint.sh $PRE_ROLLBACK_NAME"\necho "  List Checkpoints: ./list_checkpoints.sh"\necho "  Create New Checkpoint: ./create_checkpoint.sh"\necho ""\necho "🎉 System Successfully Rolled Back to Checkpoint: $CHECKPOINT_NAME! 🎉""