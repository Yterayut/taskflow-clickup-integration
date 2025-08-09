#!/bin/bash

echo "🚀 Deploy Enhanced TaskFlow to Remote Server"
echo "============================================"

# 1. Upload enhanced files to remote
echo "📤 Step 1: Uploading enhanced files..."
scp taskflow_enhanced_dashboard.html backend_comprehensive_enhanced.js one-climate@192.168.20.10:/home/one-climate/team-workload/

# 2. Install missing dependencies on remote
echo "📦 Step 2: Installing dependencies..."
ssh one-climate@192.168.20.10 'cd /home/one-climate/team-workload && npm install express-session uid-safe axios'

# 3. Stop existing services
echo "🛑 Step 3: Stopping existing services..."
ssh one-climate@192.168.20.10 'pkill -f "node.*777" && pkill -f "node.*7810" && sleep 3'

# 4. Start enhanced backend (port 777)
echo "🚀 Step 4: Starting enhanced backend..."
ssh one-climate@192.168.20.10 'cd /home/one-climate/team-workload && nohup node backend_comprehensive_enhanced.js > enhanced_backend.log 2>&1 &'

# 5. Start master auth service (port 7810) 
echo "🚀 Step 5: Starting master auth service..."
ssh one-climate@192.168.20.10 'cd /home/one-climate/team-workload && nohup node master_auth_service.js > master_auth.log 2>&1 &'

# 6. Update frontend with sudo
echo "📁 Step 6: Updating frontend..."
ssh one-climate@192.168.20.10 'echo "12345" | sudo -S cp /home/one-climate/team-workload/taskflow_enhanced_dashboard.html /var/www/taskflow/index.html && echo "12345" | sudo -S chown www-data:www-data /var/www/taskflow/index.html'

# 7. Wait and test services
echo "⏳ Step 7: Waiting for services to start..."
sleep 8

echo "✅ Step 8: Testing services..."
echo "Enhanced Backend (port 777):"
ssh one-climate@192.168.20.10 'curl -s http://localhost:777/health' | jq .

echo ""
echo "Master Auth Service (port 7810):"
ssh one-climate@192.168.20.10 'curl -s http://localhost:7810/health' | jq .

echo ""
echo "Frontend Test:"
ssh one-climate@192.168.20.10 'curl -s http://192.168.20.10:8888/ | head -5'

echo ""
echo "🎉 Enhanced TaskFlow Deployed Successfully!"
echo "=========================================="
echo "🌐 Frontend: http://192.168.20.10:8888/"
echo "👤 Login: yterayut@gmail.com / 12345"
echo "📊 Features: Enhanced Dashboard with Real ClickUp Data"
echo "🎨 Theme: Dark/Light Mode Support"
echo "👥 Employee: Management Cards & Analytics"
echo ""
echo "📋 Services Status:"
ssh one-climate@192.168.20.10 'ps aux | grep -E "(master_auth|backend_comprehensive)" | grep -v grep'