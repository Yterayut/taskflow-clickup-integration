#!/bin/bash

echo "🔧 Fix Nginx Root Directory"
echo "=========================="

# Create corrected nginx config
cat > taskflow_fixed.nginx.conf << 'EOF'
server {
    listen 8888;
    server_name 192.168.20.10 localhost;
    
    # TaskFlow Frontend - Fixed root path
    location / {
        root /var/www/taskflow;
        try_files $uri $uri/ /index.html;
        index index.html;
        
        # CORS headers for frontend
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
    }
    
    # Proxy API calls to TaskFlow Master Auth Service
    location /api/v1/ {
        proxy_pass http://127.0.0.1:7810/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings for Auth Service
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # Health check for Master Auth Service
    location /health {
        proxy_pass http://127.0.0.1:7810/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Logs
    access_log /var/log/nginx/taskflow-access.log;
    error_log /var/log/nginx/taskflow-error.log;
}
EOF

echo "✅ Fixed nginx config created: taskflow_fixed.nginx.conf"
echo ""
echo "📋 Manual commands to apply:"
echo "1. sudo cp taskflow_fixed.nginx.conf /etc/nginx/sites-available/taskflow"
echo "2. sudo nginx -t"
echo "3. sudo systemctl reload nginx"
echo "4. curl http://192.168.20.10:8888/ | head -10"