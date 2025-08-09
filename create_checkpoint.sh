#!/bin/bash

# TaskFlow Pro - Checkpoint Creation Script
# Creates timestamped backups for easy rollback

echo "🔄 TaskFlow Pro - Creating System Checkpoint"
echo "============================================="
echo ""

# Configuration
SERVER_USER="one-climate"
SERVER_HOST="192.168.20.10"
SERVER_PASSWORD="U8@1v3z#14"
SERVER_PATH="/home/one-climate/team-workload"
CHECKPOINT_NAME="${1:-$(date +%Y%m%d_%H%M%S)}"
LOCAL_BACKUP_DIR="./checkpoints"

echo "📋 Checkpoint Configuration:"
echo "  Server: $SERVER_USER@$SERVER_HOST"
echo "  Path: $SERVER_PATH"
echo "  Checkpoint Name: $CHECKPOINT_NAME"
echo "  Local Backup: $LOCAL_BACKUP_DIR"
echo ""

# Function to run SSH commands
run_ssh_command() {
    sshpass -p "$SERVER_PASSWORD" ssh "$SERVER_USER@$SERVER_HOST" "$1"
}

# Function to copy files from server
copy_from_server() {
    sshpass -p "$SERVER_PASSWORD" scp "$SERVER_USER@$SERVER_HOST:$1" "$2"
}

# Create local backup directory
echo "📁 Step 1: Creating local backup directory..."
mkdir -p "$LOCAL_BACKUP_DIR/$CHECKPOINT_NAME"
echo "✅ Created: $LOCAL_BACKUP_DIR/$CHECKPOINT_NAME"

# Create server-side checkpoint
echo "🗂️  Step 2: Creating server-side checkpoint..."
run_ssh_command "cd $SERVER_PATH && mkdir -p checkpoints/$CHECKPOINT_NAME"

# Backup current production files on server
echo "📦 Step 3: Backing up production files on server..."
run_ssh_command "cd $SERVER_PATH && cp backend_comprehensive_enhanced.js checkpoints/$CHECKPOINT_NAME/backend_comprehensive_enhanced.js"
run_ssh_command "cd $SERVER_PATH && cp index.html checkpoints/$CHECKPOINT_NAME/index.html"
run_ssh_command "cd $SERVER_PATH && cp package.json checkpoints/$CHECKPOINT_NAME/package.json"
run_ssh_command "cd $SERVER_PATH && cp -r node_modules checkpoints/$CHECKPOINT_NAME/node_modules 2>/dev/null || echo 'node_modules backup skipped'"

# Backup logs
echo "📋 Step 4: Backing up system logs..."
run_ssh_command "cd $SERVER_PATH && cp *.log checkpoints/$CHECKPOINT_NAME/ 2>/dev/null || echo 'No logs to backup'"

# Get current process information
echo "🔍 Step 5: Capturing current system state..."
run_ssh_command "cd $SERVER_PATH && ps aux | grep backend > checkpoints/$CHECKPOINT_NAME/process_state.txt"
run_ssh_command "cd $SERVER_PATH && curl -s http://localhost:777/health > checkpoints/$CHECKPOINT_NAME/health_check.json 2>/dev/null || echo 'Backend not responding' > checkpoints/$CHECKPOINT_NAME/health_check.txt"

# Create checkpoint metadata
echo "📝 Step 6: Creating checkpoint metadata..."
run_ssh_command "cd $SERVER_PATH && cat > checkpoints/$CHECKPOINT_NAME/checkpoint_info.txt << 'EOF'
Checkpoint Name: $CHECKPOINT_NAME
Created: $(date)
Server: $SERVER_HOST
Path: $SERVER_PATH
Created By: Automated Checkpoint Script
Purpose: Production state backup for rollback capability
Files Backed Up:
- backend_comprehensive_enhanced.js
- index.html
- package.json
- node_modules/ (if exists)
- *.log files
- process_state.txt
- health_check.json
EOF"

# Download checkpoint to local machine
echo "⬇️  Step 7: Downloading checkpoint to local machine..."
copy_from_server "$SERVER_PATH/checkpoints/$CHECKPOINT_NAME/*" "$LOCAL_BACKUP_DIR/$CHECKPOINT_NAME/"

# Create local checkpoint info
echo "📄 Step 8: Creating local checkpoint documentation..."
cat > "$LOCAL_BACKUP_DIR/$CHECKPOINT_NAME/LOCAL_CHECKPOINT_INFO.md" << EOF
# TaskFlow Pro - Checkpoint: $CHECKPOINT_NAME

## Checkpoint Information
- **Created**: $(date)
- **Server**: $SERVER_HOST:$SERVER_PATH
- **Local Backup**: $LOCAL_BACKUP_DIR/$CHECKPOINT_NAME
- **Status**: Complete

## Files Backed Up
- ✅ backend_comprehensive_enhanced.js
- ✅ index.html  
- ✅ package.json
- ✅ System logs
- ✅ Process state
- ✅ Health check data

## Rollback Instructions
To rollback to this checkpoint:

\`\`\`bash
# Using automated script
./rollback_to_checkpoint.sh $CHECKPOINT_NAME

# Or manual rollback
ssh $SERVER_USER@$SERVER_HOST "cd $SERVER_PATH && cp checkpoints/$CHECKPOINT_NAME/* ./"
ssh $SERVER_USER@$SERVER_HOST "cd $SERVER_PATH && pkill -f backend && nohup node backend_comprehensive_enhanced.js > backend.log 2>&1 &"
\`\`\`

## Verification
After rollback, verify system:
- Health Check: http://$SERVER_HOST:777/health
- Frontend: http://$SERVER_HOST:8888
- Backend Logs: ssh $SERVER_USER@$SERVER_HOST 'tail -f $SERVER_PATH/backend.log'
EOF

# List all available checkpoints
echo "📋 Step 9: Listing all available checkpoints..."
echo "Available Checkpoints:"
run_ssh_command "cd $SERVER_PATH/checkpoints && ls -la"

echo ""
echo "✅ CHECKPOINT CREATED SUCCESSFULLY!"
echo "=========================================="
echo ""
echo "📊 Checkpoint Details:"
echo "  Name: $CHECKPOINT_NAME"
echo "  Server Location: $SERVER_PATH/checkpoints/$CHECKPOINT_NAME"
echo "  Local Backup: $LOCAL_BACKUP_DIR/$CHECKPOINT_NAME"
echo ""
echo "🔄 Rollback Options:"
echo "  Automated: ./rollback_to_checkpoint.sh $CHECKPOINT_NAME"
echo "  Manual: Follow instructions in LOCAL_CHECKPOINT_INFO.md"
echo ""
echo "📋 Checkpoint Management:"
echo "  List All: ./list_checkpoints.sh"
echo "  Compare: ./compare_checkpoints.sh"
echo "  Clean Old: ./cleanup_old_checkpoints.sh"
echo ""
echo "💡 Next Steps:"
echo "  1. Verify checkpoint integrity"
echo "  2. Test rollback procedure (optional)"
echo "  3. Continue with system modifications"
echo "  4. Create new checkpoints before major changes"
echo ""
echo "🎯 Checkpoint Complete - System State Preserved! 🎯"