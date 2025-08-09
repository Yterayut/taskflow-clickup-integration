#!/bin/bash

echo "🔧 Fix Nginx Configuration for TaskFlow"
echo "======================================"

# Copy nginx config with sudo
sudo cp taskflow_8888.nginx.conf /etc/nginx/sites-available/taskflow

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Enable TaskFlow site
sudo ln -sf /etc/nginx/sites-available/taskflow /etc/nginx/sites-enabled/taskflow

# Test configuration
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration test passed"
    # Reload nginx
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded successfully"
    
    # Test API endpoint
    sleep 2
    echo "🔍 Testing API endpoint..."
    curl -s http://192.168.20.10:8888/api/v1/health
    
else
    echo "❌ Nginx configuration test failed"
    exit 1
fi