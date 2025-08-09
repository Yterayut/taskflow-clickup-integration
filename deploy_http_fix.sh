#!/bin/bash

# Deploy HTTP Fix for ClickUp OAuth
echo "🚀 Deploy HTTP Fix - TaskFlow Pro OAuth"
echo "======================================"

# Server config
SERVER="192.168.20.10"
USER="root"

echo "📤 Copying fixed backend to server..."

# Create temp copy with proper filename
cp backend_final_working.js backend_temp.js

# Upload to server
echo "Uploading backend_final_working.js..."
scp backend_temp.js $USER@$SERVER:/opt/taskflow/app/backend/backend.js

if [ $? -eq 0 ]; then
    echo "✅ Upload successful"
else
    echo "❌ Upload failed - check SSH connection"
    exit 1
fi

# Clean up temp file
rm backend_temp.js

echo ""
echo "🔄 Restarting services on server..."

# Restart backend service
ssh $USER@$SERVER << 'EOF'
echo "Stopping backend service..."
systemctl stop taskflow-backend

echo "Starting backend service..."
systemctl start taskflow-backend

echo "Checking service status..."
systemctl status taskflow-backend --no-pager -l | head -10

echo ""
echo "🩺 Testing backend health..."
sleep 3
curl -s http://localhost:777/health | head -5

echo ""
echo "📊 Backend logs (last 10 lines):"
journalctl -u taskflow-backend -n 10 --no-pager
EOF

echo ""
echo "✅ Deployment completed!"
echo ""
echo "🔧 Test Steps:"
echo "1. Go to: http://192.168.20.10:555"
echo "2. Click 'Connect with ClickUp'"
echo "3. Authorize in ClickUp"
echo "4. Should redirect back properly without HTTPS error"
echo ""
echo "📝 Monitor logs: ssh root@192.168.20.10 'journalctl -u taskflow-backend -f'"