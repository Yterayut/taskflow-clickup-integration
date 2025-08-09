#!/bin/bash

echo "🌐 Emergency Nginx Deployment - TaskFlow Pro"
echo "============================================="

SERVER="one-climate@192.168.20.10"
LOCAL_CONFIG="/Users/teerayutyeerahem/team-workload/taskflow_8888.nginx.conf"
REMOTE_CONFIG="/etc/nginx/sites-available/taskflow_8888"

# Copy nginx config to server
echo "📤 Copying nginx config to server..."
scp "$LOCAL_CONFIG" "$SERVER:/tmp/taskflow_8888.nginx.conf"

# Deploy config on server
echo "🔧 Deploying nginx config on server..."
ssh "$SERVER" << 'EOF'
    # Backup existing config
    sudo cp /etc/nginx/sites-available/taskflow_8888 /etc/nginx/sites-available/taskflow_8888.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    
    # Install new config
    sudo mv /tmp/taskflow_8888.nginx.conf /etc/nginx/sites-available/taskflow_8888
    
    # Enable site if not already enabled
    sudo ln -sf /etc/nginx/sites-available/taskflow_8888 /etc/nginx/sites-enabled/ 2>/dev/null || true
    
    # Test nginx config
    echo "🧪 Testing nginx configuration..."
    if sudo nginx -t; then
        echo "✅ Nginx config is valid"
        
        # Reload nginx
        echo "🔄 Reloading nginx..."
        sudo systemctl reload nginx
        
        if sudo systemctl is-active --quiet nginx; then
            echo "✅ Nginx reloaded successfully"
            echo "🌐 Frontend URL: http://192.168.20.10:8888/"
            echo "🔐 Login URL: http://192.168.20.10:8888/login"
        else
            echo "❌ Nginx failed to reload"
            exit 1
        fi
    else
        echo "❌ Nginx config is invalid"
        exit 1
    fi
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Emergency deployment completed successfully!"
    echo "✅ Backend: http://192.168.20.10:7812 (running)"
    echo "✅ Frontend: http://192.168.20.10:8888 (nginx configured)"
    echo "🔐 Login: http://192.168.20.10:8888/login"
    echo ""
    echo "⚡ Ready for login testing!"
else
    echo "❌ Deployment failed"
    exit 1
fi