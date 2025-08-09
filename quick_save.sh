#!/bin/bash

# TaskFlow Pro - Quick Save (เมื่อ Context เหลือน้อย)
# Usage: ./quick_save.sh "working on attendance features"

WORK_DESCRIPTION="$1"
if [ -z "$WORK_DESCRIPTION" ]; then
    WORK_DESCRIPTION="Context running low - auto save"
fi

echo "⚡ Quick Save: $WORK_DESCRIPTION"
echo "================================"

# Quick timestamp
TIMESTAMP=$(date +"%H%M%S")
QUICK_SAVE_DIR="./quick_saves"
mkdir -p "$QUICK_SAVE_DIR"

# Save essential files only
echo "💾 Saving essential files..."
cp current_frontend.html "$QUICK_SAVE_DIR/frontend_$TIMESTAMP.html" 2>/dev/null || echo "⚠️  Frontend not found"
cp master_auth_service.js "$QUICK_SAVE_DIR/backend_$TIMESTAMP.js" 2>/dev/null || echo "⚠️  Backend not found"

# Quick system check
BACKEND_STATUS=$(curl -s -w "%{http_code}" http://192.168.20.10:7810/health 2>/dev/null | tail -3 | head -1 || echo "Unknown")
FRONTEND_STATUS=$(curl -s -w "%{http_code}" -I http://192.168.20.10:8888/ 2>/dev/null | tail -1 || echo "Unknown")

# Update CLAUDE.md with quick note
echo "" >> /Users/teerayutyeerahem/CLAUDE.md
echo "## ⚡ Quick Save $(date '+%H:%M:%S')" >> /Users/teerayutyeerahem/CLAUDE.md
echo "**Work**: $WORK_DESCRIPTION" >> /Users/teerayutyeerahem/CLAUDE.md
echo "**Status**: Backend:$BACKEND_STATUS Frontend:$FRONTEND_STATUS" >> /Users/teerayutyeerahem/CLAUDE.md
echo "**Files**: quick_saves/frontend_$TIMESTAMP.html, backend_$TIMESTAMP.js" >> /Users/teerayutyeerahem/CLAUDE.md
echo "" >> /Users/teerayutyeerahem/CLAUDE.md

# Create handover note
cat > "$QUICK_SAVE_DIR/handover_$TIMESTAMP.txt" << EOF
QUICK SAVE HANDOVER
==================
Time: $(date)
Work: $WORK_DESCRIPTION

Status: Backend $BACKEND_STATUS, Frontend $FRONTEND_STATUS

Next Context Message:
"ต่อจาก quick save เมื่อ $(date '+%H:%M:%S') - $WORK_DESCRIPTION
ไฟล์ล่าสุด: quick_saves/frontend_$TIMESTAMP.html และ backend_$TIMESTAMP.js
โปรดอ่าน /Users/teerayutyeerahem/CLAUDE.md และตรวจสอบสถานะปัจจุบัน"
EOF

echo "✅ Quick save complete!"
echo "📁 Files: quick_saves/frontend_$TIMESTAMP.html"
echo "📝 Handover: quick_saves/handover_$TIMESTAMP.txt"
echo "📋 Updated: /Users/teerayutyeerahem/CLAUDE.md"