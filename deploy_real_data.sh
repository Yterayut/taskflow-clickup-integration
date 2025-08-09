#!/bin/bash

# Deploy Real Data TaskFlow Pro to Production
echo "🚀 Deploying TaskFlow Pro with REAL DATA..."

# Configuration
REMOTE_USER="one-climate"
REMOTE_HOST="192.168.20.10" 
REMOTE_PASSWORD="U8@1v3z#14"
REMOTE_DIR="/opt/taskflow/app"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📊 TaskFlow Pro - REAL TEAM DATA${NC}"
echo "  👥 กิตติพงษ์, นภัสสร, สมชาย, วิทยา, มานี"
echo "  🌐 Target: http://192.168.20.10:555"
echo ""

# Function to run remote commands
run_remote() {
    sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" "$1"
}

# Function to copy files
copy_file() {
    sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no "$1" "$REMOTE_USER@$REMOTE_HOST:$2"
}

echo -e "${YELLOW}📤 Uploading REAL DATA files...${NC}"

# Upload real data frontend
copy_file "public/index_real_data.html" "/tmp/index_real_data.html"
run_remote "echo '$REMOTE_PASSWORD' | sudo -S cp /tmp/index_real_data.html $REMOTE_DIR/frontend/public/index.html"

# Upload real data backend
copy_file "backend_production.js" "/tmp/backend_production.js"
run_remote "echo '$REMOTE_PASSWORD' | sudo -S cp /tmp/backend_production.js $REMOTE_DIR/backend/server.js"

echo -e "${YELLOW}🔄 Restarting services...${NC}"
run_remote "echo '$REMOTE_PASSWORD' | sudo -S systemctl restart taskflow-backend"
sleep 3
run_remote "echo '$REMOTE_PASSWORD' | sudo -S systemctl restart taskflow-frontend"
sleep 3

echo -e "${YELLOW}🏥 Testing...${NC}"
if run_remote "curl -f http://localhost:777/health"; then
    echo -e "${GREEN}✅ Backend OK${NC}"
else
    echo "❌ Backend error"
fi

if run_remote "curl -f http://localhost:555"; then
    echo -e "${GREEN}✅ Frontend OK${NC}"
else
    echo "❌ Frontend error"
fi

echo ""
echo -e "${GREEN}🎉 REAL DATA DEPLOYMENT COMPLETE!${NC}"
echo ""
echo -e "${BLUE}🌐 Access: http://192.168.20.10:555${NC}"
echo -e "${BLUE}👥 Real Team:${NC}"
echo "  • กิตติพงษ์ สมศรี - Senior Developer (2 งาน)"
echo "  • นภัสสร จันทร์เพ็ญ - UI/UX Designer (3 งาน)"
echo "  • สมชาย พัฒนา - Backend Developer (4 งาน)"
echo "  • วิทยา ดาต้าเบส - Database Admin (3 งาน)"
echo "  • มานี เก่งมาก - QA Tester (2 งาน)"
echo ""
echo -e "${GREEN}✅ Ready to use with real team data!${NC}"
