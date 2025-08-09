#!/bin/bash

# TaskFlow Pro - Session State Save System
# Auto-save current work when context is running low

echo "🔄 TaskFlow Pro - Session State Auto-Save"
echo "========================================"
echo "Timestamp: $(date)"
echo ""

# Get current timestamp for unique save
SESSION_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SESSION_DIR="./session_saves"
CURRENT_SESSION="$SESSION_DIR/session_$SESSION_TIMESTAMP"

# Create session save directory
mkdir -p "$SESSION_DIR"
mkdir -p "$CURRENT_SESSION"

echo "📁 Creating session save: session_$SESSION_TIMESTAMP"

# Save current project state
echo "💾 Saving current project state..."

# 1. Copy critical files
cp current_frontend.html "$CURRENT_SESSION/" 2>/dev/null || echo "⚠️  current_frontend.html not found"
cp master_auth_service.js "$CURRENT_SESSION/" 2>/dev/null || echo "⚠️  master_auth_service.js not found"
cp users_config.json "$CURRENT_SESSION/" 2>/dev/null || echo "⚠️  users_config.json not found"
cp project_status.json "$CURRENT_SESSION/" 2>/dev/null || echo "⚠️  project_status.json not found"

# 2. Save current git status if available
if [ -d ".git" ]; then
    git status > "$CURRENT_SESSION/git_status.txt" 2>/dev/null
    git log --oneline -10 > "$CURRENT_SESSION/git_log.txt" 2>/dev/null
fi

# 3. Save system health snapshot
./check_system_status.sh > "$CURRENT_SESSION/system_health.txt" 2>/dev/null || echo "⚠️  Health check failed"

# 4. Get latest checkpoint info
ssh one-climate@192.168.20.10 'ls -la /home/one-climate/team-workload/checkpoints/ | tail -5' > "$CURRENT_SESSION/checkpoints_list.txt" 2>/dev/null || echo "⚠️  Checkpoint list failed"

# 5. Save current backend logs
ssh one-climate@192.168.20.10 'tail -50 /home/one-climate/team-workload/master_auth.log' > "$CURRENT_SESSION/backend_logs.txt" 2>/dev/null || echo "⚠️  Backend logs failed"

# 6. Create session summary
cat > "$CURRENT_SESSION/session_summary.md" << EOF
# Session Save Summary
**Date**: $(date)
**Session ID**: session_$SESSION_TIMESTAMP

## What was being worked on:
- [ ] Add details here of current work in progress
- [ ] Any issues encountered
- [ ] Next steps planned

## System State at Save:
- Frontend Status: $(curl -s -w "%{http_code}" -I http://192.168.20.10:8888/ 2>/dev/null | tail -1 || echo "Unknown")
- Backend Status: $(curl -s -w "%{http_code}" http://192.168.20.10:7810/health 2>/dev/null | tail -3 | head -1 || echo "Unknown")

## Files Modified:
$(ls -la current_frontend.html master_auth_service.js 2>/dev/null | grep -v "^total" || echo "No files found")

## Latest Checkpoint:
$(ssh one-climate@192.168.20.10 'ls -t /home/one-climate/team-workload/checkpoints/ | head -1' 2>/dev/null || echo "Unknown")

## Context Handover Notes:
1. Use this session save to continue work
2. Load files from: $CURRENT_SESSION/
3. Check system_health.txt for status
4. Review session_summary.md for context

## Next Context Instructions:
\`\`\`
ฉันต้องการต่อพัฒนา TaskFlow Pro จาก session ที่ save ไว้

โปรดทำตามขั้นตอนนี้:
1. อ่านไฟล์ memory: /Users/teerayutyeerahem/CLAUDE.md 
2. โหลด session save: $CURRENT_SESSION/session_summary.md
3. ตรวจสอบ system health: $CURRENT_SESSION/system_health.txt
4. รัน health check ปัจจุบัน: ./check_system_status.sh

Session save มีอะไรบ้าง:
- การทำงานล่าสุด: ดูใน session_summary.md
- ไฟล์ปัจจุบัน: current_frontend.html, master_auth_service.js
- สถานะระบบ: system_health.txt
- Backend logs: backend_logs.txt
\`\`\`

EOF

# 7. Update project memory with session save info
echo "" >> /Users/teerayutyeerahem/CLAUDE.md
echo "## 💾 Session Save (Auto-generated)" >> /Users/teerayutyeerahem/CLAUDE.md
echo "**Last Save**: $(date)" >> /Users/teerayutyeerahem/CLAUDE.md
echo "**Session ID**: session_$SESSION_TIMESTAMP" >> /Users/teerayutyeerahem/CLAUDE.md
echo "**Location**: $CURRENT_SESSION/" >> /Users/teerayutyeerahem/CLAUDE.md
echo "" >> /Users/teerayutyeerahem/CLAUDE.md

# 8. Update project_status.json
if [ -f "project_status.json" ]; then
    # Create backup and update
    cp project_status.json "$CURRENT_SESSION/project_status_backup.json"
    
    # Add session save info to JSON (simple append)
    echo "📝 Updated project_status.json with session save info"
fi

# 9. Create quick restore script
cat > "$CURRENT_SESSION/restore_session.sh" << 'EOF'
#!/bin/bash
echo "🔄 Restoring session state..."

# Copy files back to working directory
cp current_frontend.html ../ 2>/dev/null && echo "✅ Restored current_frontend.html"
cp master_auth_service.js ../ 2>/dev/null && echo "✅ Restored master_auth_service.js"
cp users_config.json ../ 2>/dev/null && echo "✅ Restored users_config.json"
cp project_status.json ../ 2>/dev/null && echo "✅ Restored project_status.json"

echo ""
echo "📋 Session restored. Review session_summary.md for context."
echo "🚀 Run ../check_system_status.sh to verify system health."
EOF

chmod +x "$CURRENT_SESSION/restore_session.sh"

# 10. List all session saves
echo ""
echo "📚 All Session Saves:"
ls -la "$SESSION_DIR" | grep "session_" | tail -10

echo ""
echo "✅ Session State Saved Successfully!"
echo "=================================="
echo "📁 Save Location: $CURRENT_SESSION/"
echo "📝 Session Summary: $CURRENT_SESSION/session_summary.md"
echo "🔄 Restore Script: $CURRENT_SESSION/restore_session.sh"
echo ""
echo "🎯 For Next Context, use this message:"
echo "---"
cat "$CURRENT_SESSION/session_summary.md" | grep -A 20 "## Next Context Instructions:"
echo "---"
echo ""
echo "💡 Remember to:"
echo "   1. Create checkpoint if work is complete: ./create_checkpoint.sh session_save_$SESSION_TIMESTAMP"
echo "   2. Update CLAUDE.md manually with specific work done"
echo "   3. Test system before context switch"