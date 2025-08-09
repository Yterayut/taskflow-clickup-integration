#!/bin/bash

# TaskFlow Master Auth Deployment Script
echo "🚀 Deploying TaskFlow Master Auth System..."

# Stop old services
echo "🛑 Stopping old services..."
pkill -f real_clickup_service.js
pkill -f hybrid_auth_service.js

# Check if master auth service is running
if pgrep -f master_auth_service.js > /dev/null; then
    echo "✅ Master Auth Service already running"
else
    echo "🔄 Starting Master Auth Service..."
    cd /Users/teerayutyeerahem/team-workload
    nohup node master_auth_service.js > master_auth.log 2>&1 &
    sleep 2
fi

# Copy nginx configuration (requires sudo)
echo "🔧 Deploying nginx configuration..."
echo "Please run the following commands manually:"
echo "sudo cp /Users/teerayutyeerahem/team-workload/taskflow.nginx.conf /etc/nginx/sites-available/taskflow"
echo "sudo ln -sf /etc/nginx/sites-available/taskflow /etc/nginx/sites-enabled/"
echo "sudo nginx -t"
echo "sudo systemctl reload nginx"

# Test service health
echo "🏥 Testing service health..."
sleep 2
curl -s http://localhost:781/health | jq '.' || echo "Service health check failed"

# Test login
echo "🔐 Testing authentication..."
curl -s "http://localhost:781/api/v1/auth/login" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"yterayut@gmail.com","password":"12345"}' | jq '.success'

# Display service status
echo "📊 Service Status:"
echo "Port 781: Master Auth Service"
ps aux | grep master_auth_service.js | grep -v grep

echo "📋 Configuration Files:"
echo "✅ master_auth_service.js - Backend service"
echo "✅ taskflow_master_auth.html - Frontend"
echo "✅ users_config.json - User database"
echo "✅ taskflow.nginx.conf - Nginx configuration"

echo "🎯 Access URL: http://192.168.20.10:8080"
echo "👑 Master User: yterayut@gmail.com"
echo "🔑 Password: 12345 (for all users)"

echo "🚀 Deployment Complete!"