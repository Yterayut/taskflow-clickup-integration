#!/bin/bash
# install-taskflow-isolated.sh

set -e

echo "🚀 Installing TaskFlow (Isolated Mode)..."

# Run compatibility check first
if ! ./check-compatibility.sh; then
    echo "❌ Compatibility check failed. Aborting installation."
    exit 1
fi

# Create taskflow user (if not exists)
if ! id "taskflow" &>/dev/null; then
    echo "👤 Creating taskflow user..."
    sudo adduser --system --group --home /opt/taskflow --shell /bin/bash taskflow
fi

# Create directory structure
echo "📁 Creating directory structure..."
sudo mkdir -p /opt/taskflow/{app/{backend,frontend,nginx},data/{mongodb-taskflow,redis-taskflow},configs,logs/{nginx,mongodb,redis,app},scripts,backups/daily}
sudo chown -R taskflow:taskflow /opt/taskflow

# Install Go (if not installed)
if ! command -v go &> /dev/null; then
    echo "📦 Installing Go..."
    GO_VERSION="1.21.5"
    cd /tmp
    wget "https://golang.org/dl/go${GO_VERSION}.linux-amd64.tar.gz"
    sudo tar -C /usr/local -xzf "go${GO_VERSION}.linux-amd64.tar.gz"
    echo 'export PATH=$PATH:/usr/local/go/bin' | sudo tee -a /etc/profile
fi

# Install Node.js (if not installed)
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install MongoDB (separate instance)
echo "🗄️ Setting up isolated MongoDB..."
if ! command -v mongod &> /dev/null; then
    wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
    sudo apt update
    sudo apt install -y mongodb-org
fi

# Configure isolated MongoDB
sudo tee /opt/taskflow/configs/mongod-taskflow.conf > /dev/null <<EOF
storage:
  dbPath: /opt/taskflow/data/mongodb-taskflow
  journal:
    enabled: true

systemLog:
  destination: file
  logAppend: true
  path: /opt/taskflow/logs/mongodb/mongod.log

net:
  port: 27777
  bindIp: 127.0.0.1

security:
  authorization: enabled

processManagement:
  fork: true
  pidFilePath: /opt/taskflow/data/mongodb-taskflow/mongod.pid
EOF

# Install Redis (separate instance)
echo "💾 Setting up isolated Redis..."
if ! command -v redis-server &> /dev/null; then
    sudo apt install -y redis-server
fi

# Configure isolated Redis
sudo tee /opt/taskflow/configs/redis-taskflow.conf > /dev/null <<EOF
port 6777
bind 127.0.0.1
dir /opt/taskflow/data/redis-taskflow
logfile /opt/taskflow/logs/redis/redis.log
pidfile /opt/taskflow/data/redis-taskflow/redis.pid
save 900 1
save 300 10
save 60 10000
rdbcompression yes
dbfilename dump.rdb
maxmemory 256mb
maxmemory-policy allkeys-lru
EOF

# Setup custom Nginx
echo "🌐 Setting up custom Nginx..."
sudo tee /opt/taskflow/configs/nginx.conf > /dev/null <<EOF
user taskflow;
worker_processes auto;
pid /opt/taskflow/data/nginx.pid;
error_log /opt/taskflow/logs/nginx/error.log;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent" "\$http_x_forwarded_for"';
    
    access_log /opt/taskflow/logs/nginx/access.log main;
    
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    server {
        listen 555;
        server_name localhost;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        
        # Frontend (served by Node.js)
        location / {
            proxy_pass http://127.0.0.1:666;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
        
        # Backend API
        location /api/ {
            proxy_pass http://127.0.0.1:777;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
        
        # WebSocket
        location /ws {
            proxy_pass http://127.0.0.1:777;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            
            proxy_read_timeout 86400;
            proxy_send_timeout 86400;
        }
        
        # Health check
        location /health {
            proxy_pass http://127.0.0.1:777;
            access_log off;
        }
    }
}
EOF

# Create systemd services
echo "⚙️ Creating systemd services..."

# MongoDB service
sudo tee /etc/systemd/system/taskflow-mongodb.service > /dev/null <<EOF
[Unit]
Description=TaskFlow MongoDB
After=network.target

[Service]
Type=forking
User=taskflow
Group=taskflow
ExecStart=/usr/bin/mongod --config /opt/taskflow/configs/mongod-taskflow.conf
PIDFile=/opt/taskflow/data/mongodb-taskflow/mongod.pid
TimeoutStartSec=60
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Redis service
sudo tee /etc/systemd/system/taskflow-redis.service > /dev/null <<EOF
[Unit]
Description=TaskFlow Redis
After=network.target

[Service]
Type=forking
User=taskflow
Group=taskflow
ExecStart=/usr/bin/redis-server /opt/taskflow/configs/redis-taskflow.conf
PIDFile=/opt/taskflow/data/redis-taskflow/redis.pid
TimeoutStartSec=30
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Nginx service
sudo tee /etc/systemd/system/taskflow-nginx.service > /dev/null <<EOF
[Unit]
Description=TaskFlow Nginx
After=network.target taskflow-frontend.service

[Service]
Type=forking
User=root
ExecStart=/usr/sbin/nginx -c /opt/taskflow/configs/nginx.conf
ExecReload=/bin/kill -s HUP \$MAINPID
ExecStop=/bin/kill -s QUIT \$MAINPID
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Frontend service
sudo tee /etc/systemd/system/taskflow-frontend.service > /dev/null <<EOF
[Unit]
Description=TaskFlow Frontend Server
After=network.target

[Service]
Type=simple
User=taskflow
Group=taskflow
WorkingDirectory=/opt/taskflow/app/frontend
Environment=NODE_ENV=production
Environment=PORT=666
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
StandardOutput=append:/opt/taskflow/logs/app/frontend.log
StandardError=append:/opt/taskflow/logs/app/frontend.log

[Install]
WantedBy=multi-user.target
EOF

# Backend service
sudo tee /etc/systemd/system/taskflow-backend.service > /dev/null <<EOF
[Unit]
Description=TaskFlow Backend Service
After=network.target taskflow-mongodb.service taskflow-redis.service

[Service]
Type=simple
User=taskflow
Group=taskflow
WorkingDirectory=/opt/taskflow/app/backend
Environment=GIN_MODE=release
Environment=PORT=777
ExecStart=/opt/taskflow/app/backend/taskflow-backend
Restart=always
RestartSec=5
StandardOutput=append:/opt/taskflow/logs/app/backend.log
StandardError=append:/opt/taskflow/logs/app/backend.log

[Install]
WantedBy=multi-user.target
EOF

# Set permissions
sudo chown -R taskflow:taskflow /opt/taskflow
sudo chmod -R 755 /opt/taskflow
sudo chmod 644 /opt/taskflow/configs/*

# Reload systemd
sudo systemctl daemon-reload

echo "✅ TaskFlow installation completed!"
echo ""
echo "📋 Next steps:"
echo "1. Deploy your application code"
echo "2. Configure environment variables"
echo "3. Start services"
echo ""
echo "🔧 Service commands:"
echo "  sudo systemctl start taskflow-mongodb"
echo "  sudo systemctl start taskflow-redis" 
echo "  sudo systemctl start taskflow-backend"
echo "  sudo systemctl start taskflow-frontend"
echo "  sudo systemctl start taskflow-nginx"
echo ""
echo "🌐 Access URLs:"
echo "  Main App: http://localhost:555"
echo "  Frontend: http://localhost:666"
echo "  Backend: http://localhost:777"
