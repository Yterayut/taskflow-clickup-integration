#!/bin/bash

# Deploy Production OAuth Backend with SSH Credentials
echo "🚀 Deploy Production OAuth Backend - TaskFlow Pro"
echo "================================================"

# Server config
SERVER="192.168.20.10"
USER="one-climate"
PASSWORD="U8@1v3z#14"
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

# Test SSH connection first
echo "🔍 Testing SSH connection..."
sshpass -p "$PASSWORD" ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no $USER@$SERVER 'echo "SSH connection successful"'

if [ $? -ne 0 ]; then
    echo "❌ SSH connection failed"
    exit 1
fi

echo "✅ SSH connection verified"

# Upload backend to server
echo "📤 Uploading production OAuth backend..."
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no $BACKEND_FILE $USER@$SERVER:~/team-workload/backend_production.js

if [ $? -eq 0 ]; then
    echo "✅ Backend upload successful"
else
    echo "❌ Backend upload failed"
    exit 1
fi

# Upload frontend to server  
echo "📤 Uploading dual auth frontend..."
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no $FRONTEND_FILE $USER@$SERVER:~/team-workload/index.html

if [ $? -eq 0 ]; then
    echo "✅ Frontend upload successful"
else
    echo "❌ Frontend upload failed"
    exit 1
fi

echo ""
echo "🔄 Deploying files and restarting services on server..."

# Deploy and restart services on server
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
echo "🚀 TaskFlow Production OAuth Deployment"
echo "======================================"

# Check current directory
pwd
ls -la ~/team-workload/

# Copy backend to proper location
echo "📁 Copying backend to service location..."
if [ -d "/opt/taskflow/app/backend" ]; then
    echo "U8@1v3z#14" | sudo -S cp ~/team-workload/backend_production.js /opt/taskflow/app/backend/backend.js
    echo "✅ Backend copied to /opt/taskflow/app/backend/"
else
    echo "⚠️ /opt/taskflow/app/backend not found, using ~/team-workload/"
    cp ~/team-workload/backend_production.js ~/team-workload/backend.js
fi

# Copy frontend to proper location
echo "📁 Copying frontend to service location..."
if [ -d "/opt/taskflow/app/frontend" ]; then
    echo "U8@1v3z#14" | sudo -S cp ~/team-workload/index.html /opt/taskflow/app/frontend/index.html
    echo "✅ Frontend copied to /opt/taskflow/app/frontend/"
else
    echo "⚠️ /opt/taskflow/app/frontend not found, using ~/team-workload/"
    cp ~/team-workload/index.html ~/team-workload/frontend.html
fi

echo ""
echo "🛑 Stopping existing services..."

# Kill any existing Node.js processes on port 777
echo "🔍 Checking for processes on port 777..."
EXISTING_PID=$(echo "U8@1v3z#14" | sudo -S lsof -ti:777)
if [ ! -z "$EXISTING_PID" ]; then
    echo "🛑 Killing existing process on port 777: $EXISTING_PID"
    echo "U8@1v3z#14" | sudo -S kill -9 $EXISTING_PID
    sleep 2
fi

# Stop systemd services if they exist
if systemctl is-active --quiet taskflow-backend; then
    echo "🛑 Stopping taskflow-backend service..."
    echo "U8@1v3z#14" | sudo -S systemctl stop taskflow-backend
fi

if systemctl is-active --quiet taskflow-frontend; then
    echo "🛑 Stopping taskflow-frontend service..."
    echo "U8@1v3z#14" | sudo -S systemctl stop taskflow-frontend
fi

echo ""
echo "🚀 Starting production OAuth backend..."

# Start backend in background
cd ~/team-workload
nohup node backend_production.js > backend.log 2>&1 &
BACKEND_PID=$!
echo "🚀 Backend started with PID: $BACKEND_PID"

# Wait a moment for backend to start
sleep 3

# Test backend health
echo "🩺 Testing backend health..."
HEALTH_CHECK=$(curl -s --connect-timeout 5 http://localhost:777/health)
if [ $? -eq 0 ]; then
    echo "✅ Backend health check successful"
    echo "$HEALTH_CHECK" | head -3
else
    echo "❌ Backend health check failed"
    echo "📊 Backend logs:"
    tail -10 backend.log
fi

echo ""
echo "🌐 Starting frontend service..."

# Start frontend with simple HTTP server
if command -v python3 &> /dev/null; then
    cd ~/team-workload
    nohup python3 -m http.server 555 > frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "🌐 Frontend started with Python HTTP server, PID: $FRONTEND_PID"
elif command -v node &> /dev/null && npm list -g http-server &> /dev/null; then
    cd ~/team-workload
    nohup npx http-server -p 555 . > frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "🌐 Frontend started with http-server, PID: $FRONTEND_PID"
else
    echo "⚠️ No suitable HTTP server found, frontend may need manual setup"
fi

# Wait for services to fully start
sleep 3

echo ""
echo "🔍 Final service verification..."

# Check backend port
if timeout 3 bash -c '</dev/tcp/127.0.0.1/777' 2>/dev/null; then
    echo "✅ Backend port 777: Connected"
else
    echo "❌ Backend port 777: Failed"
fi

# Check frontend port
if timeout 3 bash -c '</dev/tcp/127.0.0.1/555' 2>/dev/null; then
    echo "✅ Frontend port 555: Connected"
else
    echo "❌ Frontend port 555: Failed"
fi

echo ""
echo "📊 Process status:"
ps aux | grep -E "(node|python3.*555)" | grep -v grep

echo ""
echo "🎯 OAuth Configuration Check:"
curl -s http://localhost:777/health | grep -E "(service|version|redirectUri)" || echo "Backend not responding"

EOF

echo ""
echo "✅ Deployment completed!"
echo ""
echo "🔧 Production OAuth URLs:"
echo "Frontend: http://192.168.20.10:555"
echo "Backend Health: http://192.168.20.10:777/health"
echo "OAuth URL: http://192.168.20.10:777/api/v1/auth/clickup/auth-url"
echo "OAuth Test: http://192.168.20.10:777/api/v1/auth/clickup/authorize"
echo ""
echo "🎯 Test OAuth Flow:"
echo "1. Go to: http://192.168.20.10:555"
echo "2. Click 'Connect with ClickUp'"
echo "3. Authorize in ClickUp"
echo "4. Should redirect to: http://192.168.20.10:777/api/v1/auth/clickup/callback"
echo "5. Then redirect back to frontend with success"
echo ""
echo "📝 Monitor logs:"
echo "ssh one-climate@192.168.20.10 'tail -f ~/team-workload/backend.log'"