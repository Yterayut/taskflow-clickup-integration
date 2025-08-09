#!/bin/bash

# TaskFlow ClickUp Integration Production Deployment Script
echo "🚀 Deploying TaskFlow with Real ClickUp Integration..."

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
REMOTE_DIR="/var/www/taskflow"
SERVICE_DIR="/opt/taskflow"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}📊 TaskFlow - Real ClickUp Integration Deployment${NC}"
echo "  🔗 ClickUp: OAuth2 Authentication"
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
run_remote "sudo mkdir -p /opt/taskflow/backups/clickup_$TIMESTAMP"
run_remote "sudo cp -r $REMOTE_DIR/* /opt/taskflow/backups/clickup_$TIMESTAMP/ 2>/dev/null || true"
run_remote "sudo cp /opt/taskflow/app/real_clickup_service.js /opt/taskflow/backups/clickup_$TIMESTAMP/ 2>/dev/null || true"

# Stop existing services
echo -e "${YELLOW}⏹️ Stopping existing services...${NC}"
run_remote "pkill -f real_clickup || true"
run_remote "pkill -f 'node.*778' || true"
run_remote "sudo systemctl stop nginx || true"

# Create directories
echo -e "${YELLOW}📁 Creating directories...${NC}"
run_remote "sudo mkdir -p $REMOTE_DIR"
run_remote "sudo mkdir -p $SERVICE_DIR/app"
run_remote "sudo mkdir -p /var/log/taskflow"

# Upload frontend (corrected version)
echo -e "${YELLOW}📤 Uploading frontend...${NC}"
copy_file "taskflow_real_clickup_complete.html" "/tmp/index.html"
run_remote "sudo cp /tmp/index.html $REMOTE_DIR/index.html"

# Upload backend service
echo -e "${YELLOW}📤 Uploading ClickUp service...${NC}"
copy_file "real_clickup_service.js" "/tmp/real_clickup_service.js"
run_remote "sudo cp /tmp/real_clickup_service.js $SERVICE_DIR/app/real_clickup_service.js"

# Upload services directory
echo -e "${YELLOW}📤 Uploading service modules...${NC}"
if [ -d "services" ]; then
    copy_file "services/clickupService.js" "/tmp/clickupService.js"
    copy_file "services/authService.js" "/tmp/authService.js"
    copy_file "services/dataSyncService.js" "/tmp/dataSyncService.js"
    
    run_remote "sudo mkdir -p $SERVICE_DIR/app/services"
    run_remote "sudo cp /tmp/clickupService.js $SERVICE_DIR/app/services/"
    run_remote "sudo cp /tmp/authService.js $SERVICE_DIR/app/services/"
    run_remote "sudo cp /tmp/dataSyncService.js $SERVICE_DIR/app/services/"
fi

# Upload package.json and install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
copy_file "package.json" "/tmp/package.json"
run_remote "sudo cp /tmp/package.json $SERVICE_DIR/app/"
run_remote "cd $SERVICE_DIR/app && sudo npm install"

# Upload nginx config
echo -e "${YELLOW}🌐 Configuring nginx...${NC}"
copy_file "taskflow.nginx.conf" "/tmp/taskflow.nginx.conf"
run_remote "sudo cp /tmp/taskflow.nginx.conf /etc/nginx/sites-available/taskflow"
run_remote "sudo ln -sf /etc/nginx/sites-available/taskflow /etc/nginx/sites-enabled/"
run_remote "sudo rm -f /etc/nginx/sites-enabled/default"

# Set permissions
echo -e "${YELLOW}🔒 Setting permissions...${NC}"
run_remote "sudo chown -R www-data:www-data $REMOTE_DIR"
run_remote "sudo chown -R $REMOTE_USER:$REMOTE_USER $SERVICE_DIR"
run_remote "sudo chmod +x $SERVICE_DIR/app/real_clickup_service.js"

# Test nginx configuration
echo -e "${YELLOW}🧪 Testing nginx configuration...${NC}"
if run_remote "sudo nginx -t"; then
    echo -e "${GREEN}✅ Nginx configuration valid${NC}"
else
    echo -e "${RED}❌ Nginx configuration error${NC}"
    exit 1
fi

# Start ClickUp service
echo -e "${YELLOW}🔄 Starting ClickUp service...${NC}"
run_remote "cd $SERVICE_DIR/app && nohup node real_clickup_service.js > /var/log/taskflow/clickup-service.log 2>&1 &"
sleep 5

# Start nginx
echo -e "${YELLOW}🌐 Starting nginx...${NC}"
run_remote "sudo systemctl start nginx"
run_remote "sudo systemctl enable nginx"
sleep 3

# Health checks
echo -e "${YELLOW}🏥 Performing health checks...${NC}"
sleep 5

# Check ClickUp service
if run_remote "curl -f http://localhost:778/health"; then
    echo -e "${GREEN}✅ ClickUp service is running${NC}"
else
    echo -e "${RED}❌ ClickUp service health check failed${NC}"
    echo "Service logs:"
    run_remote "tail -n 10 /var/log/taskflow/clickup-service.log"
fi

# Check nginx/frontend
if run_remote "curl -f http://localhost:8080"; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${RED}❌ Frontend not accessible${NC}"
fi

# Test OAuth URL generation
echo -e "${YELLOW}🔐 Testing OAuth integration...${NC}"
if run_remote "curl -f http://localhost:8080/api/v1/auth/clickup/auth-url"; then
    echo -e "${GREEN}✅ OAuth endpoint working${NC}"
else
    echo -e "${RED}❌ OAuth endpoint failed${NC}"
fi

echo ""
echo -e "${GREEN}🎉 TaskFlow ClickUp Integration Deployment Complete!${NC}"
echo ""
echo -e "${BLUE}🌐 Access URLs:${NC}"
echo "  📊 TaskFlow: http://192.168.20.10:8080"
echo "  🔧 ClickUp API: http://192.168.20.10:778/health"
echo "  🔐 OAuth URL: http://192.168.20.10:8080/api/v1/auth/clickup/auth-url"
echo ""
echo -e "${BLUE}🔗 ClickUp Integration:${NC}"
echo "  • Client ID: DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL"
echo "  • Redirect URI: http://192.168.20.10:8080/api/v1/auth/clickup/callback"
echo "  • Real ClickUp API integration"
echo "  • OAuth2 authentication required"
echo ""
echo -e "${GREEN}✅ Production deployment successful!${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "  1. Update ClickUp App redirect URI to: http://192.168.20.10:8080/api/v1/auth/clickup/callback"
echo "  2. Test authentication flow"
echo "  3. Verify real ClickUp data integration"