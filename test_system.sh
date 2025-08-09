#!/bin/bash

echo "🧪 TaskFlow System Test"
echo "====================="

echo "1. Testing Backend Service (Port 7810):"
curl -s http://localhost:7810/health | jq .

echo ""
echo "2. Testing Frontend (Port 8888):"
curl -s -I http://192.168.20.10:8888/ | head -1

echo ""
echo "3. Testing API endpoints:"
echo "   /health endpoint:"
curl -s http://192.168.20.10:8888/health

echo ""
echo "   /api/v1/auth/login endpoint:"
curl -s http://192.168.20.10:8888/api/v1/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}' | head -c 100

echo ""
echo ""
echo "4. Check running processes:"
ps aux | grep -E "(master_auth|nginx)" | grep -v grep

echo ""
echo "5. Manual commands to fix nginx:"
echo "   sudo cp taskflow_8888.nginx.conf /etc/nginx/sites-available/taskflow"
echo "   sudo systemctl reload nginx"
echo "   curl http://192.168.20.10:8888/api/v1/auth/login"