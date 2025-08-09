#!/bin/bash

# TaskFlow Pro - Emergency Context Switch (One Command)
# Usage: ./emergency_switch.sh

echo "🚨 EMERGENCY CONTEXT SWITCH"
echo "=========================="
echo ""

# Step 1: Auto save
echo "1️⃣ Performing emergency save..."
./auto_save_now.sh > /dev/null 2>&1

# Step 2: Show handover message
echo ""
echo "2️⃣ COPY THIS MESSAGE TO NEW CONTEXT:"
echo "====================================="
cat << 'EOF'
Emergency handover from TaskFlow Pro session.
Context limit reached - auto save was triggered.

โปรดทำตามขั้นตอนนี้เพื่อต่อการทำงาน:
1. อ่าน project memory: /Users/teerayutyeerahem/CLAUDE.md
2. ตรวจสอบ system health: /Users/teerayutyeerahem/team-workload/check_system_status.sh
3. ดู latest files ใน: /Users/teerayutyeerahem/team-workload/quick_saves/
4. อ่าน emergency handover: /Users/teerayutyeerahem/team-workload/EMERGENCY_HANDOVER.txt

ระบบปัจจุบัน:
- Production: http://192.168.20.10:8888/
- Backend API: http://192.168.20.10:7810/
- Working directory: /Users/teerayutyeerahem/team-workload/
- Latest checkpoint: after_feature_Team_Attendance_tested

โปรดสรุปสถานะปัจจุบันและพร้อมต่อการทำงาน
EOF

echo ""
echo "====================================="
echo ""
echo "3️⃣ NEXT STEPS:"
echo "• Copy message above"
echo "• Start new Claude context"  
echo "• Paste message"
echo "• Continue working seamlessly!"
echo ""
echo "✅ Emergency switch ready!"

# Try to copy to clipboard (if available)
if command -v pbcopy >/dev/null 2>&1; then
    cat << 'EOF' | pbcopy
Emergency handover from TaskFlow Pro session.
Context limit reached - auto save was triggered.

โปรดทำตามขั้นตอนนี้เพื่อต่อการทำงาน:
1. อ่าน project memory: /Users/teerayutyeerahem/CLAUDE.md
2. ตรวจสอบ system health: /Users/teerayutyeerahem/team-workload/check_system_status.sh
3. ดู latest files ใน: /Users/teerayutyeerahem/team-workload/quick_saves/
4. อ่าน emergency handover: /Users/teerayutyeerahem/team-workload/EMERGENCY_HANDOVER.txt

ระบบปัจจุบัน:
- Production: http://192.168.20.10:8888/
- Backend API: http://192.168.20.10:7810/
- Working directory: /Users/teerayutyeerahem/team-workload/
- Latest checkpoint: after_feature_Team_Attendance_tested

โปรดสรุปสถานะปัจจุบันและพร้อมต่อการทำงาน
EOF
    echo "📋 Message copied to clipboard!"
fi