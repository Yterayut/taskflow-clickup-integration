#!/bin/bash

# TaskFlow Pro - List Available Checkpoints Script
# Shows all available checkpoints with details

echo "📋 TaskFlow Pro - Available Checkpoints"
echo "======================================="
echo ""

# Configuration
SERVER_USER="one-climate"
SERVER_HOST="192.168.20.10"
SERVER_PASSWORD="U8@1v3z#14"
SERVER_PATH="/home/one-climate/team-workload"
LOCAL_BACKUP_DIR="./checkpoints"

# Function to run SSH commands
run_ssh_command() {
    sshpass -p "$SERVER_PASSWORD" ssh "$SERVER_USER@$SERVER_HOST" "$1"
}

echo "🔍 Scanning for checkpoints..."
echo ""

# Check server checkpoints
echo "🖥️  Server Checkpoints ($SERVER_HOST:$SERVER_PATH/checkpoints):"
echo "================================================================"

SERVER_CHECKPOINTS=$(run_ssh_command "cd $SERVER_PATH && [ -d checkpoints ] && ls -la checkpoints/ | grep '^d' | awk '{print \$9}' | grep -v '^\.$' | grep -v '^\.\.$' || echo 'NO_CHECKPOINTS'")

if [ "$SERVER_CHECKPOINTS" = "NO_CHECKPOINTS" ]; then
    echo "  ❌ No checkpoints found on server"
    echo "  💡 Create your first checkpoint: ./create_checkpoint.sh"
else
    echo "$SERVER_CHECKPOINTS" | while read -r checkpoint; do
        if [ ! -z "$checkpoint" ]; then
            # Get checkpoint details
            CHECKPOINT_INFO=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$checkpoint && [ -f checkpoint_info.txt ] && cat checkpoint_info.txt || echo 'No info available'")
            CHECKPOINT_SIZE=$(run_ssh_command "cd $SERVER_PATH/checkpoints && du -sh $checkpoint 2>/dev/null | cut -f1 || echo 'Unknown'")
            FILE_COUNT=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$checkpoint && ls -1 | wc -l")
            
            echo "  📦 $checkpoint"
            echo "     📊 Size: $CHECKPOINT_SIZE"
            echo "     📁 Files: $FILE_COUNT"
            
            # Extract creation date if available
            CREATE_DATE=$(echo "$CHECKPOINT_INFO" | grep "Created:" | head -1 | cut -d':' -f2- | xargs)
            if [ ! -z "$CREATE_DATE" ] && [ "$CREATE_DATE" != "No info available" ]; then
                echo "     📅 Created: $CREATE_DATE"
            fi
            
            # Check if files exist
            BACKEND_EXISTS=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$checkpoint && [ -f backend_comprehensive_enhanced.js ] && echo 'YES' || [ -f backend*.js ] && echo 'YES' || echo 'NO'")
            FRONTEND_EXISTS=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$checkpoint && [ -f index.html ] && echo 'YES' || echo 'NO'")
            
            echo "     🔧 Backend: $([ "$BACKEND_EXISTS" = "YES" ] && echo "✅" || echo "❌")"
            echo "     🌐 Frontend: $([ "$FRONTEND_EXISTS" = "YES" ] && echo "✅" || echo "❌")"
            echo ""
        fi
    done
fi

echo ""

# Check local checkpoints
echo "💻 Local Checkpoints ($LOCAL_BACKUP_DIR):"
echo "========================================="

