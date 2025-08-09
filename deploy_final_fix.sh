#!/bin/bash

# TaskFlow Pro - Final OAuth Fix Deployment Script
# Deploy backend_final_working.js to production server

echo "🚀 TaskFlow Pro - Final OAuth Fix Deployment"
echo "=============================================="

# Server configuration
SERVER="192.168.20.10"
BACKEND_PORT="777"
FRONTEND_PORT="555"

echo "📋 Deployment Configuration:"
echo "   Server: $SERVER"
echo "   Backend Port: $BACKEND_PORT" 
echo "   Frontend Port: $FRONTEND_PORT"
echo ""

# Test server connection
echo "🔗 Testing server connection..."
if ! ping -c 1 $SERVER &> /dev/null; then
    echo "❌ Cannot reach server $SERVER"
    exit 1
fi
echo "✅ Server is reachable"

# Deploy backend
echo ""
echo "📤 Deploying backend_final_working.js..."

# Copy the final working backend
scp backend_final_working.js root@$SERVER:/opt/taskflow/app/backend/backend.js

if [ $? -eq 0 ]; then
    echo "✅ Backend file deployed successfully"
else
    echo "❌ Backend deployment failed"
    exit 1
fi

# Restart backend service
echo ""
echo "🔄 Restarting backend service..."
ssh root@$SERVER "systemctl restart taskflow-backend"

if [ $? -eq 0 ]; then
    echo "✅ Backend service restarted"
else
    echo "❌ Backend service restart failed"
    exit 1
fi

# Wait for service to start
echo ""
echo "⏳ Waiting for backend to start..."
sleep 5

# Check backend health
echo ""
echo "🩺 Checking backend health..."
HEALTH_RESPONSE=$(curl -s http://$SERVER:$BACKEND_PORT/health)

if [[ $HEALTH_RESPONSE == *"FINAL WORKING VERSION"* ]]; then
    echo "✅ Backend health check passed"
    echo "📋 Response: $HEALTH_RESPONSE"
else
    echo "❌ Backend health check failed"
    echo "📋 Response: $HEALTH_RESPONSE"
fi

# Check service status
echo ""
echo "📊 Checking service status..."
ssh root@$SERVER "systemctl status taskflow-backend --no-pager -l"

echo ""
echo "🎯 Deployment Summary:"
echo "   ✅ Backend: http://$SERVER:$BACKEND_PORT"
echo "   ✅ Frontend: http://$SERVER:$FRONTEND_PORT"
echo "   ✅ Health Check: http://$SERVER:$BACKEND_PORT/health"
echo ""
echo "🔐 OAuth Testing Steps:"
echo "   1. Go to: http://$SERVER:$FRONTEND_PORT"
echo "   2. Click 'Connect with ClickUp'"
echo "   3. Authorize in ClickUp"
echo "   4. Check server logs for OAuth flow"
echo ""
echo "📝 View logs: ssh root@$SERVER 'journalctl -u taskflow-backend -f'"
echo ""
echo "🎉 Final OAuth fix deployment completed!"