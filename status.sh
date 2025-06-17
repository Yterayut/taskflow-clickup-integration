#!/bin/bash
# status.sh

echo "📊 TaskFlow Services Status"
echo "=========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to get service status with color
get_service_status() {
    local service=$1
    local port=$2
    local display_name=$3
    
    if systemctl is-active --quiet "$service"; then
        local status="${GREEN}✅ Running${NC}"
        local uptime=$(systemctl show "$service" --property=ActiveEnterTimestamp --value | cut -d' ' -f2-3)
        echo -e "$display_name: $status (since $uptime)"
        
        if [ -n "$port" ]; then
            if netstat -tuln 2>/dev/null | grep -q ":$port " || ss -tuln 2>/dev/null | grep -q ":$port "; then
                echo -e "  ${GREEN}Port $port: Listening${NC}"
            else
                echo -e "  ${RED}Port $port: Not listening${NC}"
            fi
        fi
    else
        echo -e "$display_name: ${RED}❌ Stopped${NC}"
        if [ -n "$port" ]; then
            echo -e "  ${RED}Port $port: Not available${NC}"
        fi
    fi
}

# Check all TaskFlow services
echo ""
echo "🔧 System Services:"
get_service_status "taskflow-mongodb" "27777" "MongoDB"
get_service_status "taskflow-redis" "6777" "Redis"
get_service_status "taskflow-backend" "777" "Backend"
get_service_status "taskflow-frontend" "666" "Frontend"
get_service_status "taskflow-nginx" "555" "Nginx"

# Check auto-start status
echo ""
echo "🔄 Auto-start Status:"
services=("taskflow-mongodb" "taskflow-redis" "taskflow-backend" "taskflow-frontend" "taskflow-nginx")
for service in "${services[@]}"; do
    if systemctl is-enabled --quiet "$service" 2>/dev/null; then
        echo -e "  $service: ${GREEN}Enabled${NC}"
    else
        echo -e "  $service: ${YELLOW}Disabled${NC}"
    fi
done

# Network status
echo ""
echo "🌐 Port Status:"
ports=(555 666 777 27777 6777)
port_names=("Nginx (Public)" "Frontend" "Backend" "MongoDB" "Redis")

for i in "${!ports[@]}"; do
    port=${ports[$i]}
    name=${port_names[$i]}
    
    if netstat -tuln 2>/dev/null | grep -q ":$port " || ss -tuln 2>/dev/null | grep -q ":$port "; then
        echo -e "  Port $port ($name): ${GREEN}Active${NC}"
    else
        echo -e "  Port $port ($name): ${RED}Inactive${NC}"
    fi
done

# System resources
echo ""
echo "💻 System Resources:"

# Memory usage
total_mem=$(free -m | awk 'NR==2{print $2}')
used_mem=$(free -m | awk 'NR==2{print $3}')
mem_percent=$((used_mem * 100 / total_mem))

if [ $mem_percent -gt 80 ]; then
    mem_color=$RED
elif [ $mem_percent -gt 60 ]; then
    mem_color=$YELLOW
else
    mem_color=$GREEN
fi

echo -e "  Memory: ${mem_color}${used_mem}MB / ${total_mem}MB (${mem_percent}%)${NC}"

# Disk usage for TaskFlow directory
if [ -d "/opt/taskflow" ]; then
    disk_usage=$(du -sh /opt/taskflow 2>/dev/null | cut -f1)
    echo -e "  TaskFlow disk usage: ${BLUE}${disk_usage}${NC}"
fi

# CPU load
load_avg=$(uptime | awk -F'load average:' '{print $2}' | cut -d',' -f1 | tr -d ' ')
echo -e "  CPU Load (1min): ${BLUE}${load_avg}${NC}"

# Application connectivity test
echo ""
echo "🔗 Connectivity Tests:"

# Test main application
if curl -f http://localhost:555 > /dev/null 2>&1; then
    echo -e "  Main App (port 555): ${GREEN}✅ Responding${NC}"
else
    echo -e "  Main App (port 555): ${RED}❌ Not responding${NC}"
fi

# Test backend health
if curl -f http://localhost:777/health > /dev/null 2>&1; then
    echo -e "  Backend Health: ${GREEN}✅ OK${NC}"
else
    echo -e "  Backend Health: ${RED}❌ Failed${NC}"
fi

# Test frontend health
if curl -f http://localhost:666/frontend-health > /dev/null 2>&1; then
    echo -e "  Frontend Health: ${GREEN}✅ OK${NC}"
else
    echo -e "  Frontend Health: ${RED}❌ Failed${NC}"
fi

# Recent logs
echo ""
echo "📝 Recent Log Activity:"

log_files=(
    "/opt/taskflow/logs/app/backend.log:Backend"
    "/opt/taskflow/logs/app/frontend.log:Frontend"
    "/opt/taskflow/logs/nginx/error.log:Nginx"
)

for log_entry in "${log_files[@]}"; do
    log_file="${log_entry%%:*}"
    log_name="${log_entry##*:}"
    
    if [ -f "$log_file" ]; then
        last_line=$(tail -1 "$log_file" 2>/dev/null)
        if [ -n "$last_line" ]; then
            echo -e "  $log_name: ${last_line:0:80}..."
        else
            echo -e "  $log_name: ${YELLOW}No recent activity${NC}"
        fi
    else
        echo -e "  $log_name: ${YELLOW}Log file not found${NC}"
    fi
done

# Quick summary
echo ""
echo "📋 Quick Summary:"

# Count running services
running_count=0
total_count=5

for service in "${services[@]}"; do
    if systemctl is-active --quiet "$service"; then
        running_count=$((running_count + 1))
    fi
done

if [ $running_count -eq $total_count ]; then
    echo -e "  Status: ${GREEN}All systems operational ($running_count/$total_count)${NC}"
elif [ $running_count -gt 0 ]; then
    echo -e "  Status: ${YELLOW}Partial operation ($running_count/$total_count services running)${NC}"
else
    echo -e "  Status: ${RED}All services stopped${NC}"
fi

# Access information
echo ""
echo "🌐 Access Information:"
if [ $running_count -gt 0 ]; then
    server_ip=$(hostname -I | awk '{print $1}')
    echo -e "  External: ${BLUE}http://$server_ip:555${NC}"
    echo -e "  Internal: ${BLUE}http://localhost:555${NC}"
else
    echo -e "  ${RED}Services not running${NC}"
fi

echo ""
echo "💡 Management Commands:"
echo "  Start all: ./start-all.sh"
echo "  Stop all: ./stop-all.sh"
echo "  Health check: ./health-check.sh"
echo "  Deploy app: ./deploy-app.sh"
