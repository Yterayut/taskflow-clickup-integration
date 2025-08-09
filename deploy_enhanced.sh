#!/bin/bash

echo "🚀 Deploy Enhanced TaskFlow Dashboard"
echo "===================================="

# Stop current services
echo "🛑 Stopping current services..."
pkill -f master_auth_service.js
pkill -f clickup_callback_service.js
pkill -f backend_comprehensive_enhanced.js
sleep 3

# Copy enhanced dashboard to web root
echo "📁 Updating frontend..."
sudo cp taskflow_enhanced_dashboard.html /var/www/taskflow/index.html
sudo chown www-data:www-data /var/www/taskflow/index.html

# Start enhanced backend on port 777
echo "🚀 Starting enhanced backend..."
cd /home/one-climate/team-workload
nohup node backend_comprehensive_enhanced.js > enhanced_backend.log 2>&1 &

# Start master auth service on port 7810  
echo "🚀 Starting master auth service..."
nohup node master_auth_service.js > master_auth.log 2>&1 &

sleep 5

# Test services
echo "✅ Testing services..."
echo "Enhanced Backend (port 777):"
curl -s http://localhost:777/health | jq .

echo ""
echo "Master Auth Service (port 7810):"
curl -s http://localhost:7810/health | jq .

echo ""
echo "🌐 Enhanced TaskFlow Ready!"
echo "Frontend: http://192.168.20.10:8888/"
echo "Dashboard: Full enhanced version with real ClickUp data"
echo "Login: yterayut@gmail.com / 12345"