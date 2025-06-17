#!/bin/bash
# health-check.sh

echo "🏥 TaskFlow Comprehensive Health Check"
echo "====================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Health check results
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Function to log check result
log_check() {
    local status=$1
    local message=$2
    local details=$3
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    case $status in
        "PASS")
            echo -e "${GREEN}✅ PASS${NC}: $message"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            ;;
        "FAIL")
            echo -e "${RED}❌ FAIL${NC}: $message"
            if [ -n "$details" ]; then
                echo -e "   ${RED}Details: $details${NC}"
            fi
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️ WARN${NC}: $message"
            if [ -n "$details" ]; then
                echo -e "   ${YELLOW}Details: $details${NC}"
            fi
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️ INFO${NC}: $message"
            ;;
    esac
}

# Check if TaskFlow is installed
echo ""
echo "📦 Installation Check:"
if [ -d "/opt/taskflow" ]; then
    log_check "PASS" "TaskFlow directory exists"
    
    # Check directory structure
    required_dirs=("app" "data" "configs" "logs" "scripts")
    for dir in "${required_dirs[@]}"; do
        if [ -d "/opt/taskflow/$dir" ]; then
            log_check "PASS" "Directory /opt/taskflow/$dir exists"
        else
            log_check "FAIL" "Directory /opt/taskflow/$dir missing"
        fi
    done
else
    log_check "FAIL" "TaskFlow not installed" "Run install-taskflow-isolated.sh first"
    exit 1
fi

# Check systemd services
echo ""
echo "🔧 Service Health Check:"
services=("taskflow-mongodb" "taskflow-redis" "taskflow-backend" "taskflow-frontend" "taskflow-nginx")
service_names=("MongoDB" "Redis" "Backend" "Frontend" "Nginx")

for i in "${!services[@]}"; do
    service=${services[$i]}
    name=${service_names[$i]}
    
    if systemctl is-active --quiet "$service"; then
        log_check "PASS" "$name service is running"
        
        # Check if service is enabled
        if systemctl is-enabled --quiet "$service" 2>/dev/null; then
            log_check "PASS" "$name auto-start is enabled"
        else
            log_check "WARN" "$name auto-start is disabled" "Service won't start on boot"
        fi
        
        # Check service restart count
        restart_count=$(systemctl show "$service" --property=NRestarts --value)
        if [ "$restart_count" -gt 5 ]; then
            log_check "WARN" "$name has restarted $restart_count times" "May indicate stability issues"
        fi
    else
        log_check "FAIL" "$name service is not running"
    fi
done

# Check port connectivity
echo ""
echo "🌐 Port Connectivity Check:"
ports=(555 666 777 27777 6777)
port_names=("Nginx (Public)" "Frontend" "Backend" "MongoDB" "Redis")

for i in "${!ports[@]}"; do
    port=${ports[$i]}
    name=${port_names[$i]}
    
    if netstat -tuln 2>/dev/null | grep -q ":$port " || ss -tuln 2>/dev/null | grep -q ":$port "; then
        log_check "PASS" "Port $port ($name) is listening"
    else
        log_check "FAIL" "Port $port ($name) is not listening"
    fi
done

# Check application endpoints
echo ""
echo "🔗 Application Endpoint Check:"

# Test main application (with timeout)
if timeout 10 curl -f http://localhost:555 > /dev/null 2>&1; then
    log_check "PASS" "Main application responds on port 555"
else
    log_check "FAIL" "Main application not responding on port 555"
fi

