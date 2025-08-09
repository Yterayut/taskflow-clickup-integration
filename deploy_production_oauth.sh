#!/bin/bash

# Deploy Production OAuth Backend to Remote Server
echo "🚀 Deploy Production OAuth Backend - TaskFlow Pro"
echo "================================================"

# Server config
SERVER="192.168.20.10"
USER="root"
BACKEND_FILE="backend_production_oauth.js"
FRONTEND_FILE="frontend_dual_auth.html"

echo "📤 Deploying production OAuth backend to server..."

# Check if backend file exists
if [ ! -f "$BACKEND_FILE" ]; then
    echo "❌ Backend file $BACKEND_FILE not found"
    exit 1
fi

# Check if frontend file exists
if [ ! -f "$FRONTEND_FILE" ]; then
    echo "❌ Frontend file $FRONTEND_FILE not found"
    exit 1
fi

echo "✅ Files found, starting deployment..."

# Upload backend to server
echo "📤 Uploading production OAuth backend..."
scp $BACKEND_FILE $USER@$SERVER:/opt/taskflow/app/backend/backend.js

if [ $? -eq 0 ]; then
    echo "✅ Backend upload successful"
else
    echo "❌ Backend upload failed - check SSH connection"
    exit 1
fi

# Upload frontend to server
echo "📤 Uploading dual auth frontend..."
scp $FRONTEND_FILE $USER@$SERVER:/opt/taskflow/app/frontend/index.html

if [ $? -eq 0 ]; then
    echo "✅ Frontend upload successful"
else
    echo "❌ Frontend upload failed - check SSH connection"
    exit 1
fi

echo ""
echo "🔄 Restarting services on server..."

# Restart services on server
ssh $USER@$SERVER << 'EOF'
echo "🛑 Stopping existing services..."
systemctl stop taskflow-backend
systemctl stop taskflow-frontend

echo "🚀 Starting production OAuth backend..."
systemctl start taskflow-backend

echo "🌐 Starting frontend service..."
systemctl start taskflow-frontend

echo "⏳ Waiting for services to start..."
sleep 5

echo "🔍 Checking service status..."
echo "Backend Status:"
systemctl status taskflow-backend --no-pager -l | head -10

echo ""
echo "Frontend Status:"
systemctl status taskflow-frontend --no-pager -l | head -10

echo ""
echo "🩺 Testing backend health..."
curl -s http://localhost:777/health | head -5

echo ""
echo "📊 Backend logs (last 10 lines):"
journalctl -u taskflow-backend -n 10 --no-pager

echo ""
echo "🌐 Testing frontend access..."
curl -s -I http://localhost:555 | head -3
EOF

echo ""
echo "✅ Deployment completed!"
echo ""
echo "🔧 Production OAuth URLs:"
echo "Frontend: http://192.168.20.10:555"
echo "Backend Health: http://192.168.20.10:777/health"
echo "OAuth URL: http://192.168.20.10:777/api/v1/auth/clickup/auth-url"
echo "OAuth Redirect: http://192.168.20.10:777/api/v1/auth/clickup/authorize"
echo ""
echo "🎯 Test OAuth Flow:"
echo "1. Go to: http://192.168.20.10:555"
echo "2. Click 'Connect with ClickUp'"
echo "3. Authorize in ClickUp"
echo "4. Should redirect to: http://192.168.20.10:777/api/v1/auth/clickup/callback"
echo "5. Then redirect back to frontend with success"
echo ""
echo "📝 Monitor logs: ssh root@192.168.20.10 'journalctl -u taskflow-backend -f'"