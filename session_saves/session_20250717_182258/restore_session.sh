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