# Test backend health endpoint
if timeout 10 curl -f http://localhost:777/health > /dev/null 2>&1; then
    log_check "PASS" "Backend health endpoint responds"
    
    # Get detailed health info
    health_response=$(timeout 5 curl -s http://localhost:777/health 2>/dev/null)
    if [ $? -eq 0 ]; then
        service_name=$(echo "$health_response" | grep -o '"service":"[^"]*"' | cut -d'"' -f4)
        version=$(echo "$health_response" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$service_name" ]; then
            log_check "INFO" "Backend service: $service_name ${version:+v$version}"
        fi
    fi
else
    log_check "FAIL" "Backend health endpoint not responding"
fi

# Test frontend health endpoint
if timeout 10 curl -f http://localhost:666/frontend-health > /dev/null 2>&1; then
    log_check "PASS" "Frontend health endpoint responds"
else
    log_check "WARN" "Frontend health endpoint not responding" "May be normal for some configurations"
fi

# Check database connectivity
echo ""
echo "💾 Database Connectivity Check:"

# MongoDB connectivity
if command -v mongosh &> /dev/null; then
    MONGO_CMD="mongosh"
elif command -v mongo &> /dev/null; then
    MONGO_CMD="mongo"
else
    log_check "FAIL" "MongoDB client not found"
    MONGO_CMD=""
fi

if [ -n "$MONGO_CMD" ]; then
    if timeout 10 $MONGO_CMD --host localhost:27777 --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        log_check "PASS" "MongoDB connection successful"
        
        # Check database authentication
        if timeout 10 $MONGO_CMD --host localhost:27777 -u taskflow_user -p taskflow_password_456 --authenticationDatabase taskflow --quiet --eval "db.runCommand({connectionStatus: 1})" > /dev/null 2>&1; then
            log_check "PASS" "MongoDB authentication successful"
        else
            log_check "WARN" "MongoDB authentication failed" "May need user setup"
        fi
    else
        log_check "FAIL" "MongoDB connection failed"
    fi
fi

# Redis connectivity
if command -v redis-cli &> /dev/null; then
    if timeout 10 redis-cli -h localhost -p 6777 ping | grep -q "PONG" 2>/dev/null; then
        log_check "PASS" "Redis connection successful"
        
        # Check Redis info
        redis_version=$(timeout 5 redis-cli -h localhost -p 6777 info server 2>/dev/null | grep "redis_version" | cut -d':' -f2 | tr -d '\r')
        if [ -n "$redis_version" ]; then
            log_check "INFO" "Redis version: $redis_version"
        fi
    else
        log_check "FAIL" "Redis connection failed"
    fi
else
    log_check "WARN" "Redis client not found"
fi

# Check file system health
echo ""
echo "📁 File System Check:"

# Check disk space
disk_usage=$(df /opt/taskflow 2>/dev/null | awk 'NR==2 {print $5}' | sed 's/%//')
if [ -n "$disk_usage" ]; then
    if [ "$disk_usage" -lt 80 ]; then
        log_check "PASS" "Disk usage is healthy ($disk_usage%)"
    elif [ "$disk_usage" -lt 90 ]; then
        log_check "WARN" "Disk usage is high ($disk_usage%)" "Consider cleanup"
    else
        log_check "FAIL" "Disk usage critical ($disk_usage%)" "Immediate action required"
    fi
else
    log_check "WARN" "Could not determine disk usage"
fi

# Check log files
log_files=(
    "/opt/taskflow/logs/app/backend.log"
    "/opt/taskflow/logs/app/frontend.log"
    "/opt/taskflow/logs/nginx/access.log"
    "/opt/taskflow/logs/nginx/error.log"
)

writable_logs=0
for log_file in "${log_files[@]}"; do
    if [ -f "$log_file" ]; then
        if [ -w "$log_file" ]; then
            writable_logs=$((writable_logs + 1))
        fi
    fi
done

if [ $writable_logs -eq ${#log_files[@]} ]; then
    log_check "PASS" "All log files are writable"
elif [ $writable_logs -gt 0 ]; then
    log_check "WARN" "$writable_logs/${#log_files[@]} log files are writable"
else
    log_check "FAIL" "No log files are writable"
fi

# Check configuration files
echo ""
echo "⚙️ Configuration Check:"

config_files=(
    "/opt/taskflow/configs/.env"
    "/opt/taskflow/configs/nginx.conf"
    "/opt/taskflow/configs/mongod-taskflow.conf"
    "/opt/taskflow/configs/redis-taskflow.conf"
)

for config_file in "${config_files[@]}"; do
    if [ -f "$config_file" ]; then
        log_check "PASS" "Configuration file exists: $(basename "$config_file")"
    else
        log_check "FAIL" "Configuration file missing: $(basename "$config_file")"
    fi
done

# Check environment variables
if [ -f "/opt/taskflow/configs/.env" ]; then
    # Check critical environment variables
    source /opt/taskflow/configs/.env
    
    critical_vars=("JWT_SECRET" "MONGODB_URI" "PORT")
    for var in "${critical_vars[@]}"; do
        if [ -n "${!var}" ]; then
            log_check "PASS" "Environment variable $var is set"
        else
            log_check "FAIL" "Environment variable $var is not set"
        fi
    done
    
    # Check if default values are still being used
    if [ "$JWT_SECRET" = "taskflow_jwt_secret_change_this_in_production" ]; then
        log_check "WARN" "JWT_SECRET is using default value" "Change for production"
    fi
fi

# Check system resources
echo ""
echo "💻 System Resource Check:"

# Memory check
total_mem=$(free -m | awk 'NR==2{print $2}')
used_mem=$(free -m | awk 'NR==2{print $3}')
available_mem=$(free -m | awk 'NR==2{print $7}')

if [ "$available_mem" -gt 1024 ]; then
    log_check "PASS" "Available memory: ${available_mem}MB"
elif [ "$available_mem" -gt 512 ]; then
    log_check "WARN" "Available memory low: ${available_mem}MB"
else
    log_check "FAIL" "Available memory critical: ${available_mem}MB"
fi

# CPU load check
load_1min=$(uptime | awk -F'load average:' '{print $2}' | cut -d',' -f1 | tr -d ' ')
cpu_cores=$(nproc)
load_threshold=$(echo "$cpu_cores * 0.8" | bc 2>/dev/null || echo "$cpu_cores")

if (( $(echo "$load_1min < $load_threshold" | bc -l 2>/dev/null || echo "1") )); then
    log_check "PASS" "CPU load normal: $load_1min (cores: $cpu_cores)"
else
    log_check "WARN" "CPU load high: $load_1min (cores: $cpu_cores)"
fi

# Check recent errors in logs
echo ""
echo "📝 Log Analysis:"

# Check for recent errors in backend log
if [ -f "/opt/taskflow/logs/app/backend.log" ]; then
    error_count=$(tail -100 /opt/taskflow/logs/app/backend.log 2>/dev/null | grep -i "error\|fail\|panic" | wc -l)
    if [ "$error_count" -eq 0 ]; then
        log_check "PASS" "No recent errors in backend log"
    elif [ "$error_count" -lt 5 ]; then
        log_check "WARN" "$error_count recent errors in backend log"
    else
        log_check "FAIL" "$error_count recent errors in backend log"
    fi
fi

# Check Nginx error log
if [ -f "/opt/taskflow/logs/nginx/error.log" ]; then
    nginx_errors=$(tail -100 /opt/taskflow/logs/nginx/error.log 2>/dev/null | grep -v "client disconnected" | wc -l)
    if [ "$nginx_errors" -eq 0 ]; then
        log_check "PASS" "No recent Nginx errors"
    elif [ "$nginx_errors" -lt 3 ]; then
        log_check "WARN" "$nginx_errors recent Nginx errors"
    else
        log_check "FAIL" "$nginx_errors recent Nginx errors"
    fi
fi

# Security check
echo ""
echo "🔒 Security Check:"

# Check file permissions
taskflow_owner=$(stat -c "%U" /opt/taskflow 2>/dev/null)
if [ "$taskflow_owner" = "taskflow" ]; then
    log_check "PASS" "TaskFlow directory has correct ownership"
else
    log_check "FAIL" "TaskFlow directory ownership incorrect: $taskflow_owner"
fi

# Check if services are running as correct user
for service in "taskflow-mongodb" "taskflow-redis" "taskflow-backend" "taskflow-frontend"; do
    if systemctl is-active --quiet "$service"; then
        service_user=$(ps -o user= -p $(systemctl show --property MainPID --value "$service") 2>/dev/null)
        if [ "$service_user" = "taskflow" ]; then
            log_check "PASS" "$service running as correct user"
        else
            log_check "WARN" "$service running as: $service_user"
        fi
    fi
done

# Check firewall status
if command -v ufw &> /dev/null; then
    if ufw status | grep -q "Status: active"; then
        log_check "PASS" "Firewall is active"
        
        # Check if port 555 is allowed
        if ufw status | grep -q "555"; then
            log_check "PASS" "Port 555 is allowed in firewall"
        else
            log_check "WARN" "Port 555 not explicitly allowed in firewall"
        fi
    else
        log_check "WARN" "Firewall is not active"
    fi
fi

# Performance test
echo ""
echo "⚡ Performance Test:"

# Test response time
if command -v curl &> /dev/null; then
    response_time=$(curl -o /dev/null -s -w "%{time_total}" http://localhost:555 2>/dev/null || echo "0")
    if (( $(echo "$response_time > 0 && $response_time < 2" | bc -l 2>/dev/null || echo "0") )); then
        log_check "PASS" "Response time: ${response_time}s"
    elif (( $(echo "$response_time >= 2 && $response_time < 5" | bc -l 2>/dev/null || echo "0") )); then
        log_check "WARN" "Response time slow: ${response_time}s"
    elif (( $(echo "$response_time >= 5" | bc -l 2>/dev/null || echo "0") )); then
        log_check "FAIL" "Response time very slow: ${response_time}s"
    else
        log_check "FAIL" "Could not measure response time"
    fi
fi

# Summary
echo ""
echo "📊 Health Check Summary"
echo "====================="

overall_health="HEALTHY"
if [ $FAILED_CHECKS -gt 0 ]; then
    overall_health="UNHEALTHY"
elif [ $WARNING_CHECKS -gt 3 ]; then
    overall_health="DEGRADED"
fi

case $overall_health in
    "HEALTHY")
        echo -e "Overall Status: ${GREEN}✅ HEALTHY${NC}"
        ;;
    "DEGRADED")
        echo -e "Overall Status: ${YELLOW}⚠️ DEGRADED${NC}"
        ;;
    "UNHEALTHY")
        echo -e "Overall Status: ${RED}❌ UNHEALTHY${NC}"
        ;;
esac

echo ""
echo "Check Results:"
echo -e "  ${GREEN}✅ Passed: $PASSED_CHECKS${NC}"
echo -e "  ${YELLOW}⚠️ Warnings: $WARNING_CHECKS${NC}"
echo -e "  ${RED}❌ Failed: $FAILED_CHECKS${NC}"
echo -e "  Total Checks: $TOTAL_CHECKS"

echo ""
success_rate=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
echo "Success Rate: $success_rate%"

if [ $FAILED_CHECKS -gt 0 ]; then
    echo ""
    echo "🔧 Recommended Actions:"
    echo "1. Check failed services: systemctl status taskflow-*"
    echo "2. Review logs: tail -f /opt/taskflow/logs/app/backend.log"
    echo "3. Restart services: ./stop-all.sh && ./start-all.sh"
    echo "4. Check system resources: free -h && df -h"
fi

if [ $WARNING_CHECKS -gt 0 ]; then
    echo ""
    echo "⚠️ Attention Required:"
    echo "- Review warning messages above"
    echo "- Consider system optimization"
    echo "- Update configuration if needed"
fi

echo ""
echo "📞 Support Information:"
echo "- Status check: ./status.sh"
echo "- Restart services: ./start-all.sh"
echo "- View logs: tail -f /opt/taskflow/logs/app/backend.log"
echo "- Configuration: /opt/taskflow/configs/.env"

# Exit with appropriate code
if [ "$overall_health" = "HEALTHY" ]; then
    exit 0
elif [ "$overall_health" = "DEGRADED" ]; then
    exit 1
else
    exit 2
fi
