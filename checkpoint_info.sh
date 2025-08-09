#!/bin/bash

# TaskFlow Pro - Checkpoint Information Script
# Shows detailed information about a specific checkpoint

echo "📊 TaskFlow Pro - Checkpoint Information"
echo "========================================"
echo ""

# Check if checkpoint name provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide a checkpoint name"
    echo ""
    echo "Usage: $0 <checkpoint_name>"
    echo ""
    echo "📋 Available checkpoints:"
    ./list_checkpoints.sh 2>/dev/null | grep "📦" | head -5
    exit 1
fi

CHECKPOINT_NAME="$1"

# Configuration
SERVER_USER="one-climate"
SERVER_HOST="192.168.20.10"
SERVER_PASSWORD="U8@1v3z#14"
SERVER_PATH="/home/one-climate/team-workload"
LOCAL_BACKUP_DIR="./checkpoints"

echo "📋 Checkpoint: $CHECKPOINT_NAME"
echo "🖥️  Server: $SERVER_USER@$SERVER_HOST"
echo ""

# Function to run SSH commands
run_ssh_command() {
    sshpass -p "$SERVER_PASSWORD" ssh "$SERVER_USER@$SERVER_HOST" "$1"
}

# Verify checkpoint exists
echo "🔍 Locating checkpoint..."

SERVER_EXISTS=$(run_ssh_command "cd $SERVER_PATH && [ -d checkpoints/$CHECKPOINT_NAME ] && echo 'YES' || echo 'NO'")
LOCAL_EXISTS="NO"
if [ -d "$LOCAL_BACKUP_DIR/$CHECKPOINT_NAME" ]; then
    LOCAL_EXISTS="YES"
fi

if [ "$SERVER_EXISTS" = "NO" ] && [ "$LOCAL_EXISTS" = "NO" ]; then
    echo "❌ Error: Checkpoint '$CHECKPOINT_NAME' not found on server or locally"
    echo ""
    echo "📋 Available checkpoints:"
    ./list_checkpoints.sh 2>/dev/null | grep "📦" | head -10
    exit 1
fi

echo "📍 Checkpoint Locations:"
echo "  Server: $([ "$SERVER_EXISTS" = "YES" ] && echo "✅ Found" || echo "❌ Not found")"
echo "  Local: $([ "$LOCAL_EXISTS" = "YES" ] && echo "✅ Found" || echo "❌ Not found")"
echo ""

