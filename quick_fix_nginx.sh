#!/bin/bash

echo "🔧 Quick Fix: Update Nginx Configuration"
echo "======================================="

# แสดง current config
echo "📋 Current nginx configuration:"
curl -s http://192.168.20.10:8888/api/v1/health

# แสดง backend status
echo "🔧 Backend status:"
curl -s http://localhost:7810/health

echo ""
echo "📝 Manual nginx update required:"
echo ""
echo "1. Copy config to server:"
echo "   sudo cp taskflow_8888.nginx.conf /etc/nginx/sites-available/taskflow"
echo ""
echo "2. Enable site:"
echo "   sudo ln -sf /etc/nginx/sites-available/taskflow /etc/nginx/sites-enabled/"
echo ""
echo "3. Test config:"
echo "   sudo nginx -t"
echo ""
echo "4. Reload nginx:"
echo "   sudo systemctl reload nginx"
echo ""
echo "5. Test API:"
echo "   curl http://192.168.20.10:8888/api/v1/health"