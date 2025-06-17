#!/bin/bash
# start-all.sh

echo "🚀 Starting TaskFlow services..."

# Check if TaskFlow is installed
if [ ! -d "/opt/taskflow" ]; then
    echo "❌ TaskFlow not installed. Please run install-taskflow-isolated.sh first"
    exit 1
fi

# Function to check if service is running
check_service() {
    if systemctl is-active --quiet "$1"; then
        return 0
    else
        return 1
    fi
}

# Function to wait for service
wait_for_service() {
    local service=$1
    local port=$2
    local timeout=30
    local count=0
    
    echo "⏳ Waiting for $service..."
    while [ $count -lt $timeout ]; do
        if [ -n "$port" ]; then
            if netstat -tuln 2>/dev/null | grep -q ":$port " || ss -tuln 2>/dev/null | grep -q ":$port "; then
                echo "✅ $service is ready on port $port"
                return 0
            fi
        else
            if systemctl is-active --quiet "$service"; then
                echo "✅ $service is running"
                return 0
            fi
        fi
        sleep 1
        count=$((count + 1))
    done
    
    echo "⚠️ $service did not start within $timeout seconds"
    return 1
}

# Start MongoDB first
echo "🗄️ Starting MongoDB..."
if check_service "taskflow-mongodb"; then
    echo "✅ MongoDB is already running"
else
    sudo systemctl start taskflow-mongodb
    wait_for_service "taskflow-mongodb" "27777"
fi

# Start Redis
echo "💾 Starting Redis..."
if check_service "taskflow-redis"; then
    echo "✅ Redis is already running"
else
    sudo systemctl start taskflow-redis
    wait_for_service "taskflow-redis" "6777"
fi

# Wait a moment for databases to fully initialize
sleep 3

# Start Backend
echo "⚙️ Starting Backend..."
if check_service "taskflow-backend"; then
    echo "✅ Backend is already running"
else
    sudo systemctl start taskflow-backend
    wait_for_service "taskflow-backend" "777"
fi

# Start Frontend
echo "🎨 Starting Frontend..."
if check_service "taskflow-frontend"; then
    echo "✅ Frontend is already running"
else
    sudo systemctl start taskflow-frontend
    wait_for_service "taskflow-frontend" "666"
fi

# Start Nginx
echo "🌐 Starting Nginx..."
if check_service "taskflow-nginx"; then
    echo "✅ Nginx is already running"
else
    sudo systemctl start taskflow-nginx
    wait_for_service "taskflow-nginx" "555"
fi

# Enable auto-start on boot
echo "🔄 Enabling auto-start on boot..."
sudo systemctl enable taskflow-mongodb taskflow-redis taskflow-backend taskflow-frontend taskflow-nginx

# Final health check
echo ""
echo "🏥 Running final health check..."
sleep 5

if curl -f http://localhost:555 > /dev/null 2>&1; then
    echo "✅ Main application is responding"
else
    echo "⚠️ Main application is not responding yet"
fi

if curl -f http://localhost:777/health > /dev/null 2>&1; then
    echo "✅ Backend health check passed"
else
    echo "⚠️ Backend health check failed"
fi

echo ""
echo "🎉 TaskFlow services started successfully!"
echo ""
echo "🌐 Access URLs:"
echo "  Main Application: http://$(hostname -I | awk '{print $1}'):555"
echo "  Backend Health: http://localhost:777/health"
echo ""
echo "📊 Service Status:"
systemctl is-active taskflow-mongodb taskflow-redis taskflow-backend taskflow-frontend taskflow-nginx | paste <(echo -e "MongoDB\nRedis\nBackend\nFrontend\nNginx") -

echo ""
echo "📝 To view logs:"
echo "  Backend: tail -f /opt/taskflow/logs/app/backend.log"
echo "  Frontend: tail -f /opt/taskflow/logs/app/frontend.log"
echo "  Nginx: tail -f /opt/taskflow/logs/nginx/access.log"