if [ -d "$LOCAL_BACKUP_DIR" ]; then
    LOCAL_CHECKPOINTS=$(ls -la "$LOCAL_BACKUP_DIR" 2>/dev/null | grep '^d' | awk '{print $9}' | grep -v '^.$' | grep -v '^..$')
    
    if [ -z "$LOCAL_CHECKPOINTS" ]; then
        echo "  ❌ No local checkpoints found"
    else
        echo "$LOCAL_CHECKPOINTS" | while read -r checkpoint; do
            if [ ! -z "$checkpoint" ]; then
                LOCAL_SIZE=$(du -sh "$LOCAL_BACKUP_DIR/$checkpoint" 2>/dev/null | cut -f1 || echo "Unknown")
                LOCAL_FILES=$(ls -1 "$LOCAL_BACKUP_DIR/$checkpoint" 2>/dev/null | wc -l)
                
                echo "  📦 $checkpoint"
                echo "     📊 Size: $LOCAL_SIZE"
                echo "     📁 Files: $LOCAL_FILES"
                
                # Check if local info file exists
                if [ -f "$LOCAL_BACKUP_DIR/$checkpoint/LOCAL_CHECKPOINT_INFO.md" ]; then
                    CREATE_DATE=$(grep "Created" "$LOCAL_BACKUP_DIR/$checkpoint/LOCAL_CHECKPOINT_INFO.md" | cut -d':' -f2- | xargs)
                    echo "     📅 Created: $CREATE_DATE"
                fi
                
                echo ""
            fi
        done
    fi
else
    echo "  ❌ Local checkpoint directory does not exist"
    echo "  💡 Create checkpoints to populate this directory"
fi

echo ""

# Checkpoint management commands
echo "🛠️  Checkpoint Management Commands:"
echo "==================================="
echo "  📋 List checkpoints:     ./list_checkpoints.sh"
echo "  💾 Create checkpoint:    ./create_checkpoint.sh [name]"
echo "  🔄 Rollback to point:    ./rollback_to_checkpoint.sh <checkpoint_name>"
echo "  🔍 Compare checkpoints:  ./compare_checkpoints.sh <checkpoint1> <checkpoint2>"
echo "  🧹 Clean old points:     ./cleanup_old_checkpoints.sh [days]"
echo "  📊 Checkpoint info:      ./checkpoint_info.sh <checkpoint_name>"
echo ""

# Quick actions
echo "🚀 Quick Actions:"
echo "================="

# Get current system state
CURRENT_HEALTH=$(run_ssh_command "curl -s http://localhost:777/health 2>/dev/null | grep -o '\"version\":\"[^\"]*\"' || echo 'Backend not responding'")
echo "  🔧 Current System: $CURRENT_HEALTH"

# Get latest checkpoint
LATEST_CHECKPOINT=$(run_ssh_command "cd $SERVER_PATH && [ -d checkpoints ] && ls -t checkpoints/ | head -1 || echo 'none'")
if [ "$LATEST_CHECKPOINT" != "none" ]; then
    echo "  📦 Latest Checkpoint: $LATEST_CHECKPOINT"
    echo "  🔄 Quick Rollback: ./rollback_to_checkpoint.sh $LATEST_CHECKPOINT"
else
    echo "  📦 Latest Checkpoint: None available"
    echo "  💾 Create First: ./create_checkpoint.sh"
fi

echo ""

# Recommendations
echo "💡 Recommendations:"
echo "==================="

# Count total checkpoints
TOTAL_SERVER=$(echo "$SERVER_CHECKPOINTS" | grep -v "NO_CHECKPOINTS" | wc -l)
TOTAL_LOCAL=0
if [ -d "$LOCAL_BACKUP_DIR" ]; then
    TOTAL_LOCAL=$(ls -la "$LOCAL_BACKUP_DIR" 2>/dev/null | grep '^d' | grep -v '^\.$' | grep -v '^\.\.$' | wc -l)
fi

echo "  📊 Total Checkpoints: Server($TOTAL_SERVER), Local($TOTAL_LOCAL)"

if [ "$TOTAL_SERVER" -eq 0 ]; then
    echo "  ⚠️  No checkpoints found - create one before making changes"
    echo "     Command: ./create_checkpoint.sh production_stable"
elif [ "$TOTAL_SERVER" -lt 3 ]; then
    echo "  💡 Consider creating more checkpoints for better recovery options"
elif [ "$TOTAL_SERVER" -gt 10 ]; then
    echo "  🧹 Consider cleaning old checkpoints to save space"
    echo "     Command: ./cleanup_old_checkpoints.sh 30"
fi

if [ "$TOTAL_LOCAL" -eq 0 ] && [ "$TOTAL_SERVER" -gt 0 ]; then
    echo "  💾 Download server checkpoints locally for offline backup"
fi

echo ""
echo "✅ Checkpoint scan complete!"