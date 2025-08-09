#!/bin/bash

# TaskFlow Pro - Cleanup Old Checkpoints Script
# Removes old checkpoints to free up space

echo "🧹 TaskFlow Pro - Cleanup Old Checkpoints"
echo "=========================================="
echo ""

# Default retention days
RETENTION_DAYS="${1:-30}"

# Configuration
SERVER_USER="one-climate"
SERVER_HOST="192.168.20.10"
SERVER_PASSWORD="U8@1v3z#14"
SERVER_PATH="/home/one-climate/team-workload"
LOCAL_BACKUP_DIR="./checkpoints"

echo "📋 Cleanup Configuration:"
echo "  Server: $SERVER_USER@$SERVER_HOST"
echo "  Retention: $RETENTION_DAYS days"
echo "  Server Path: $SERVER_PATH/checkpoints"
echo "  Local Path: $LOCAL_BACKUP_DIR"
echo ""

# Function to run SSH commands
run_ssh_command() {
    sshpass -p "$SERVER_PASSWORD" ssh "$SERVER_USER@$SERVER_HOST" "$1"
}

# Safety confirmation
echo "⚠️  WARNING: This will permanently delete checkpoints older than $RETENTION_DAYS days"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Cleanup cancelled by user"
    exit 0
fi

echo ""
echo "🔍 Scanning for old checkpoints..."

# Create cleanup report
CLEANUP_REPORT="cleanup_report_$(date +%Y%m%d_%H%M%S).txt"

cat > "$CLEANUP_REPORT" << EOF
TaskFlow Pro - Checkpoint Cleanup Report
========================================
Cleanup Date: $(date)
Retention Policy: $RETENTION_DAYS days
Server: $SERVER_HOST:$SERVER_PATH

EOF

# Server cleanup
echo "🖥️  Cleaning server checkpoints..."
echo ""

SERVER_OLD_CHECKPOINTS=$(run_ssh_command "cd $SERVER_PATH && [ -d checkpoints ] && find checkpoints -maxdepth 1 -type d -mtime +$RETENTION_DAYS -not -name 'checkpoints' | sort || echo 'NO_OLD_CHECKPOINTS'")

if [ "$SERVER_OLD_CHECKPOINTS" = "NO_OLD_CHECKPOINTS" ]; then
    echo "  ✅ No old checkpoints found on server"
    echo "Server Cleanup: No old checkpoints found" >> "$CLEANUP_REPORT"
else
    echo "  📋 Found old checkpoints on server:"
    echo ""
    echo "Server Checkpoints to be deleted:" >> "$CLEANUP_REPORT"
    
    DELETED_COUNT=0
    FREED_SPACE=0
    
    echo "$SERVER_OLD_CHECKPOINTS" | while read -r checkpoint_path; do
        if [ ! -z "$checkpoint_path" ]; then
            checkpoint_name=$(basename "$checkpoint_path")
            
            # Get checkpoint size before deletion
            CHECKPOINT_SIZE=$(run_ssh_command "cd $SERVER_PATH && du -sh $checkpoint_path 2>/dev/null | cut -f1 || echo 'Unknown'")
            
            # Get checkpoint info
            CHECKPOINT_INFO=$(run_ssh_command "cd $SERVER_PATH/$checkpoint_path && [ -f checkpoint_info.txt ] && head -3 checkpoint_info.txt || echo 'No info available'")
            
            echo "    📦 $checkpoint_name ($CHECKPOINT_SIZE)"
            echo "       Created: $(echo "$CHECKPOINT_INFO" | grep "Created:" | cut -d':' -f2- | xargs 2>/dev/null || echo 'Unknown')"
            
            # Add to report
            echo "  - $checkpoint_name ($CHECKPOINT_SIZE)" >> "$CLEANUP_REPORT"
            
            # Delete checkpoint
            run_ssh_command "cd $SERVER_PATH && rm -rf $checkpoint_path"
            
            if [ $? -eq 0 ]; then
                echo "       ✅ Deleted successfully"
                DELETED_COUNT=$((DELETED_COUNT + 1))
            else
                echo "       ❌ Failed to delete"
            fi
            
            echo ""
        fi
    done
    
    echo "Server cleanup completed: $DELETED_COUNT checkpoints deleted" >> "$CLEANUP_REPORT"
fi

echo ""

# Local cleanup
echo "💻 Cleaning local checkpoints..."
echo ""