# Server checkpoint information
if [ "$SERVER_EXISTS" = "YES" ]; then
    echo "🖥️  SERVER CHECKPOINT DETAILS"
    echo "============================="
    
    # Get basic info
    CHECKPOINT_PATH="$SERVER_PATH/checkpoints/$CHECKPOINT_NAME"
    CHECKPOINT_SIZE=$(run_ssh_command "cd $SERVER_PATH/checkpoints && du -sh $CHECKPOINT_NAME 2>/dev/null | cut -f1 || echo 'Unknown'")
    FILE_COUNT=$(run_ssh_command "cd $CHECKPOINT_PATH && ls -1 | wc -l")
    CREATION_TIME=$(run_ssh_command "cd $SERVER_PATH/checkpoints && stat -c %y $CHECKPOINT_NAME 2>/dev/null | cut -d. -f1 || echo 'Unknown'")
    
    echo "📊 Basic Information:"
    echo "  Size: $CHECKPOINT_SIZE"
    echo "  Files: $FILE_COUNT"
    echo "  Created: $CREATION_TIME"
    echo "  Path: $CHECKPOINT_PATH"
    echo ""
    
    # Get checkpoint metadata if available
    echo "📝 Checkpoint Metadata:"
    CHECKPOINT_INFO=$(run_ssh_command "cd $CHECKPOINT_PATH && [ -f checkpoint_info.txt ] && cat checkpoint_info.txt || echo 'No metadata file found'")
    
    if [ "$CHECKPOINT_INFO" != "No metadata file found" ]; then
        echo "$CHECKPOINT_INFO" | while IFS= read -r line; do
            echo "  $line"
        done
    else
        echo "  ❌ No metadata available"
    fi
    echo ""
    
    # List all files in checkpoint
    echo "📁 Files in Checkpoint:"
    CHECKPOINT_FILES=$(run_ssh_command "cd $CHECKPOINT_PATH && ls -la")
    echo "$CHECKPOINT_FILES" | while IFS= read -r line; do
        if [[ $line != total* ]] && [[ $line != .* ]]; then
            echo "  $line"
        fi
    done
    echo ""
    
    # Check specific important files
    echo "🔧 Critical Files Status:"
    
    # Backend file
    BACKEND_STATUS=$(run_ssh_command "cd $CHECKPOINT_PATH && [ -f backend_comprehensive_enhanced.js ] && echo 'FOUND' || [ -f backend*.js ] && echo 'DIFFERENT' || echo 'MISSING'")
    echo "  Backend: $([ "$BACKEND_STATUS" = "FOUND" ] && echo "✅ backend_comprehensive_enhanced.js" || [ "$BACKEND_STATUS" = "DIFFERENT" ] && echo "⚠️ Different backend file found" || echo "❌ Missing")"
    
    if [ "$BACKEND_STATUS" = "FOUND" ]; then
        BACKEND_SIZE=$(run_ssh_command "cd $CHECKPOINT_PATH && ls -lh backend_comprehensive_enhanced.js | awk '{print \$5}'")
        BACKEND_DATE=$(run_ssh_command "cd $CHECKPOINT_PATH && ls -la backend_comprehensive_enhanced.js | awk '{print \$6, \$7, \$8}'")
        echo "    Size: $BACKEND_SIZE, Modified: $BACKEND_DATE"
    fi
    
    # Frontend file
    FRONTEND_STATUS=$(run_ssh_command "cd $CHECKPOINT_PATH && [ -f index.html ] && echo 'FOUND' || echo 'MISSING'")
    echo "  Frontend: $([ "$FRONTEND_STATUS" = "FOUND" ] && echo "✅ index.html" || echo "❌ Missing")"
    
    if [ "$FRONTEND_STATUS" = "FOUND" ]; then
        FRONTEND_SIZE=$(run_ssh_command "cd $CHECKPOINT_PATH && ls -lh index.html | awk '{print \$5}'")
        FRONTEND_DATE=$(run_ssh_command "cd $CHECKPOINT_PATH && ls -la index.html | awk '{print \$6, \$7, \$8}'")
        echo "    Size: $FRONTEND_SIZE, Modified: $FRONTEND_DATE"
    fi
    
    # Package.json
    PACKAGE_STATUS=$(run_ssh_command "cd $CHECKPOINT_PATH && [ -f package.json ] && echo 'FOUND' || echo 'MISSING'")
    echo "  Config: $([ "$PACKAGE_STATUS" = "FOUND" ] && echo "✅ package.json" || echo "❌ Missing")"
    
    # Health check data
    HEALTH_STATUS=$(run_ssh_command "cd $CHECKPOINT_PATH && [ -f health_check.json ] && echo 'FOUND' || echo 'MISSING'")
    echo "  Health: $([ "$HEALTH_STATUS" = "FOUND" ] && echo "✅ health_check.json" || echo "❌ Missing")"
    
    if [ "$HEALTH_STATUS" = "FOUND" ]; then
        VERSION_INFO=$(run_ssh_command "cd $CHECKPOINT_PATH && cat health_check.json | grep -o '\"version\":\"[^\"]*\"' | cut -d':' -f2 | tr -d '\"' || echo 'Unknown'")
        SERVICE_INFO=$(run_ssh_command "cd $CHECKPOINT_PATH && cat health_check.json | grep -o '\"service\":\"[^\"]*\"' | cut -d':' -f2 | tr -d '\"' || echo 'Unknown'")
        echo "    Version: $VERSION_INFO"
        echo "    Service: $SERVICE_INFO"
    fi
    
    # Process state
    PROCESS_STATUS=$(run_ssh_command "cd $CHECKPOINT_PATH && [ -f process_state.txt ] && echo 'FOUND' || echo 'MISSING'")
    echo "  Process: $([ "$PROCESS_STATUS" = "FOUND" ] && echo "✅ process_state.txt" || echo "❌ Missing")"
    
    echo ""
fi

# Local checkpoint information
if [ "$LOCAL_EXISTS" = "YES" ]; then
    echo "💻 LOCAL CHECKPOINT DETAILS"
    echo "==========================="
    
    LOCAL_PATH="$LOCAL_BACKUP_DIR/$CHECKPOINT_NAME"
    LOCAL_SIZE=$(du -sh "$LOCAL_PATH" 2>/dev/null | cut -f1 || echo "Unknown")
    LOCAL_FILES=$(ls -1 "$LOCAL_PATH" 2>/dev/null | wc -l)
    
    echo "📊 Basic Information:"
    echo "  Size: $LOCAL_SIZE"
    echo "  Files: $LOCAL_FILES"
    echo "  Path: $LOCAL_PATH"
    echo ""
    
    # Check for local metadata
    if [ -f "$LOCAL_PATH/LOCAL_CHECKPOINT_INFO.md" ]; then
        echo "📝 Local Metadata:"
        grep -E "^-|^##|Created|Status" "$LOCAL_PATH/LOCAL_CHECKPOINT_INFO.md" | while IFS= read -r line; do
            echo "  $line"
        done
        echo ""
    fi
    
    # List local files
    echo "📁 Local Files:"
    ls -la "$LOCAL_PATH" | while IFS= read -r line; do
        if [[ $line != total* ]] && [[ $line != .* ]]; then
            echo "  $line"
        fi
    done
    echo ""
