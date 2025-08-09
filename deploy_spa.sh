#!/bin/bash

# TaskFlow Pro - Deploy React SPA to Production
echo "🚀 Deploying TaskFlow Pro React SPA..."

# Create SPA directory with proper ownership
sudo mkdir -p /var/www/taskflow-spa
sudo chown one-climate:one-climate /var/www/taskflow-spa

# Copy files from temp to web directory
cp -r /tmp/dist/* /var/www/taskflow-spa/

# Set proper permissions
chmod -R 755 /var/www/taskflow-spa/

# Create Nginx configuration for SPA
sudo tee /etc/nginx/sites-available/taskflow-spa > /dev/null << 'EOF'
server {
    listen 9999;
    server_name 192.168.20.10;
    
    root /var/www/taskflow-spa;
    index index.html;
    
    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy to backend
    location /api/ {
        proxy_pass http://127.0.0.1:7810;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
EOF

# Enable site and restart nginx
sudo ln -sf /etc/nginx/sites-available/taskflow-spa /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo "✅ React SPA deployed successfully!"
echo "🌐 Access at: http://192.168.20.10:9999/"
echo "📊 Backend API: http://192.168.20.10:7810/"

# Test deployment
echo "🧪 Testing deployment..."
curl -s -o /dev/null -w "%{http_code}" http://192.168.20.10:9999/ && echo " - Frontend: ✅" || echo " - Frontend: ❌"
curl -s -o /dev/null -w "%{http_code}" http://192.168.20.10:7810/api/health && echo " - Backend: ✅" || echo " - Backend: ❌"

echo "🎉 TaskFlow Pro React SPA deployment complete!"