if [ -d "$LOCAL_BACKUP_DIR" ]; then
    LOCAL_OLD_CHECKPOINTS=$(find "$LOCAL_BACKUP_DIR" -maxdepth 1 -type d -mtime +$RETENTION_DAYS -not -name "checkpoints" 2>/dev/null | sort)
    
    if [ -z "$LOCAL_OLD_CHECKPOINTS" ]; then
        echo "  ✅ No old local checkpoints found"
        echo "Local Cleanup: No old checkpoints found" >> "$CLEANUP_REPORT"
    else
        echo "  📋 Found old local checkpoints:"
        echo ""
        echo "Local Checkpoints to be deleted:" >> "$CLEANUP_REPORT"
        
        LOCAL_DELETED_COUNT=0
        
        echo "$LOCAL_OLD_CHECKPOINTS" | while read -r checkpoint_path; do
            if [ ! -z "$checkpoint_path" ]; then
                checkpoint_name=$(basename "$checkpoint_path")
                
                # Get checkpoint size
                LOCAL_SIZE=$(du -sh "$checkpoint_path" 2>/dev/null | cut -f1 || echo "Unknown")
                
                # Get creation date if available
                if [ -f "$checkpoint_path/LOCAL_CHECKPOINT_INFO.md" ]; then
                    CREATE_DATE=$(grep "Created" "$checkpoint_path/LOCAL_CHECKPOINT_INFO.md" | cut -d':' -f2- | xargs)
                else
                    CREATE_DATE="Unknown"
                fi
                
                echo "    📦 $checkpoint_name ($LOCAL_SIZE)"
                echo "       Created: $CREATE_DATE"
                
                # Add to report
                echo "  - $checkpoint_name ($LOCAL_SIZE)" >> "$CLEANUP_REPORT"
                
                # Delete local checkpoint
                rm -rf "$checkpoint_path"
                
                if [ $? -eq 0 ]; then
                    echo "       ✅ Deleted successfully"
                    LOCAL_DELETED_COUNT=$((LOCAL_DELETED_COUNT + 1))
                else
                    echo "       ❌ Failed to delete"
                fi
                
                echo ""
            fi
        done
        
        echo "Local cleanup completed: $LOCAL_DELETED_COUNT checkpoints deleted" >> "$CLEANUP_REPORT"
    fi
else
    echo "  ❌ Local checkpoint directory does not exist"
    echo "Local Cleanup: Directory does not exist" >> "$CLEANUP_REPORT"
fi

echo ""

# Post-cleanup verification
echo "🔍 Post-cleanup verification..."

# Count remaining checkpoints
REMAINING_SERVER=$(run_ssh_command "cd $SERVER_PATH && [ -d checkpoints ] && ls -1 checkpoints/ | wc -l || echo '0'")
REMAINING_LOCAL=0
if [ -d "$LOCAL_BACKUP_DIR" ]; then
    REMAINING_LOCAL=$(ls -1 "$LOCAL_BACKUP_DIR" 2>/dev/null | wc -l)
fi

echo "📊 Remaining checkpoints:"
echo "  Server: $REMAINING_SERVER"
echo "  Local: $REMAINING_LOCAL"

# Add summary to report
cat >> "$CLEANUP_REPORT" << EOF

Post-Cleanup Summary:
====================
Remaining Server Checkpoints: $REMAINING_SERVER
Remaining Local Checkpoints: $REMAINING_LOCAL

Cleanup Status: Completed successfully
Report Generated: $(date)

Recommendations:
- Keep at least 3-5 recent checkpoints for rollback capability
- Create new checkpoints before major system changes
- Run cleanup monthly to maintain optimal storage usage

Commands for checkpoint management:
- List remaining: ./list_checkpoints.sh
- Create new: ./create_checkpoint.sh
- Rollback if needed: ./rollback_to_checkpoint.sh <checkpoint_name>
EOF

echo ""
echo "✅ CLEANUP COMPLETED SUCCESSFULLY!"
echo "=================================="
echo ""
echo "📊 Cleanup Summary:"
echo "  Retention Policy: $RETENTION_DAYS days"
echo "  Remaining Server Checkpoints: $REMAINING_SERVER"
echo "  Remaining Local Checkpoints: $REMAINING_LOCAL"
echo ""
echo "📋 Cleanup Report: $CLEANUP_REPORT"
echo ""
echo "💡 Recommendations:"
if [ "$REMAINING_SERVER" -lt 3 ]; then
    echo "  ⚠️  Consider creating more checkpoints for better recovery options"
    echo "     Command: ./create_checkpoint.sh stable_$(date +%Y%m%d)"
fi

if [ "$REMAINING_SERVER" -eq 0 ]; then
    echo "  🚨 WARNING: No checkpoints remaining - create one immediately!"
    echo "     Command: ./create_checkpoint.sh emergency_backup"
fi

echo ""
echo "🛠️  Next Steps:"
echo "  📋 View remaining: ./list_checkpoints.sh"
echo "  💾 Create new: ./create_checkpoint.sh"
echo "  📊 View report: cat $CLEANUP_REPORT"
echo ""
echo "🎯 Checkpoint cleanup complete - storage optimized! 🎯"