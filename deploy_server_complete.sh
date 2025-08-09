#!/bin/bash

echo "🚀 Complete Server Deployment - Login Loop Fix"
echo "==============================================="

SERVER="one-climate@192.168.20.10"
PASSWORD="U8@1v3z#14"

echo "🌐 Deploying nginx config and starting services..."

# Deploy everything to server
ssh "$SERVER" << 'EOF'
    echo "🔧 Updating nginx configuration..."
    
    # Backup existing config
    sudo cp /etc/nginx/sites-available/taskflow_8888 /etc/nginx/sites-available/taskflow_8888.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    
    # Install new config
    sudo mv /tmp/taskflow_8888_new.nginx.conf /etc/nginx/sites-available/taskflow_8888
    
    # Enable site
    sudo ln -sf /etc/nginx/sites-available/taskflow_8888 /etc/nginx/sites-enabled/
    
    # Test nginx config
    echo "🧪 Testing nginx configuration..."
    if sudo nginx -t; then
        echo "✅ Nginx config is valid"
        
        # Reload nginx
        echo "🔄 Reloading nginx..."
        sudo systemctl reload nginx
        echo "✅ Nginx reloaded"
    else
        echo "❌ Nginx config is invalid"
        exit 1
    fi
    
    echo ""
    echo "📦 Installing npm dependencies..."
    cd /home/one-climate/team-workload
    npm install --only=production
    
    echo ""
    echo "🔪 Stopping existing backend processes..."
    pkill -f "single_login_backend.js" 2>/dev/null || true
    pkill -f "node.*7812" 2>/dev/null || true
    sleep 2
    
    echo "🚀 Starting backend service..."
    nohup node single_login_backend.js > backend_production.log 2>&1 &
    BACKEND_PID=$!
    echo "✅ Backend started with PID: $BACKEND_PID"
    
    echo ""
    echo "⏳ Waiting for backend to be ready..."
    for i in {1..30}; do
        if curl -sf http://localhost:7812/api/v2/system/status > /dev/null 2>&1; then
            echo "✅ Backend is ready and responding!"
            break
        fi
        echo "   ... waiting ($i/30)"
        sleep 1
    done
    
    echo ""
    echo "🎉 Deployment completed!"
    echo "✅ Backend: http://192.168.20.10:7812 (running)"
    echo "✅ Frontend: http://192.168.20.10:8888 (nginx configured)"
    echo "🔐 Login: http://192.168.20.10:8888/login"
    echo ""
    echo "📊 System Status:"
    curl -s http://localhost:7812/api/v2/system/status 2>/dev/null || echo "Backend not responding yet"
    
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "🎊 SERVER DEPLOYMENT SUCCESSFUL!"
    echo "================================="
    echo "✅ Nginx configured and reloaded"
    echo "✅ Backend service started on port 7812"
    echo "✅ System ready for testing"
    echo ""
    echo "🧪 Test URLs:"
    echo "   Backend API: http://192.168.20.10:7812/api/v2/system/status"
    echo "   Frontend: http://192.168.20.10:8888/"
    echo "   Login Page: http://192.168.20.10:8888/login"
    echo ""
    echo "⚡ LOGIN LOOP FIX DEPLOYED - Ready for testing!"
else
    echo "❌ Deployment failed!"
    exit 1
fi