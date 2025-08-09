#!/bin/bash

echo "🚀 Emergency Backend Start - TaskFlow Pro"
echo "==========================================="

# Kill any existing process on port 7812
echo "🔪 Killing existing processes on port 7812..."
pkill -f "single_login_backend.js" 2>/dev/null || true
lsof -ti:7812 | xargs kill -9 2>/dev/null || true

# Wait a moment
sleep 2

# Start the backend service
echo "⚡ Starting single_login_backend.js on port 7812..."
cd /Users/teerayutyeerahem/team-workload/

# Start backend in background
nohup node single_login_backend.js > backend_emergency.log 2>&1 &
BACKEND_PID=$!

echo "✅ Backend started with PID: $BACKEND_PID"

# Wait for service to be ready
echo "⏳ Waiting for backend to be ready..."
for i in {1..30}; do
    if curl -sf http://localhost:7812/api/v2/system/status > /dev/null 2>&1; then
        echo "✅ Backend is ready and responding!"
        echo "🌐 Backend URL: http://192.168.20.10:7812"
        echo "📊 System Status: http://192.168.20.10:7812/api/v2/system/status"
        echo "🔐 Login API: http://192.168.20.10:7812/api/v2/auth/login"
        exit 0
    fi
    echo "   ... waiting ($i/30)"
    sleep 1
done

echo "❌ Backend failed to start properly"
echo "📋 Checking logs:"
tail -10 backend_emergency.log
exit 1