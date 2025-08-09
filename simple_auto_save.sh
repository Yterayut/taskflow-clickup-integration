#!/bin/bash

# TaskFlow Pro - Simple Auto Save System
# Simpler version that auto-saves periodically

echo "🤖 TaskFlow Auto Save - Simplified"
echo "================================="

# Create log file
LOG_FILE="./auto_save_simple.log"
echo "[$(date)] Auto save started" > "$LOG_FILE"

# Function to auto save
auto_save() {
    echo "[$(date)] Performing auto save..." >> "$LOG_FILE"
    
    # Quick save with timestamp
    timestamp=$(date '+%H%M%S')
    description="AUTO-SAVE $timestamp"
    
    if [ -f "./quick_save.sh" ]; then
        ./quick_save.sh "$description" >> "$LOG_FILE" 2>&1
        echo "✅ Auto save completed at $(date '+%H:%M:%S')"
        echo "[$(date)] Auto save completed successfully" >> "$LOG_FILE"
        
        # Show notification
        echo "🚨 AUTO SAVE COMPLETED!"
        echo "📁 Files saved to quick_saves/"
        echo "📝 Next context message in: quick_saves/handover_$timestamp.txt"
        
        # Create simple handover
        echo "QUICK HANDOVER: Auto-saved at $(date '+%H:%M:%S')" > "./latest_handover.txt"
        echo "Files: quick_saves/frontend_$timestamp.html" >> "./latest_handover.txt"
        echo "Message: ต่องานจาก auto-save เมื่อ $(date '+%H:%M:%S')" >> "./latest_handover.txt"
        
    else
        echo "❌ quick_save.sh not found" >> "$LOG_FILE"
    fi
}

# Auto save every 10 minutes (600 seconds)
echo "🔄 Auto save will run every 10 minutes"
echo "📝 Log: $LOG_FILE"
echo "⏹️  Stop with Ctrl+C"
echo ""

counter=0
while true; do
    sleep 60  # Check every minute
    counter=$((counter + 1))
    
    echo "⏱️  Minute $counter (auto save at minute 10, 20, 30...)"
    
    # Auto save every 10 minutes
    if [ $((counter % 10)) -eq 0 ]; then
        auto_save
        echo ""
        echo "Next auto save in 10 minutes..."
    fi
done