fi

# Checkpoint integrity check
echo "🔍 CHECKPOINT INTEGRITY CHECK"
echo "============================="

if [ "$SERVER_EXISTS" = "YES" ]; then
    echo "📊 Server Checkpoint Integrity:"
    
    # Check if critical files exist
    CRITICAL_FILES=0
    TOTAL_CRITICAL=3
    
    if [ "$BACKEND_STATUS" = "FOUND" ]; then
        CRITICAL_FILES=$((CRITICAL_FILES + 1))
    fi
    
    if [ "$FRONTEND_STATUS" = "FOUND" ]; then
        CRITICAL_FILES=$((CRITICAL_FILES + 1))
    fi
    
    if [ "$HEALTH_STATUS" = "FOUND" ]; then
        CRITICAL_FILES=$((CRITICAL_FILES + 1))
    fi
    
    INTEGRITY_PERCENTAGE=$((CRITICAL_FILES * 100 / TOTAL_CRITICAL))
    
    echo "  Critical Files: $CRITICAL_FILES/$TOTAL_CRITICAL (${INTEGRITY_PERCENTAGE}%)"
    
    if [ "$INTEGRITY_PERCENTAGE" -ge 100 ]; then
        echo "  Status: ✅ Complete - All critical files present"
        ROLLBACK_SAFE="YES"
    elif [ "$INTEGRITY_PERCENTAGE" -ge 66 ]; then
        echo "  Status: ⚠️ Partial - Most critical files present"
        ROLLBACK_SAFE="PARTIAL"
    else
        echo "  Status: ❌ Incomplete - Missing critical files"
        ROLLBACK_SAFE="NO"
    fi
    
    echo "  Rollback Safety: $([ "$ROLLBACK_SAFE" = "YES" ] && echo "✅ Safe" || [ "$ROLLBACK_SAFE" = "PARTIAL" ] && echo "⚠️ Risky" || echo "❌ Not recommended")"
fi

echo ""

# Usage recommendations
echo "💡 USAGE RECOMMENDATIONS"
echo "========================"

if [ "$SERVER_EXISTS" = "YES" ] && [ "$ROLLBACK_SAFE" = "YES" ]; then
    echo "✅ This checkpoint is complete and safe for rollback"
    echo ""
    echo "🔄 Rollback Command:"
    echo "  ./rollback_to_checkpoint.sh $CHECKPOINT_NAME"
    echo ""
    echo "📋 What will be restored:"
    echo "  - Backend application files"
    echo "  - Frontend interface files"
    echo "  - Configuration files"
    echo "  - System state information"
    
elif [ "$SERVER_EXISTS" = "YES" ] && [ "$ROLLBACK_SAFE" = "PARTIAL" ]; then
    echo "⚠️ This checkpoint has some missing files - use with caution"
    echo ""
    echo "🔄 Rollback Command (use carefully):"
    echo "  ./rollback_to_checkpoint.sh $CHECKPOINT_NAME"
    echo ""
    echo "⚠️ Warning: Some files may be missing, manual intervention might be needed"
    
elif [ "$SERVER_EXISTS" = "YES" ] && [ "$ROLLBACK_SAFE" = "NO" ]; then
    echo "❌ This checkpoint is incomplete - rollback not recommended"
    echo ""
    echo "🚨 Issues found:"
    echo "  - Critical files are missing"
    echo "  - Rollback may fail or cause system instability"
    echo ""
    echo "💡 Recommendations:"
    echo "  - Use a different, more complete checkpoint"
    echo "  - Create a new checkpoint from current state if system is stable"
    
else
    echo "ℹ️ Checkpoint only available locally"
    echo ""
    echo "📤 To upload to server:"
    echo "  # Manual upload required - contact administrator"
fi

echo ""
echo "🛠️  Related Commands:"
echo "  📋 List all checkpoints: ./list_checkpoints.sh"
echo "  💾 Create new checkpoint: ./create_checkpoint.sh"
echo "  🔍 Compare checkpoints: ./compare_checkpoints.sh $CHECKPOINT_NAME <other_checkpoint>"
echo "  🧹 Cleanup old checkpoints: ./cleanup_old_checkpoints.sh"

echo ""
echo "✅ Checkpoint information complete!"