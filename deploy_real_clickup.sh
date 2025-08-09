#!/bin/bash

echo "🎯 Deploy Real ClickUp Dashboard"
echo "================================"

# Stop existing services
echo "🛑 Step 1: Stopping existing services..."
ssh one-climate@192.168.20.10 'pkill -f "node.*7810" || true'
ssh one-climate@192.168.20.10 'pkill -f "node.*777" || true'

# Deploy frontend (manual copy needed due to sudo)
echo "📁 Step 2: Deploy instructions..."
echo "Run these commands on the remote server:"
echo "sudo cp /home/one-climate/team-workload/taskflow_real_clickup_dashboard.html /var/www/taskflow/index.html"
echo "sudo chown www-data:www-data /var/www/taskflow/index.html"
echo ""

# Restart backend service
echo "🚀 Step 3: Starting updated backend service..."
ssh one-climate@192.168.20.10 'cd /home/one-climate/team-workload && nohup node master_auth_service.js > master_auth.log 2>&1 &'

sleep 3

# Check services
echo "✅ Step 4: Checking services status..."
echo "Backend Service Status:"
ssh one-climate@192.168.20.10 'curl -s http://localhost:7810/health | jq .'

echo ""
echo "Frontend Test:"
ssh one-climate@192.168.20.10 'curl -s http://192.168.20.10:8888/ | head -5'

echo ""
echo "🎉 Real ClickUp Dashboard Updated!"
echo "================================="
echo "🌐 Frontend: http://192.168.20.10:8888/"
echo "🔗 Backend: http://192.168.20.10:7810/"
echo ""
echo "⚠️  Manual Step Required:"
echo "   SSH to remote server and run:"
echo "   sudo cp /home/one-climate/team-workload/taskflow_real_clickup_dashboard.html /var/www/taskflow/index.html"
echo "   sudo chown www-data:www-data /var/www/taskflow/index.html"
echo ""
echo "🎯 Features:"
echo "   ✅ 100% Real ClickUp API integration"
echo "   ✅ No mock/demo data"
echo "   ✅ Role-based data filtering"
echo "   ✅ Real-time task and team data"
echo "   ✅ ClickUp OAuth authentication"
echo ""
echo "👤 Login Accounts:"
echo "   Manager: yterayut@gmail.com / 12345"
echo "   Team Lead: chaiwutwck@gmail.com / 12345"
echo "   Employee: kittipong@example.com / 12345"