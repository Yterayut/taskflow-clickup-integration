#!/bin/bash

# TaskFlow Pro - Instant Auto Save
# One-command auto save with handover message

echo "🚨 EMERGENCY AUTO SAVE"
echo "====================="

# Get timestamp
timestamp=$(date '+%H%M%S')
date_full=$(date)

# Perform quick save
echo "💾 Saving current work..."
if [ -f "./quick_save.sh" ]; then
    ./quick_save.sh "EMERGENCY AUTO SAVE - Context limit reached"
    echo "✅ Files saved successfully"
else
    echo "❌ quick_save.sh not found"
    exit 1
fi

# Create immediate handover message
handover_file="./EMERGENCY_HANDOVER.txt"
cat > "$handover_file" << EOF
🚨 EMERGENCY CONTEXT HANDOVER
===========================
Time: $date_full
Reason: Context limit reached - auto save triggered

COPY THIS MESSAGE TO NEW CONTEXT:
"Emergency handover from auto-save at $(date '+%H:%M:%S')
Context limit was reached and auto-save was triggered.
Latest files are in quick_saves/ folder.
Please read /Users/teerayutyeerahem/CLAUDE.md first, then run ./check_system_status.sh to continue work."

Latest Files:
- Frontend: quick_saves/frontend_$timestamp.html
- Backend: quick_saves/backend_$timestamp.js

System Status:
- Production: http://192.168.20.10:8888/
- Backend API: http://192.168.20.10:7810/
- Latest Checkpoint: after_feature_Team_Attendance_tested

NEXT STEPS:
1. Start new Claude context
2. Send the message above
3. Claude will read memory and continue seamlessly
EOF

# Update CLAUDE.md with emergency note
echo "" >> /Users/teerayutyeerahem/CLAUDE.md
echo "## 🚨 EMERGENCY AUTO SAVE $(date '+%H:%M:%S')" >> /Users/teerayutyeerahem/CLAUDE.md
echo "**Trigger**: Manual emergency save" >> /Users/teerayutyeerahem/CLAUDE.md
echo "**Files**: quick_saves/frontend_$timestamp.html" >> /Users/teerayutyeerahem/CLAUDE.md
echo "**Handover**: EMERGENCY_HANDOVER.txt" >> /Users/teerayutyeerahem/CLAUDE.md
echo "" >> /Users/teerayutyeerahem/CLAUDE.md

# Show results
echo ""
echo "🎯 EMERGENCY SAVE COMPLETE!"
echo "=========================="
echo "📁 Saved files: quick_saves/frontend_$timestamp.html"
echo "📝 Handover message: $handover_file"
echo "📋 Memory updated: /Users/teerayutyeerahem/CLAUDE.md"
echo ""
echo "🔥 IMMEDIATE ACTION:"
echo "1. Open $handover_file"
echo "2. Copy the handover message"
echo "3. Start new Claude context"
echo "4. Paste the message to continue"
echo ""
echo "✅ Ready for seamless context transition!"

# Try to open handover file (if on macOS)
if command -v open >/dev/null 2>&1; then
    open "$handover_file" 2>/dev/null || true
fi