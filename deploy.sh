#!/bin/bash

# TaskFlow Pro - Remote Deployment Script
# Deploy to production server

echo "🚀 Starting TaskFlow Pro Remote Deployment..."

# Configuration
REMOTE_HOST="192.168.20.10"
REMOTE_USER="root"
REMOTE_PATH="/var/www/taskflow"
LOCAL_PATH="/Users/teerayutyeerahem/team-workload/public"
FRONTEND_PORT="8080"
BACKEND_PORT="3000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if local files exist
print_status "Checking local files..."
if [ ! -f "$LOCAL_PATH/index.html" ]; then
    print_error "index.html not found in $LOCAL_PATH"
    exit 1
fi

if [ ! -f "$LOCAL_PATH/test.html" ]; then
    print_warning "test.html not found, will create a simple one"
fi

print_success "Local files verified"

# Create deployment package
print_status "Creating deployment package..."
cd /Users/teerayutyeerahem/team-workload

# Create a tarball with all necessary files
tar -czf taskflow-deployment.tar.gz \
    public/index.html \
    public/test.html \
    backend_production.js \
    package.json \
    README.md \
    TaskFlow_Pro_Final_Implementation_Log.md 2>/dev/null

if [ $? -eq 0 ]; then
    print_success "Deployment package created: taskflow-deployment.tar.gz"
else
    print_error "Failed to create deployment package"
    exit 1
fi

# Test SSH connection
print_status "Testing SSH connection to $REMOTE_HOST..."
ssh -o ConnectTimeout=10 -o BatchMode=yes $REMOTE_USER@$REMOTE_HOST "echo 'SSH connection successful'" 2>/dev/null

if [ $? -eq 0 ]; then
    print_success "SSH connection to remote server successful"
else
    print_warning "SSH connection failed. Will use alternative deployment method."
    
    # Alternative: Use SCP if SSH key is available, or provide manual instructions
    print_status "Trying SCP deployment..."
    
    # Try to copy files directly
    scp -o ConnectTimeout=10 taskflow-deployment.tar.gz $REMOTE_USER@$REMOTE_HOST:/tmp/ 2>/dev/null
    
    if [ $? -ne 0 ]; then
        print_error "Automatic deployment failed. Manual deployment required."
        echo ""
        echo "📋 Manual Deployment Instructions:"
        echo "================================="
        echo "1. Copy the file taskflow-deployment.tar.gz to your remote server"
        echo "2. SSH into your remote server: ssh $REMOTE_USER@$REMOTE_HOST"
        echo "3. Extract: tar -xzf taskflow-deployment.tar.gz"
        echo "4. Setup web server to serve files from extracted directory"
        echo "5. Configure ports: Frontend($FRONTEND_PORT), Backend($BACKEND_PORT)"
        echo ""
        exit 1
    fi
fi

# Deploy to remote server
print_status "Deploying to remote server..."

