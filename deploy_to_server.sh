#!/bin/bash

# TaskFlow Master Auth Remote Deployment Script
echo "🚀 Deploying TaskFlow Master Auth to Remote Server..."

SERVER="one-climate@192.168.20.10"
REMOTE_DIR="/home/one-climate/team-workload"

echo "📦 Preparing files for deployment..."

# Create deployment package
mkdir -p deploy_package
cp master_auth_service.js deploy_package/
cp taskflow_master_auth.html deploy_package/
cp users_config.json deploy_package/
cp taskflow.nginx.conf deploy_package/
cp package.json deploy_package/ 2>/dev/null || echo "package.json not found, will create on server"

echo "📁 Files to deploy:"
ls -la deploy_package/

echo "🔄 Uploading files to server..."
scp -r deploy_package/* $SERVER:$REMOTE_DIR/

echo "🔧 Setting up service on remote server..."
ssh $SERVER << 'EOF'
cd /home/one-climate/team-workload

# Stop old services
echo "🛑 Stopping old services..."
pkill -f real_clickup_service.js 2>/dev/null || true
pkill -f hybrid_auth_service.js 2>/dev/null || true
pkill -f master_auth_service.js 2>/dev/null || true

# Install dependencies if package.json exists
if [ ! -f package.json ]; then
    echo "📦 Creating package.json..."
    cat > package.json << 'PACKAGE_JSON'
{
  "name": "taskflow-master-auth",
  "version": "1.0.0",
  "description": "TaskFlow Master Authentication Service",
  "main": "master_auth_service.js",
  "scripts": {
    "start": "node master_auth_service.js",
    "dev": "nodemon master_auth_service.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "axios": "^1.6.0"
  }
}
PACKAGE_JSON
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start master auth service
echo "🔄 Starting Master Auth Service..."
nohup node master_auth_service.js > master_auth.log 2>&1 &

# Wait for service to start
sleep 3

# Test service
echo "🏥 Testing service health..."
curl -s http://localhost:781/health | head -1

# Copy nginx configuration
echo "🔧 Updating nginx configuration..."
sudo cp taskflow.nginx.conf /etc/nginx/sites-available/taskflow
sudo ln -sf /etc/nginx/sites-available/taskflow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

echo "✅ Deployment completed!"
EOF

echo "🧪 Testing remote deployment..."
ssh $SERVER "curl -s http://localhost:781/health | jq '.service'"

echo "🎯 Testing login functionality..."
ssh $SERVER 'curl -s "http://localhost:781/api/v1/auth/login" -X POST -H "Content-Type: application/json" -d '"'"'{"email":"yterayut@gmail.com","password":"12345"}'"'"' | jq ".success"'

echo "📊 Service status on remote server:"
ssh $SERVER "ps aux | grep master_auth_service.js | grep -v grep"

echo "🚀 Remote Deployment Complete!"
echo "🎯 Access URL: http://192.168.20.10:8080"
echo "👑 Master User: yterayut@gmail.com"
echo "🔑 Password: 12345"

# Cleanup local deployment package
rm -rf deploy_package

echo "✨ All done!"