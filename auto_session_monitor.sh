#!/bin/bash

# TaskFlow Pro - Auto Session Save Monitor
# Automatically saves session when context is low (runs in background)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.auto_monitor.pid"
LOG_FILE="$SCRIPT_DIR/auto_save.log"

# Function to log with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Function to check if Claude Code session is active
check_claude_session() {
    # Check if we're in a Claude Code session (basic heuristic)
    if [[ "$TERM_PROGRAM" == *"cursor"* ]] || [[ "$TERM_PROGRAM" == *"vscode"* ]] || [[ -n "$CLAUDE_CODE_SESSION" ]]; then
        return 0
    fi
    
    # Check for Claude Code processes
    if pgrep -f "claude" > /dev/null 2>&1; then
        return 0
    fi
    
    return 1
}

# Function to estimate context usage (heuristic)
estimate_context_usage() {
    local usage=0
    
    # Check session duration (longer = more context used)
    if [ -f "$SCRIPT_DIR/.session_start" ]; then
        local start_time=$(cat "$SCRIPT_DIR/.session_start")
        local current_time=$(date +%s)
        local duration=$((current_time - start_time))
        
        # Assume ~1% context per minute (rough estimate)
        usage=$((duration / 60))
    fi
    
    # Check file modifications (more changes = more context)
    local file_changes=0
    for file in current_frontend.html master_auth_service.js; do
        if [ -f "$file" ]; then
            # If file modified in last hour, add to usage
            if [[ $(find "$file" -mmin -60 2>/dev/null) ]]; then
                file_changes=$((file_changes + 10))
            fi
        fi
    done
    
    usage=$((usage + file_changes))
    
    # Cap at 100%
    if [ $usage -gt 100 ]; then
        usage=100
    fi
    
    echo $usage
}

