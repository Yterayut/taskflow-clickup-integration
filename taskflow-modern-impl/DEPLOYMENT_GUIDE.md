# TaskFlow Pro - Production Deployment Guide

> 🚀 **Complete guide for deploying TaskFlow Pro modern architecture to production**

## 📋 Pre-Deployment Checklist

### ✅ **System Requirements**
- [ ] **Node.js 18+** installed on production server
- [ ] **Docker & Docker Compose** (recommended) or manual setup
- [ ] **Nginx** for reverse proxy and SSL termination
- [ ] **SSL Certificates** (Let's Encrypt or commercial)
- [ ] **Backup Strategy** configured
- [ ] **Monitoring Tools** (optional but recommended)

### ✅ **Data Migration Completed**
- [ ] Legacy data exported successfully
- [ ] Modern database created and populated
- [ ] User authentication tested
- [ ] Data integrity verified

### ✅ **Environment Configuration**
- [ ] Production environment variables configured
- [ ] ClickUp integration credentials updated
- [ ] Database connection secured
- [ ] CORS origins configured correctly

## 🎯 Deployment Options

### Option 1: Docker Deployment (Recommended)

#### **Step 1: Prepare Production Environment**

```bash
# 1. Clone repository on production server
git clone https://github.com/your-org/taskflow-pro.git
cd taskflow-pro

# 2. Copy production environment files
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env

# 3. Configure production environment variables
nano apps/backend/.env
```

#### **Step 2: Production Environment Variables**

**Backend (.env):**
```env
# Production Environment
NODE_ENV=production
HOST=0.0.0.0
PORT=5000

# Database (Use absolute path)
DATABASE_PATH=/app/data/taskflow.db
BACKUP_PATH=/app/backups

# JWT (Use strong secret)
JWT_SECRET=your-super-secure-production-jwt-secret-minimum-64-characters
JWT_EXPIRES_IN=24h

# CORS (Your production domains)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# ClickUp Integration
CLICKUP_CLIENT_ID=DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL
CLICKUP_CLIENT_SECRET=BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX
CLICKUP_REDIRECT_URI=https://yourdomain.com/api/auth/clickup/callback

# Redis (Production)
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=your-redis-password

# Logging
LOG_LEVEL=info
LOG_FILE_ENABLED=true
```

**Frontend (.env):**
```env
# Production API
VITE_API_URL=https://yourdomain.com/api
VITE_WS_URL=wss://yourdomain.com

# ClickUp
VITE_CLICKUP_CLIENT_ID=DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL
VITE_CLICKUP_REDIRECT_URI=https://yourdomain.com/api/auth/clickup/callback

# Production Settings
VITE_DEBUG_MODE=false
VITE_SHOW_REDUX_DEVTOOLS=false
```

#### **Step 3: Deploy with Docker**

```bash
# 1. Create production docker-compose override
cp docker-compose.prod.yml docker-compose.override.yml

# 2. Set environment variables
export JWT_SECRET="your-super-secure-production-jwt-secret"
export REDIS_PASSWORD="your-redis-password"
export CORS_ORIGINS="https://yourdomain.com"
export CLICKUP_REDIRECT_URI="https://yourdomain.com/api/auth/clickup/callback"

# 3. Build and start production containers
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 4. Check container status
docker-compose ps

# 5. View logs
docker-compose logs -f
```

### Option 2: Manual Deployment

#### **Step 1: Install Dependencies**

```bash
# Install Node.js dependencies
npm install

# Build all packages
npm run build

# Install PM2 for process management
npm install -g pm2
```

#### **Step 2: Database Setup**

```bash
# Copy migrated database to production location
cp migration/apps/backend/data/taskflow.db /var/taskflow/data/

# Set proper permissions
chown taskflow:taskflow /var/taskflow/data/taskflow.db
chmod 640 /var/taskflow/data/taskflow.db
```

#### **Step 3: Start Services with PM2**

```bash
# Start backend
cd apps/backend
pm2 start dist/server.js --name taskflow-backend \
  --env production \
  --log /var/log/taskflow/backend.log

# Start frontend (build and serve)
cd ../frontend
npm run build
pm2 serve dist 3000 --name taskflow-frontend \
  --log /var/log/taskflow/frontend.log

# Save PM2 configuration
pm2 save
pm2 startup
```

## 🌐 Nginx Configuration

### **Create Nginx Configuration**

```nginx
# /etc/nginx/sites-available/taskflow
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/taskflow.crt;
    ssl_certificate_key /etc/ssl/private/taskflow.key;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Modern configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Frontend (React app)
    location / {
        root /var/www/taskflow;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:5000/health;
        access_log off;
    }

    # WebSocket support (if implemented)
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

### **Enable Site and Restart Nginx**

```bash
# Enable site
ln -s /etc/nginx/sites-available/taskflow /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Restart Nginx
systemctl restart nginx
```

## 🔒 SSL Certificate Setup

### **Option 1: Let's Encrypt (Free)**

```bash
# Install Certbot
apt-get install certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
certbot renew --dry-run
```

### **Option 2: Commercial Certificate**

```bash
# Generate CSR
openssl req -new -newkey rsa:2048 -nodes \
  -keyout taskflow.key -out taskflow.csr

# Install certificates
cp taskflow.crt /etc/ssl/certs/
cp taskflow.key /etc/ssl/private/
chmod 644 /etc/ssl/certs/taskflow.crt
chmod 600 /etc/ssl/private/taskflow.key
```

## 🔐 Security Hardening

### **Firewall Configuration**

```bash
# Configure UFW
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### **User and Permissions**

```bash
# Create dedicated user
useradd -r -s /bin/false taskflow
usermod -a -G taskflow www-data

# Set directory permissions
chown -R taskflow:taskflow /var/taskflow
chmod 750 /var/taskflow
chmod 640 /var/taskflow/data/*
```

### **Database Security**

```bash
# Enable SQLite encryption (if using SQLCipher)
# Add to backend environment:
SQLITE_ENCRYPTION_KEY=your-database-encryption-key
```

## 📊 Monitoring and Logging

### **Log Configuration**

```bash
# Create log directories
mkdir -p /var/log/taskflow
chown taskflow:taskflow /var/log/taskflow

# Configure log rotation
cat > /etc/logrotate.d/taskflow << EOF
/var/log/taskflow/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 taskflow taskflow
    postrotate
        systemctl reload nginx
        pm2 reload all
    endscript
}
EOF
```

### **Health Monitoring**

```bash
# Create health check script
cat > /usr/local/bin/taskflow-health.sh << 'EOF'
#!/bin/bash
HEALTH_URL="https://yourdomain.com/health"
if ! curl -f -s "$HEALTH_URL" > /dev/null; then
    echo "TaskFlow health check failed" | mail -s "TaskFlow Alert" admin@yourdomain.com
    systemctl restart taskflow
fi
EOF

chmod +x /usr/local/bin/taskflow-health.sh

# Add to crontab
echo "*/5 * * * * /usr/local/bin/taskflow-health.sh" | crontab -
```

## 🔄 Backup Strategy

### **Database Backup**

```bash
# Create backup script
cat > /usr/local/bin/taskflow-backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/taskflow"
DB_PATH="/var/taskflow/data/taskflow.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
cp "$DB_PATH" "$BACKUP_DIR/taskflow_$DATE.db"

# Keep only last 30 days
find "$BACKUP_DIR" -name "taskflow_*.db" -mtime +30 -delete
EOF

chmod +x /usr/local/bin/taskflow-backup.sh

# Schedule daily backups
echo "0 2 * * * /usr/local/bin/taskflow-backup.sh" | crontab -
```

### **Full System Backup**

```bash
# Create full backup script
cat > /usr/local/bin/taskflow-full-backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/taskflow-full"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/taskflow_full_$DATE.tar.gz" \
  /var/taskflow \
  /etc/nginx/sites-available/taskflow \
  /var/log/taskflow

# Keep only last 7 full backups
find "$BACKUP_DIR" -name "taskflow_full_*.tar.gz" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/taskflow-full-backup.sh

# Schedule weekly full backups
echo "0 1 * * 0 /usr/local/bin/taskflow-full-backup.sh" | crontab -
```

## 🚀 Go Live Checklist

### **Pre-Launch**
- [ ] All tests passed in staging environment
- [ ] SSL certificate installed and verified
- [ ] Database migrated and verified
- [ ] User authentication tested with production data
- [ ] ClickUp integration configured and tested
- [ ] Monitoring and alerting configured
- [ ] Backup strategy implemented and tested
- [ ] Performance testing completed
- [ ] Security scan completed

### **Launch Day**
- [ ] Deploy to production during maintenance window
- [ ] Verify all services are running
- [ ] Test user authentication
- [ ] Test ClickUp integration
- [ ] Verify email notifications (if implemented)
- [ ] Monitor logs for errors
- [ ] Conduct smoke tests with real users

### **Post-Launch**
- [ ] Monitor system performance for 24-48 hours
- [ ] Collect user feedback
- [ ] Address any immediate issues
- [ ] Document any configuration changes
- [ ] Schedule follow-up review meeting

## 🆘 Troubleshooting

### **Common Issues**

**Backend Not Starting:**
```bash
# Check logs
journalctl -u taskflow-backend -f

# Check database permissions
ls -la /var/taskflow/data/

# Verify environment variables
pm2 env 0
```

**Frontend Not Loading:**
```bash
# Check Nginx logs
tail -f /var/log/nginx/error.log

# Verify build files
ls -la /var/www/taskflow/

# Test direct backend API
curl https://yourdomain.com/api/health
```

**Database Connection Issues:**
```bash
# Check database file
file /var/taskflow/data/taskflow.db
sqlite3 /var/taskflow/data/taskflow.db "SELECT COUNT(*) FROM users;"

# Check permissions
namei -l /var/taskflow/data/taskflow.db
```

### **Performance Issues**

```bash
# Monitor resource usage
htop
iotop

# Check database size
du -sh /var/taskflow/data/

# Monitor API response times
curl -w "@curl-format.txt" -o /dev/null -s https://yourdomain.com/api/health
```

## 📞 Support

For production deployment support:
- **Documentation**: [https://docs.taskflowpro.com](https://docs.taskflowpro.com)
- **Issues**: [https://github.com/taskflow-pro/issues](https://github.com/taskflow-pro/issues)
- **Email**: support@taskflowpro.com

---

**🎉 Congratulations! Your TaskFlow Pro modern architecture is now running in production!**