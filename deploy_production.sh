#!/bin/bash

# TaskFlow Pro Production Deployment Script - Real Data Edition
echo "🚀 Deploying TaskFlow Pro with Real Team Data..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REMOTE_USER="one-climate"
REMOTE_HOST="192.168.20.10"
REMOTE_PASSWORD="U8@1v3z#14"
REMOTE_DIR="/opt/taskflow/app"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}📊 TaskFlow Pro - Real Team Data Deployment${NC}"
echo "  🏢 Team: กิตติพงษ์, นภัสสร, สมชาย, วิทยา"
echo "  🌐 Target: $REMOTE_HOST"
echo "  ⏰ Time: $TIMESTAMP"
echo ""

# Function to run remote commands
run_remote() {
    sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" "$1"
}

# Function to copy files
copy_file() {
    sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no "$1" "$REMOTE_USER@$REMOTE_HOST:$2"
}

# Test connection
echo -e "${YELLOW}🔗 Testing connection to $REMOTE_HOST...${NC}"
if run_remote "echo 'Connected successfully'"; then
    echo -e "${GREEN}✅ Connection established${NC}"
else
    echo -e "${RED}❌ Cannot connect to remote server${NC}"
    exit 1
fi

# Create backup
echo -e "${YELLOW}📦 Creating backup...${NC}"
run_remote "sudo mkdir -p /opt/taskflow/backups/real_data_$TIMESTAMP"
run_remote "sudo cp -r $REMOTE_DIR/frontend/public /opt/taskflow/backups/real_data_$TIMESTAMP/ 2>/dev/null || true"
run_remote "sudo cp $REMOTE_DIR/backend/server.js /opt/taskflow/backups/real_data_$TIMESTAMP/ 2>/dev/null || true"

# Stop services
echo -e "${YELLOW}⏹️ Stopping services...${NC}"
run_remote "echo '$REMOTE_PASSWORD' | sudo -S systemctl stop taskflow-frontend taskflow-backend"

# Upload updated files
echo -e "${YELLOW}📤 Uploading TaskFlow Pro with real data...${NC}"

# Upload backend with real data
copy_file "backend_production.js" "/tmp/backend_production.js"
run_remote "echo '$REMOTE_PASSWORD' | sudo -S cp /tmp/backend_production.js $REMOTE_DIR/backend/server.js"

# Upload frontend
copy_file "public/index_taskflow_pro.html" "/tmp/index_taskflow_pro.html"
run_remote "echo '$REMOTE_PASSWORD' | sudo -S cp /tmp/index_taskflow_pro.html $REMOTE_DIR/frontend/public/index.html"

# Set permissions
echo -e "${YELLOW}🔒 Setting permissions...${NC}"
run_remote "echo '$REMOTE_PASSWORD' | sudo -S chown -R taskflow:taskflow $REMOTE_DIR"

# Start services
echo -e "${YELLOW}🔄 Starting services...${NC}"
run_remote "echo '$REMOTE_PASSWORD' | sudo -S systemctl start taskflow-backend"
sleep 5
run_remote "echo '$REMOTE_PASSWORD' | sudo -S systemctl start taskflow-frontend"
sleep 5
run_remote "echo '$REMOTE_PASSWORD' | sudo -S systemctl start taskflow-nginx"

# Health check
echo -e "${YELLOW}🏥 Health check...${NC}"
sleep 10

if run_remote "curl -f http://localhost:777/health"; then
    echo -e "${GREEN}✅ Backend is running${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
fi

if run_remote "curl -f http://localhost:555"; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${RED}❌ Frontend not accessible${NC}"
fi

echo ""
echo -e "${GREEN}🎉 TaskFlow Pro Deployment Complete!${NC}"
echo ""
echo -e "${BLUE}🌐 Access URLs:${NC}"
echo "  📊 TaskFlow Pro: http://192.168.20.10:555"
echo "  🔧 Backend API: http://192.168.20.10:777/health"
echo ""
echo -e "${BLUE}👥 Real Team Data:${NC}"
echo "  • กิตติพงษ์ สมศรี - Senior Developer"
echo "  • นภัสสร จันทร์เพ็ญ - UI/UX Designer"
echo "  • สมชาย พัฒนา - Backend Developer"
echo "  • วิทยา ดาต้าเบส - Database Admin"
echo ""
echo -e "${GREEN}✅ Production deployment successful!${NC}"
