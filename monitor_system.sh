#!/bin/bash
# TaskFlow Pro System Monitoring Script
# Comprehensive monitoring with alerting for production environment

echo "🔍 TaskFlow Pro System Monitor - $(date)"
echo "=================================================="

# Configuration
BACKEND_URL="http://192.168.20.10:7812"
FRONTEND_URL="http://192.168.20.10:8888"
LOG_FILE="logs/monitor_$(date +%Y%m%d).log"

# Create logs directory if it doesn't exist
mkdir -p logs

# Function to log with timestamp
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Function to check service health
check_service() {
    local service_name="$1"
    local url="$2"
    local expected_status="$3"
    
    echo "🔄 Checking $service_name..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}:%{time_total}" "$url" 2>/dev/null)
    http_code=$(echo $response | cut -d: -f1)
    response_time=$(echo $response | cut -d: -f2)
    
    if [ "$http_code" = "$expected_status" ]; then
        echo "✅ $service_name: OK (${response_time}s)"
        log_message "SUCCESS: $service_name responding in ${response_time}s"
        return 0
    else
        echo "❌ $service_name: FAILED (HTTP $http_code)"
        log_message "ERROR: $service_name failed with HTTP $http_code"
        return 1
    fi
}

# Function to check API endpoint
check_api_endpoint() {
    local endpoint_name="$1"
    local url="$2"
    
    echo "🔄 Testing $endpoint_name..."
    
    response=$(curl -s "$url" 2>/dev/null)
    if echo "$response" | jq . >/dev/null 2>&1; then
        success=$(echo "$response" | jq -r '.success // "unknown"')
        if [ "$success" = "true" ]; then
            echo "✅ $endpoint_name: OK"
            log_message "SUCCESS: $endpoint_name API responding correctly"
            return 0
        else
            echo "⚠️ $endpoint_name: API returned success=false"
            log_message "WARNING: $endpoint_name API returned success=false"
            return 1
        fi
    else
        echo "❌ $endpoint_name: Invalid JSON response"
        log_message "ERROR: $endpoint_name returned invalid JSON"
        return 1
    fi
}

# Function to check system metrics
check_system_metrics() {
    echo "📊 Checking system metrics..."
    
    metrics=$(curl -s "$BACKEND_URL/api/v2/system/health-detailed" 2>/dev/null)
    if [ $? -eq 0 ]; then
        status=$(echo "$metrics" | jq -r '.status // "unknown"')
        response_time=$(echo "$metrics" | jq -r '.checks.responseTime.value // "unknown"')
        error_rate=$(echo "$metrics" | jq -r '.checks.errorRate.value // "unknown"')
        memory=$(echo "$metrics" | jq -r '.checks.memory.value // "unknown"')
        
        echo "📈 System Status: $status"
        echo "⏱️  Response Time: $response_time"
        echo "❌ Error Rate: $error_rate"
        echo "💾 Memory Usage: $memory"
        
        log_message "METRICS: Status=$status, ResponseTime=$response_time, ErrorRate=$error_rate, Memory=$memory"
        
        # Alert on high error rate
        error_rate_num=$(echo "$error_rate" | sed 's/%//')
        if (( $(echo "$error_rate_num > 15" | bc -l) )); then
            echo "🚨 ALERT: High error rate detected ($error_rate)"
            log_message "ALERT: High error rate $error_rate exceeds 15% threshold"
        fi
    else
        echo "❌ Failed to retrieve system metrics"
        log_message "ERROR: Failed to retrieve system metrics"
    fi
}

# Function to check token status
check_token_status() {
    echo "🔑 Checking token status..."
    
    status=$(curl -s "$BACKEND_URL/api/v2/system/status" 2>/dev/null)
    if [ $? -eq 0 ]; then
        expiry_minutes=$(echo "$status" | jq -r '.time_until_expiry_minutes // "unknown"')
        clickup_connected=$(echo "$status" | jq -r '.clickup_connected // false')
        
        echo "⏰ Token expires in: $expiry_minutes minutes"
        echo "🔗 ClickUp connected: $clickup_connected"
        
        log_message "TOKEN: ExpiresIn=${expiry_minutes}min, Connected=$clickup_connected"
        
        # Alert on token expiry
        if [ "$expiry_minutes" != "unknown" ] && [ "$expiry_minutes" -lt 30 ]; then
            echo "🚨 ALERT: Token expires in $expiry_minutes minutes!"
            log_message "ALERT: Token expires in $expiry_minutes minutes - manual refresh needed"
        fi
        
        if [ "$clickup_connected" != "true" ]; then
            echo "🚨 ALERT: ClickUp not connected!"
            log_message "ALERT: ClickUp connection lost"
        fi
    else
        echo "❌ Failed to retrieve token status"
        log_message "ERROR: Failed to retrieve token status"
    fi
}

# Main monitoring checks
echo ""
echo "🏥 HEALTH CHECKS"
echo "----------------"

# Basic service availability
check_service "Backend Health" "$BACKEND_URL/health" "200"
check_service "Frontend" "$FRONTEND_URL/" "200"

echo ""
echo "🔌 API ENDPOINTS"
echo "----------------"

# API endpoints functionality
check_api_endpoint "Local Dashboard Data" "$BACKEND_URL/api/v2/local/dashboard-data"
check_api_endpoint "Sync Status" "$BACKEND_URL/api/v2/local/sync-status"

echo ""
echo "📊 SYSTEM METRICS"
echo "-----------------"

check_system_metrics

echo ""
echo "🔐 AUTHENTICATION"
echo "-----------------"

check_token_status

echo ""
echo "📋 MONITORING SUMMARY"
echo "====================="

# Count recent errors in log
error_count=$(tail -100 "$LOG_FILE" 2>/dev/null | grep -c "ERROR" || echo "0")
alert_count=$(tail -100 "$LOG_FILE" 2>/dev/null | grep -c "ALERT" || echo "0")

echo "📝 Recent errors: $error_count"
echo "🚨 Recent alerts: $alert_count"

if [ "$error_count" -gt 5 ]; then
    echo "🚨 HIGH ERROR COUNT: $error_count errors detected!"
    log_message "ALERT: High error count $error_count in recent checks"
fi

echo ""
echo "✅ Monitoring complete - $(date)"
echo "📄 Full log: $LOG_FILE"