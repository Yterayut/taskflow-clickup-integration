#!/bin/bash
# stop-all.sh

echo "⏹️ Stopping TaskFlow services..."

# Function to stop service gracefully
stop_service() {
    local service=$1
    if systemctl is-active --quiet "$service"; then
        echo "⏹️ Stopping $service..."
        sudo systemctl stop "$service"
        
        # Wait for service to stop
        local count=0
        while systemctl is-active --quiet "$service" && [ $count -lt 30 ]; do
            sleep 1
            count=$((count + 1))
        done
        
        if systemctl is-active --quiet "$service"; then
            echo "⚠️ $service did not stop gracefully, force stopping..."
            sudo systemctl kill "$service"
        else
            echo "✅ $service stopped successfully"
        fi
    else
        echo "✅ $service is already stopped"
    fi
}

# Stop services in reverse order
stop_service "taskflow-nginx"
stop_service "taskflow-frontend"
stop_service "taskflow-backend"
stop_service "taskflow-redis"
stop_service "taskflow-mongodb"

# Disable auto-start on boot (optional)
read -p "Disable auto-start on boot? (y/n): " disable_autostart
if [ "$disable_autostart" = "y" ]; then
    echo "🔄 Disabling auto-start on boot..."
    sudo systemctl disable taskflow-mongodb taskflow-redis taskflow-backend taskflow-frontend taskflow-nginx
    echo "✅ Auto-start disabled"
fi

echo ""
echo "✅ All TaskFlow services stopped successfully!"
echo ""
echo "📊 Service Status:"
systemctl is-active taskflow-mongodb taskflow-redis taskflow-backend taskflow-frontend taskflow-nginx | paste <(echo -e "MongoDB\nRedis\nBackend\nFrontend\nNginx") -

echo ""
echo "💡 To start services again: ./start-all.sh"
