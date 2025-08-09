#!/bin/bash

# TaskFlow Pro Production Deployment Script
echo "🚀 Starting TaskFlow Pro Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
LOCAL_DIR="/Users/teerayutyeerahem/team-workload"
REMOTE_USER="one-climate"
REMOTE_HOST="192.168.20.10"
REMOTE_PASSWORD="U8@1v3z#14"
REMOTE_DIR="/opt/taskflow/app"
BACKUP_DIR="/opt/taskflow/backups"

# Create timestamp for backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="taskflow_pro_deploy_${TIMESTAMP}"

echo -e "${BLUE}📦 Deployment Configuration:${NC}"
echo "  Local Dir: $LOCAL_DIR"
echo "  Remote Host: $REMOTE_HOST"
echo "  Remote User: $REMOTE_USER"
echo "  Remote Dir: $REMOTE_DIR"
echo "  Backup: $BACKUP_NAME"
echo ""

# Function to run remote commands
run_remote() {
    local cmd="$1"
    sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" "$cmd"
}

# Function to copy files to remote
copy_to_remote() {
    local local_file="$1"
    local remote_file="$2"
    sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no "$local_file" "$REMOTE_USER@$REMOTE_HOST:$remote_file"
}

# Check if sshpass is available
if ! command -v sshpass &> /dev/null; then
    echo -e "${RED}❌ sshpass not found. Installing...${NC}"
    # Try to install sshpass
    if command -v brew &> /dev/null; then
        brew install sshpass
    elif command -v apt-get &> /dev/null; then
        sudo apt-get install -y sshpass
    else
        echo -e "${RED}❌ Please install sshpass manually${NC}"
        exit 1
    fi
fi

# Step 1: Test connection
echo -e "${YELLOW}🔗 Testing remote connection...${NC}"
if run_remote "echo 'Connection successful'"; then
    echo -e "${GREEN}✅ Remote connection established${NC}"
else
    echo -e "${RED}❌ Failed to connect to remote server${NC}"
    exit 1
fi

# Step 2: Create backup
echo -e "${YELLOW}📦 Creating backup on remote server...${NC}"
run_remote "sudo mkdir -p $BACKUP_DIR/$BACKUP_NAME"
run_remote "sudo cp -r $REMOTE_DIR/frontend/public $BACKUP_DIR/$BACKUP_NAME/frontend_backup 2>/dev/null || true"
run_remote "sudo cp $REMOTE_DIR/backend/taskflow-backend $BACKUP_DIR/$BACKUP_NAME/backend_backup 2>/dev/null || true"
echo -e "${GREEN}✅ Backup created: $BACKUP_NAME${NC}"

# Step 3: Stop services
echo -e "${YELLOW}⏹️ Stopping remote services...${NC}"
run_remote "echo '$REMOTE_PASSWORD' | sudo -S systemctl stop taskflow-frontend taskflow-backend 2>/dev/null || true"
sleep 3

# Step 4: Upload TaskFlow Pro files
echo -e "${YELLOW}📤 Uploading TaskFlow Pro files...${NC}"

# Upload frontend
echo "  📄 Uploading frontend..."
copy_to_remote "$LOCAL_DIR/public/index.html" "/tmp/index_taskflow_pro.html"
run_remote "echo '$REMOTE_PASSWORD' | sudo -S cp /tmp/index_taskflow_pro.html $REMOTE_DIR/frontend/public/index.html"

# Upload backend
echo "  📄 Uploading backend..."
copy_to_remote "$LOCAL_DIR/backend_production.js" "/tmp/backend_production.js"
run_remote "echo '$REMOTE_PASSWORD' | sudo -S cp /tmp/backend_production.js $REMOTE_DIR/backend/backend.js"

# Upload package.json if exists
if [ -f "$LOCAL_DIR/package.json" ]; then
    echo "  📄 Uploading package.json..."
    copy_to_remote "$LOCAL_DIR/package.json" "/tmp/package.json"
    run_remote "echo '$REMOTE_PASSWORD' | sudo -S cp /tmp/package.json $REMOTE_DIR/backend/"
fi

# Step 5: Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
run_remote "cd $REMOTE_DIR/backend && echo '$REMOTE_PASSWORD' | sudo -S npm install 2>/dev/null || true"

# Step 6: Set permissions
echo -e "${YELLOW}🔒 Setting permissions...${NC}"
run_remote "echo '$REMOTE_PASSWORD' | sudo -S chown -R taskflow:taskflow $REMOTE_DIR"
run_remote "echo '$REMOTE_PASSWORD' | sudo -S chmod +x $REMOTE_DIR/backend/server.js"

# Step 7: Update systemd service files
echo -e "${YELLOW}⚙️ Updating service configuration...${NC}"

# Create updated backend service
run_remote "echo '$REMOTE_PASSWORD' | sudo -S tee /etc/systemd/system/taskflow-backend.service > /dev/null << 'EOF'
[Unit]
Description=TaskFlow Pro Backend Service
After=network.target

[Service]
Type=simple
User=taskflow
WorkingDirectory=$REMOTE_DIR/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=777

[Install]
WantedBy=multi-user.target
EOF"

# Step 8: Reload systemd and start services
echo -e "${YELLOW}🔄 Reloading systemd and starting services...${NC}"
run_remote "echo '$REMOTE_PASSWORD' | sudo -S systemctl daemon-reload"
run_remote "echo '$REMOTE_PASSWORD' | sudo -S systemctl enable taskflow-backend taskflow-frontend"
run_remote "echo '$REMOTE_PASSWORD' | sudo -S systemctl start taskflow-backend"
sleep 5
run_remote "echo '$REMOTE_PASSWORD' | sudo -S systemctl start taskflow-frontend"
sleep 5
run_remote "echo '$REMOTE_PASSWORD' | sudo -S systemctl start taskflow-nginx"

# Step 9: Health check
echo -e "${YELLOW}🏥 Running health check...${NC}"
sleep 10

# Check if services are running
echo "  🔍 Checking backend health..."
if run_remote "curl -f http://localhost:777/health"; then
    echo -e "${GREEN}✅ Backend is responding${NC}"
else
    echo -e "${YELLOW}⚠️ Backend health check failed, checking logs...${NC}"
    run_remote "echo '$REMOTE_PASSWORD' | sudo -S journalctl -u taskflow-backend --no-pager -l | tail -10"
fi

echo "  🔍 Checking frontend access..."
if run_remote "curl -f http://localhost:555"; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${YELLOW}⚠️ Frontend access failed${NC}"
fi

# Step 10: Display results
echo ""
echo -e "${BLUE}🎉 TaskFlow Pro Deployment Completed!${NC}"
echo ""
echo -e "${GREEN}🌐 Access URLs:${NC}"
echo "  Main Application: http://192.168.20.10:555"
echo "  Backend API: http://192.168.20.10:777"
echo "  Health Check: http://192.168.20.10:777/health"
echo ""
echo -e "${GREEN}📊 Service Status:${NC}"
run_remote "systemctl is-active taskflow-nginx taskflow-frontend taskflow-backend"
echo ""
echo -e "${GREEN}📝 Next Steps:${NC}"
echo "  1. Test the application at http://192.168.20.10:555"
echo "  2. Try all 3 user roles (Manager, Team Lead, Employee)"
echo "  3. Check real data is displayed correctly"
echo "  4. Monitor logs: sudo journalctl -u taskflow-backend -f"
echo ""
echo -e "${BLUE}📦 Backup Location: $BACKUP_DIR/$BACKUP_NAME${NC}"
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
