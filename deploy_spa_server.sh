#!/bin/bash

# TaskFlow Pro SPA - Server Deployment Script

echo "🚀 TaskFlow Pro SPA - Server Deployment"
echo "======================================="

# Run this script on the server to set up nginx for SPA

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  This script needs to be run with sudo privileges"
    exit 1
fi

# Create nginx sites directory if it doesn't exist
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled

# Copy nginx configuration
cp /home/one-climate/taskflow-spa.nginx.conf /etc/nginx/sites-available/taskflow-spa

# Enable the site
ln -sf /etc/nginx/sites-available/taskflow-spa /etc/nginx/sites-enabled/taskflow-spa

# Test nginx configuration
echo "📝 Testing nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
    
    # Reload nginx
    echo "🔄 Reloading nginx..."
    systemctl reload nginx
    
    if [ $? -eq 0 ]; then
        echo "✅ Nginx reloaded successfully"
        echo "🌐 SPA should now be available at: http://192.168.20.10:8889"
        echo "🔗 Backend API: http://192.168.20.10:7812"
        echo "🔌 WebSocket: ws://192.168.20.10:7813"
    else
        echo "❌ Failed to reload nginx"
        exit 1
    fi
else
    echo "❌ Nginx configuration test failed"
    exit 1
fi

# Create a simple systemd service for auto-start
cat > /etc/systemd/system/taskflow-spa.service << 'EOF'
[Unit]
Description=TaskFlow Pro SPA Service
After=network.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/true
ExecReload=/bin/systemctl reload nginx

[Install]
WantedBy=multi-user.target
EOF

# Enable the service
systemctl enable taskflow-spa.service

echo "✅ TaskFlow Pro SPA deployment complete!"
echo ""
echo "📋 Service Status:"
echo "   - SPA URL: http://192.168.20.10:8889"
echo "   - Backend: http://192.168.20.10:7812"
echo "   - WebSocket: ws://192.168.20.10:7813"
echo ""
echo "🧪 Test the deployment:"
echo "   curl -I http://192.168.20.10:8889"
echo ""
echo "📊 Monitor logs:"
echo "   tail -f /var/log/nginx/taskflow-spa.access.log"
echo "   tail -f /var/log/nginx/taskflow-spa.error.log"