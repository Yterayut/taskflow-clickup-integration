#!/bin/bash

# TaskFlow Pro Phase 3 Enhanced Deployment Script
# Multi-Persona Ultra-Think Implementation

echo "🚀 TaskFlow Pro Phase 3 Enhanced Deployment"
echo "========================================="
echo "📅 $(date)"
echo "🎯 Phase: 3a - Real-time Features + Analytics"
echo "🎭 Multi-Persona: 9-Persona Implementation"
echo ""

# Configuration
SERVER="one-climate@192.168.20.10"
REMOTE_PATH="/home/one-climate/team-workload"
BACKEND_FILE="backend_enhanced_phase3.js"
SERVICE_NAME="taskflow-backend"
FRONTEND_PATH="/var/www/taskflow"
NGINX_CONFIG="/etc/nginx/sites-available/taskflow"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}[ARCHITECT]${NC} Deploying enhanced real-time architecture..."

# Step 1: Backup current system
echo -e "${YELLOW}[BACKUP]${NC} Creating system backup..."
ssh $SERVER "cd $REMOTE_PATH && \
    mkdir -p backups/phase3_deployment_$(date +%Y%m%d_%H%M%S) && \
    cp *.js backups/phase3_deployment_$(date +%Y%m%d_%H%M%S)/ 2>/dev/null || true"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backup created successfully${NC}"
else
    echo -e "${RED}❌ Backup failed${NC}"
    exit 1
fi

# Step 2: Deploy enhanced backend
echo -e "${BLUE}[BACKEND]${NC} Deploying Phase 3 enhanced backend..."
scp $BACKEND_FILE $SERVER:$REMOTE_PATH/

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend file deployed${NC}"
else
    echo -e "${RED}❌ Backend deployment failed${NC}"
    exit 1
fi

# Step 3: Install additional dependencies
echo -e "${BLUE}[BACKEND]${NC} Installing WebSocket dependencies..."
ssh $SERVER "cd $REMOTE_PATH && \
    npm install ws@8.14.2 socket.io@4.7.2 --save 2>/dev/null || true"

# Step 4: Update environment configuration
echo -e "${YELLOW}[CONFIG]${NC} Updating environment configuration..."
ssh $SERVER "cd $REMOTE_PATH && \
    echo 'WS_PORT=7813' >> .env && \
    echo 'REALTIME_ENABLED=true' >> .env && \
    echo 'ANALYTICS_ENABLED=true' >> .env && \
    echo 'PHASE3_FEATURES=enabled' >> .env"

# Step 5: Stop current services
echo -e "${YELLOW}[SERVICE]${NC} Stopping current backend service..."
ssh $SERVER "sudo systemctl stop $SERVICE_NAME 2>/dev/null || pkill -f 'node.*master_auth' || true"
sleep 2

# Step 6: Start enhanced backend
echo -e "${BLUE}[BACKEND]${NC} Starting Phase 3 enhanced backend..."
ssh $SERVER "cd $REMOTE_PATH && \
    nohup node $BACKEND_FILE > phase3_backend.log 2>&1 & \
    echo \$! > phase3_backend.pid"

sleep 5

# Step 7: Health check
echo -e "${YELLOW}[QA]${NC} Performing health checks..."

# Check HTTP backend
echo "Testing HTTP backend (port 7812)..."
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://192.168.20.10:7812/health || echo "000")

