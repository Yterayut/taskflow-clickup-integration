#!/bin/bash

echo "🚀 TaskFlow Step-by-Step Deployment"
echo "=================================="

# 1. หยุด services เก่า
echo "🛑 Step 1: Stopping old services..."
pkill -f master_auth_service.js
pkill -f clickup_callback_service.js
pkill -f "node.*781"
pkill -f "node.*7810"
sleep 3

# 2. เริ่ม service ใหม่
echo "🚀 Step 2: Starting new services..."
cd /home/one-climate/team-workload
nohup node master_auth_service.js > /var/log/taskflow/master_auth.log 2>&1 &
nohup node clickup_callback_service.js > /var/log/taskflow/callback.log 2>&1 &

sleep 5

# 3. ตรวจสอบ services
echo "✅ Step 3: Checking services..."
echo "Master Auth Service (port 7810):"
curl -s http://localhost:7810/health | jq . || echo "❌ Master Auth Service not running"

echo ""
echo "Callback Service (port 777):"
curl -s http://localhost:777/health | jq . || echo "❌ Callback Service not running"

# 4. แสดง process
echo ""
echo "📊 Step 4: Running processes:"
ps aux | grep -E "(master_auth|clickup_callback)" | grep -v grep

echo ""
echo "🌐 Step 5: Test endpoints:"
echo "Frontend: http://192.168.20.10:8888/"
echo "API Health: curl http://192.168.20.10:8888/api/v1/health"
echo "Backend Direct: curl http://localhost:7810/health"
echo ""
echo "✅ Deployment completed!"