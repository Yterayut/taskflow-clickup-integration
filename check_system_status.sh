#!/bin/bash

# TaskFlow Pro - System Status Check Script
# For quick health check when starting new context

echo "🚀 TaskFlow Pro - System Status Check"
echo "====================================="
echo "Timestamp: $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
echo "📁 Directory Check:"
if [ -f "current_frontend.html" ] && [ -f "master_auth_service.js" ]; then
    echo -e "${GREEN}✅ Working directory confirmed: $(pwd)${NC}"
else
    echo -e "${RED}❌ Wrong directory. Expected files not found.${NC}"
    echo "Expected: current_frontend.html, master_auth_service.js"
    echo "Run from: /Users/teerayutyeerahem/team-workload/"
    exit 1
fi

echo ""

# Check project status file
echo "📊 Project Status:"
if [ -f "project_status.json" ]; then
    echo -e "${GREEN}✅ Project status file found${NC}"
    PROJECT_VERSION=$(cat project_status.json | jq -r '.project.version' 2>/dev/null || echo "unknown")
    PROJECT_STATUS=$(cat project_status.json | jq -r '.project.status' 2>/dev/null || echo "unknown")
    echo "   Version: $PROJECT_VERSION"
    echo "   Status: $PROJECT_STATUS"
else
    echo -e "${YELLOW}⚠️  Project status file not found${NC}"
fi

echo ""

# Check server connectivity
echo "🌐 Server Connectivity:"
if ssh -o ConnectTimeout=5 one-climate@192.168.20.10 'echo "SSH connection successful"' 2>/dev/null; then
    echo -e "${GREEN}✅ SSH connection to server working${NC}"
else
    echo -e "${RED}❌ SSH connection failed${NC}"
    echo "Check: ssh one-climate@192.168.20.10"
fi

echo ""

# Check backend health
echo "🔧 Backend Service Health:"
BACKEND_HEALTH=$(ssh one-climate@192.168.20.10 'curl -s -w "%{http_code}" http://localhost:7810/health' 2>/dev/null)
HTTP_CODE="${BACKEND_HEALTH: -3}"

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Backend service is healthy (HTTP 200)${NC}"
    BACKEND_DATA=$(echo "$BACKEND_HEALTH" | sed 's/...$//')
    echo "   Service: $(echo "$BACKEND_DATA" | jq -r '.service' 2>/dev/null || echo 'Unknown')"
    echo "   Active Sessions: $(echo "$BACKEND_DATA" | jq -r '.active_sessions' 2>/dev/null || echo 'Unknown')"
    echo "   Master Token: $(echo "$BACKEND_DATA" | jq -r '.master_token_status' 2>/dev/null || echo 'Unknown')"
else
    echo -e "${RED}❌ Backend service unhealthy (HTTP $HTTP_CODE)${NC}"
    echo "Check: ssh one-climate@192.168.20.10 'cd /home/one-climate/team-workload && node master_auth_service.js'"
fi

echo ""

# Check frontend accessibility
echo "🌐 Frontend Accessibility:"
FRONTEND_STATUS=$(ssh one-climate@192.168.20.10 'curl -s -w "%{http_code}" -I http://192.168.20.10:8888/' 2>/dev/null | tail -1)

if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Frontend accessible (HTTP 200)${NC}"
    echo "   URL: http://192.168.20.10:8888/"
else
    echo -e "${RED}❌ Frontend not accessible (HTTP $FRONTEND_STATUS)${NC}"
    echo "Check: Nginx configuration and file deployment"
fi

echo ""

# Check latest checkpoint
echo "💾 Latest Checkpoint:"
LATEST_CHECKPOINT=$(ssh one-climate@192.168.20.10 'ls -t /home/one-climate/team-workload/checkpoints/ 2>/dev/null | head -1' 2>/dev/null)

if [ -n "$LATEST_CHECKPOINT" ]; then
    echo -e "${GREEN}✅ Latest checkpoint: $LATEST_CHECKPOINT${NC}"
    CHECKPOINT_DATE=$(ssh one-climate@192.168.20.10 "stat -c %y /home/one-climate/team-workload/checkpoints/$LATEST_CHECKPOINT 2>/dev/null | cut -d' ' -f1" 2>/dev/null)
    echo "   Created: $CHECKPOINT_DATE"
else
    echo -e "${YELLOW}⚠️  No checkpoints found${NC}"
fi

echo ""

# Check file sizes and dates
echo "📄 File Status:"
if [ -f "current_frontend.html" ]; then
    FRONTEND_SIZE=$(ls -lh current_frontend.html | awk '{print $5}')
    FRONTEND_DATE=$(ls -l current_frontend.html | awk '{print $6, $7, $8}')
    echo -e "${GREEN}✅ current_frontend.html: $FRONTEND_SIZE (modified: $FRONTEND_DATE)${NC}"
else
    echo -e "${RED}❌ current_frontend.html not found${NC}"
fi

if [ -f "master_auth_service.js" ]; then
    BACKEND_SIZE=$(ls -lh master_auth_service.js | awk '{print $5}')
    BACKEND_DATE=$(ls -l master_auth_service.js | awk '{print $6, $7, $8}')
    echo -e "${GREEN}✅ master_auth_service.js: $BACKEND_SIZE (modified: $BACKEND_DATE)${NC}"
else
    echo -e "${RED}❌ master_auth_service.js not found${NC}"
fi

echo ""

# Summary and recommendations
echo "🎯 System Summary:"
if [ "$HTTP_CODE" = "200" ] && [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ System Status: HEALTHY${NC}"
    echo -e "${GREEN}✅ Ready for development${NC}"
    echo ""
    echo "🚀 Quick Start Commands:"
    echo "   Test frontend: open http://192.168.20.10:8888/"
    echo "   Check logs: ssh one-climate@192.168.20.10 'tail -f /home/one-climate/team-workload/master_auth.log'"
    echo "   Deploy changes: ./deploy_real_clickup.sh"
    echo "   Create checkpoint: ./create_checkpoint.sh [name]"
else
    echo -e "${RED}❌ System Status: ISSUES DETECTED${NC}"
    echo ""
    echo "🔧 Troubleshooting Steps:"
    if [ "$HTTP_CODE" != "200" ]; then
        echo "   1. Restart backend: ssh one-climate@192.168.20.10 'cd /home/one-climate/team-workload && node master_auth_service.js'"
    fi
    if [ "$FRONTEND_STATUS" != "200" ]; then
        echo "   2. Redeploy frontend: ./deploy_real_clickup.sh"
    fi
    echo "   3. Check logs: ssh one-climate@192.168.20.10 'tail -20 /home/one-climate/team-workload/master_auth.log'"
fi

echo ""
echo "📚 Memory Files:"
echo "   Project Memory: /Users/teerayutyeerahem/CLAUDE.md"
echo "   Status Data: /Users/teerayutyeerahem/team-workload/project_status.json"
echo "   Latest Checkpoint: $LATEST_CHECKPOINT"

echo ""
echo "====================================="
echo "Status check completed at $(date)"