# Function to perform auto save
perform_auto_save() {
    log_message "AUTO SAVE TRIGGERED - Context usage high"
    
    # Run quick save with auto description
    local timestamp=$(date '+%H:%M:%S')
    local description="AUTO SAVE at $timestamp - Context limit approaching"
    
    if [ -f "$SCRIPT_DIR/quick_save.sh" ]; then
        bash "$SCRIPT_DIR/quick_save.sh" "$description" >> "$LOG_FILE" 2>&1
        log_message "Quick save completed successfully"
    else
        log_message "ERROR: quick_save.sh not found"
        return 1
    fi
    
    # Create emergency handover message
    local handover_file="$SCRIPT_DIR/emergency_handover.txt"
    cat > "$handover_file" << EOF
🚨 EMERGENCY AUTO SAVE - Context Limit Reached
=============================================
Time: $(date)
Trigger: Automatic context monitoring

IMMEDIATE ACTION REQUIRED:
1. Start new Claude context
2. Send this message to continue work:

"EMERGENCY HANDOVER from auto-save at $timestamp
Context was automatically saved due to limit approaching.
Latest work: AUTO SAVE - Context limit approaching
Files: Check quick_saves/ folder for latest
Please read /Users/teerayutyeerahem/CLAUDE.md and run ./check_system_status.sh"

Auto-saved files location: quick_saves/
System log: auto_save.log
Status: $(curl -s -w "Backend:%{http_code}" http://192.168.20.10:7810/health 2>/dev/null | tail -1 || echo "Unknown")
EOF
    
    log_message "Emergency handover created: $handover_file"
    
    # Update CLAUDE.md with emergency notice
    echo "" >> /Users/teerayutyeerahem/CLAUDE.md
    echo "## 🚨 EMERGENCY AUTO SAVE $(date '+%H:%M:%S')" >> /Users/teerayutyeerahem/CLAUDE.md
    echo "**Reason**: Context limit approaching - auto saved" >> /Users/teerayutyeerahem/CLAUDE.md
    echo "**Handover**: emergency_handover.txt" >> /Users/teerayutyeerahem/CLAUDE.md
    echo "**Next**: Start new context immediately" >> /Users/teerayutyeerahem/CLAUDE.md
    echo "" >> /Users/teerayutyeerahem/CLAUDE.md
    
    # Show alert in terminal (if possible)
    echo "🚨 EMERGENCY AUTO SAVE TRIGGERED!"
    echo "📁 Files saved to: quick_saves/"
    echo "📝 Handover message: emergency_handover.txt"
    echo "⚠️  CONTEXT LIMIT REACHED - START NEW SESSION!"
    
    # Try to show desktop notification (if available)
    if command -v osascript >/dev/null 2>&1; then
        osascript -e 'display notification "Context limit reached! Auto-save completed." with title "TaskFlow Auto Save"' 2>/dev/null || true
    fi
    
    return 0
}

# Main monitoring function
monitor_session() {
    log_message "Auto session monitor started (PID: $$)"
    
    # Record session start time
    echo $(date +%s) > "$SCRIPT_DIR/.session_start"
    
    local save_triggered=false
    local check_interval=30  # Check every 30 seconds
    local usage_threshold=85  # Trigger at 85% estimated usage
    
    while true; do
        # Check if Claude session is still active
        if ! check_claude_session; then
            log_message "Claude session ended - stopping monitor"
            break
        fi
        
        # Estimate context usage
        local usage=$(estimate_context_usage)
        log_message "Estimated context usage: $usage%"
        
        # Trigger auto save if threshold reached and not already saved
        if [ $usage -ge $usage_threshold ] && [ "$save_triggered" = false ]; then
            perform_auto_save
            save_triggered=true
            log_message "Auto save triggered at $usage% usage"
            
            # Continue monitoring but with longer intervals
            check_interval=60
        fi
        
        # Sleep before next check
        sleep $check_interval
    done
    
    log_message "Auto session monitor stopped"
    rm -f "$PID_FILE"
}

# Command line interface
case "${1:-start}" in
    "start")
        if [ -f "$PID_FILE" ]; then
            existing_pid=$(cat "$PID_FILE")
            if ps -p "$existing_pid" > /dev/null 2>&1; then
                echo "Auto monitor already running (PID: $existing_pid)"
                exit 1
            else
                rm -f "$PID_FILE"
            fi
        fi
        
        echo "🤖 Starting auto session monitor..."
        echo "📊 Will auto-save when context usage reaches 85%"
        echo "📝 Log file: $LOG_FILE"
        
        # Start monitoring in background
        monitor_session &
        monitor_pid=$!
        echo $monitor_pid > "$PID_FILE"
        
        echo "✅ Auto monitor started (PID: $monitor_pid)"
        echo "📋 Stop with: $0 stop"
        ;;
        
    "stop")
        if [ -f "$PID_FILE" ]; then
            pid=$(cat "$PID_FILE")
            if ps -p "$pid" > /dev/null 2>&1; then
                kill "$pid"
                rm -f "$PID_FILE"
                echo "🛑 Auto monitor stopped (PID: $pid)"
            else
                echo "⚠️  Auto monitor not running"
                rm -f "$PID_FILE"
            fi
        else
            echo "⚠️  Auto monitor not running"
        fi
        ;;
        
    "status")
        if [ -f "$PID_FILE" ]; then
            pid=$(cat "$PID_FILE")
            if ps -p "$pid" > /dev/null 2>&1; then
                usage=$(estimate_context_usage)
                echo "✅ Auto monitor running (PID: $pid)"
                echo "📊 Estimated context usage: $usage%"
                echo "📝 Log entries: $(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)"
            else
                echo "❌ Auto monitor not running (stale PID file)"
                rm -f "$PID_FILE"
            fi
        else
            echo "❌ Auto monitor not running"
        fi
        ;;
        
    "log")
        if [ -f "$LOG_FILE" ]; then
            echo "📝 Auto monitor log:"
            tail -20 "$LOG_FILE"
        else
            echo "📝 No log file found"
        fi
        ;;
        
    "force-save")
        echo "🚨 Forcing emergency save..."
        perform_auto_save
        ;;
        
    *)
        echo "TaskFlow Pro - Auto Session Monitor"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  start       Start auto monitoring (default)"
        echo "  stop        Stop auto monitoring"
        echo "  status      Show monitor status"
        echo "  log         Show recent log entries"
        echo "  force-save  Force emergency save now"
        echo ""
        echo "The monitor will automatically save your session when"
        echo "context usage reaches 85% (estimated)."
        ;;
esac