# SSH commands to execute on remote server
ssh $REMOTE_USER@$REMOTE_HOST << 'ENDSSH'
    
    # Create deployment directory
    sudo mkdir -p /var/www/taskflow
    sudo mkdir -p /var/www/taskflow/logs
    
    # Extract deployment package
    cd /tmp
    if [ -f taskflow-deployment.tar.gz ]; then
        tar -xzf taskflow-deployment.tar.gz
        sudo cp -r public/* /var/www/taskflow/
        sudo cp backend_production.js /var/www/taskflow/
        sudo cp package.json /var/www/taskflow/ 2>/dev/null || echo "package.json not found"
    else
        echo "Deployment package not found"
        exit 1
    fi
    
    # Set proper permissions
    sudo chown -R www-data:www-data /var/www/taskflow
    sudo chmod -R 755 /var/www/taskflow
    
    # Install Node.js if not present
    if ! command -v node &> /dev/null; then
        echo "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # Install PM2 if not present
    if ! command -v pm2 &> /dev/null; then
        echo "Installing PM2..."
        sudo npm install -g pm2
    fi
    
    # Install backend dependencies if package.json exists
    cd /var/www/taskflow
    if [ -f package.json ]; then
        npm install --production
    fi
    
    # Create Nginx configuration
    sudo tee /etc/nginx/sites-available/taskflow > /dev/null << 'EOF'
server {
    listen 8080;
    server_name _;
    root /var/www/taskflow;
    index index.html;
    
    # Main application
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    
    # Static files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API proxy to backend
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
EOF
    
    # Enable the site
    sudo ln -sf /etc/nginx/sites-available/taskflow /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx configuration
    sudo nginx -t
    
    if [ $? -eq 0 ]; then
        echo "Nginx configuration is valid"
        sudo systemctl reload nginx
        sudo systemctl enable nginx
    else
        echo "Nginx configuration error"
        exit 1
    fi
    
    # Start backend with PM2 if backend file exists
    if [ -f /var/www/taskflow/backend_production.js ]; then
        # Stop existing PM2 processes
        pm2 delete taskflow-backend 2>/dev/null || true
        
        # Start backend
        cd /var/www/taskflow
        PORT=3000 pm2 start backend_production.js --name taskflow-backend
        pm2 save
        pm2 startup
    fi
    
    echo "✅ Deployment completed successfully!"
    echo "🌐 Frontend: http://$(hostname -I | awk '{print $1}'):8080"
    echo "🔗 Backend: http://$(hostname -I | awk '{print $1}'):3000"
    
ENDSSH

if [ $? -eq 0 ]; then
    print_success "Remote deployment completed successfully!"
    
    # Get server IP
    SERVER_IP=$(ssh $REMOTE_USER@$REMOTE_HOST "hostname -I | awk '{print \$1}'" 2>/dev/null)
    
    if [ ! -z "$SERVER_IP" ]; then
        echo ""
        echo "🎉 TaskFlow Pro Deployed Successfully!"
        echo "====================================="
        echo "🌐 Frontend URL: http://$SERVER_IP:$FRONTEND_PORT"
        echo "🔗 Backend URL:  http://$SERVER_IP:$BACKEND_PORT"
        echo "🧪 Tests URL:    http://$SERVER_IP:$FRONTEND_PORT/test.html"
        echo ""
        echo "📋 Login Credentials:"
        echo "Manager:    yterayut@gmail.com / 12345"
        echo "Team Lead:  chaiwutwck@gmail.com / 12345"
        echo "Employees:  [other emails] / 12345"
        echo ""
        
        # Test the deployment
        print_status "Testing remote deployment..."
        sleep 5
        
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$SERVER_IP:$FRONTEND_PORT" 2>/dev/null)
        
        if [ "$HTTP_STATUS" = "200" ]; then
            print_success "✅ Remote application is accessible!"
        else
            print_warning "⚠️ Remote application may not be ready yet (HTTP: $HTTP_STATUS)"
        fi
        
    else
        print_warning "Could not determine server IP address"
    fi
    
else
    print_error "Remote deployment failed"
    exit 1
fi

# Cleanup
rm -f taskflow-deployment.tar.gz

print_success "🎉 Deployment process completed!"

echo ""
echo "📊 Deployment Summary:"
echo "====================="
echo "✅ Files deployed to: $REMOTE_PATH"
echo "✅ Nginx configured on port: $FRONTEND_PORT"
echo "✅ Backend running on port: $BACKEND_PORT"
echo "✅ PM2 process manager configured"
echo "✅ Security headers enabled"
echo "✅ SSL ready (certificate installation required)"
echo ""
echo "🔧 Post-deployment tasks:"
echo "- Configure firewall rules for ports $FRONTEND_PORT and $BACKEND_PORT"
echo "- Install SSL certificate for HTTPS"
echo "- Configure domain name if needed"
echo "- Setup monitoring and backups"
echo ""