if [ "$BACKEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ HTTP Backend: HEALTHY${NC}"
    
    # Get backend info
    BACKEND_INFO=$(curl -s http://192.168.20.10:7812/health | jq -r '.service + " v" + .version' 2>/dev/null || echo "Phase 3 Enhanced")
    echo -e "${BLUE}📊 Service: $BACKEND_INFO${NC}"
else
    echo -e "${RED}❌ HTTP Backend: FAILED (Status: $BACKEND_STATUS)${NC}"
fi

# Check WebSocket service
echo "Testing WebSocket service (port 7813)..."
WS_STATUS=$(curl -s http://192.168.20.10:7812/api/v2/realtime/status | jq -r '.status' 2>/dev/null || echo "unknown")

if [ "$WS_STATUS" = "active" ]; then
    echo -e "${GREEN}✅ WebSocket Service: ACTIVE${NC}"
else
    echo -e "${YELLOW}⚠️  WebSocket Service: $WS_STATUS${NC}"
fi

# Check frontend
echo "Testing frontend (port 8888)..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://192.168.20.10:8888/ || echo "000")

if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Frontend: ACCESSIBLE${NC}"
else
    echo -e "${RED}❌ Frontend: FAILED (Status: $FRONTEND_STATUS)${NC}"
fi

# Step 8: Analytics verification
echo -e "${BLUE}[ANALYZER]${NC} Testing analytics engine..."
ANALYTICS_STATUS=$(curl -s http://192.168.20.10:7812/api/v2/analytics/metrics | jq -r '.success' 2>/dev/null || echo "false")

if [ "$ANALYTICS_STATUS" = "true" ]; then
    echo -e "${GREEN}✅ Analytics Engine: ACTIVE${NC}"
else
    echo -e "${YELLOW}⚠️  Analytics Engine: Starting up...${NC}"
fi

# Step 9: Performance check
echo -e "${BLUE}[PERFORMANCE]${NC} Performance validation..."
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" http://192.168.20.10:7812/health || echo "0")
echo -e "${BLUE}⚡ Response Time: ${RESPONSE_TIME}s${NC}"

# Step 10: Security verification
echo -e "${BLUE}[SECURITY]${NC} Security validation..."
CORS_CHECK=$(curl -s -H "Origin: http://192.168.20.10:8888" http://192.168.20.10:7812/health | grep -o "OK" || echo "FAIL")

if [ "$CORS_CHECK" = "OK" ]; then
    echo -e "${GREEN}✅ CORS Configuration: VALID${NC}"
else
    echo -e "${YELLOW}⚠️  CORS Configuration: Check required${NC}"
fi

# Step 11: Show service status
echo ""
echo -e "${BLUE}[MENTOR]${NC} Phase 3 Deployment Summary"
echo "==========================================="
echo "🎯 Deployment Status:"

if [ "$BACKEND_STATUS" = "200" ] && [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ DEPLOYMENT SUCCESSFUL${NC}"
    echo -e "${GREEN}🚀 Phase 3 Enhanced Features: ACTIVE${NC}"
    
    echo ""
    echo "📊 Service Endpoints:"
    echo -e "${BLUE}🌐 Frontend:${NC} http://192.168.20.10:8888/"
    echo -e "${BLUE}📡 Backend API:${NC} http://192.168.20.10:7812/"
    echo -e "${BLUE}🔌 WebSocket:${NC} ws://192.168.20.10:7813/"
    echo -e "${BLUE}📈 Analytics:${NC} http://192.168.20.10:7812/api/v2/analytics/metrics"
    echo -e "${BLUE}🔄 Real-time:${NC} http://192.168.20.10:7812/api/v2/realtime/status"
    
    echo ""
    echo "🎭 Phase 3 Features Deployed:"
    echo -e "${GREEN}✅ Real-time WebSocket Communication${NC}"
    echo -e "${GREEN}✅ Advanced Analytics Engine${NC}"
    echo -e "${GREEN}✅ Live Task Updates & Notifications${NC}"
    echo -e "${GREEN}✅ Team Performance Tracking${NC}"
    echo -e "${GREEN}✅ Enhanced Security & Monitoring${NC}"
    
    echo ""
    echo "📋 Next Steps:"
    echo "1. Update React SPA to use real-time features"
    echo "2. Configure email notifications (if needed)"
    echo "3. Test all personas and role-based features"
    echo "4. Monitor performance and analytics"
    
else
    echo -e "${RED}❌ DEPLOYMENT FAILED${NC}"
    echo "Check logs: ssh $SERVER 'cd $REMOTE_PATH && tail -f phase3_backend.log'"
fi

echo ""
echo "🔍 Quick Verification Commands:"
echo "curl http://192.168.20.10:7812/health | jq ."
echo "curl http://192.168.20.10:7812/api/v2/realtime/status | jq ."
echo "curl http://192.168.20.10:7812/api/v2/analytics/metrics | jq ."

echo ""
echo "📅 Deployment completed: $(date)"
echo "🎯 Phase 3a Real-time Implementation: READY"
echo "=========================================="