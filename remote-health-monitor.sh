#!/bin/bash

# 🔄 TaskFlow Remote Health Monitor (Local script to monitor remote services)
# สำหรับใช้จาก local เพื่อตรวจสอบและ restart remote services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE_USER="one-climate"
REMOTE_HOST="192.168.20.10"
REMOTE_PASSWORD="U8@1v3z#14"

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARN:${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

# ฟังก์ชันสำหรับตรวจสอบ remote port
check_remote_port() {
    local host=$1
    local port=$2
    
    if sshpass -p "$REMOTE_PASSWORD" ssh -o ConnectTimeout=5 "$REMOTE_USER@$REMOTE_HOST" "timeout 3 bash -c '</dev/tcp/$host/$port' 2>/dev/null"; then
        return 0
    else
        return 1
    fi
}

# ฟังก์ชันสำหรับตรวจสอบ remote systemd service
check_remote_systemd_service() {
    local service_name=$1
    
    local status=$(sshpass -p "$REMOTE_PASSWORD" ssh "$REMOTE_USER@$REMOTE_HOST" "systemctl is-active $service_name 2>/dev/null || echo 'inactive'")
    
    if [ "$status" = "active" ]; then
        return 0
    else
        return 1
    fi
}

# ฟังก์ชันสำหรับ restart remote service
restart_remote_service() {
    local service_name=$1
    
    info "🔄 Restarting remote $service_name..."
    
    if sshpass -p "$REMOTE_PASSWORD" ssh "$REMOTE_USER@$REMOTE_HOST" "echo '$REMOTE_PASSWORD' | sudo -S systemctl restart $service_name"; then
        log "✅ $service_name restarted successfully"
        sleep 3  # รอให้ service เริ่มทำงาน
        return 0
    else
        error "❌ Failed to restart $service_name"
        return 1
    fi
}

# ฟังก์ชันสำหรับ enable remote service
enable_remote_service() {
    local service_name=$1
    
    info "🔧 Enabling remote $service_name for auto-start..."
    
    if sshpass -p "$REMOTE_PASSWORD" ssh "$REMOTE_USER@$REMOTE_HOST" "echo '$REMOTE_PASSWORD' | sudo -S systemctl enable $service_name"; then
        log "✅ $service_name enabled for auto-start"
        return 0
    else
        error "❌ Failed to enable $service_name"
        return 1
    fi
}

# ฟังก์ชันสำหรับตรวจสอบและ restart individual service
check_and_restart_remote_service() {
    local service_name=$1
    local port=$2
    local display_name=$3
    
    printf "%-20s " "$display_name:"
    
    # ตรวจสอบ systemd service และ port
    if check_remote_systemd_service "$service_name" && check_remote_port "127.0.0.1" "$port"; then
        echo -e "${GREEN}✅ Running${NC} (port $port)"
        return 0
    else
        echo -e "${RED}❌ Down${NC} (port $port)"
        
        warn "Remote $display_name is down, attempting restart..."
        
        # Enable service ถ้ายังไม่ได้ enable
        enable_remote_service "$service_name"
        
        # Restart service
        if restart_remote_service "$service_name"; then
            # ตรวจสอบอีกครั้งหลัง restart
            sleep 3
            if check_remote_systemd_service "$service_name" && check_remote_port "127.0.0.1" "$port"; then
                log "🎉 Remote $display_name is now running successfully!"
                return 0
            else
                error "⚠️ Remote $display_name restart failed or still not responding"
                return 1
            fi
        fi
        return 1
    fi
}

# ฟังก์ชันหลักสำหรับตรวจสอบและ restart remote services
monitor_remote_services() {
    echo ""
    log "🔍 Starting TaskFlow remote services health check..."
    log "📡 Remote server: $REMOTE_HOST"
    echo ""
    
    local restart_needed=false
    local services_ok=0
    local total_services=5
    
    # ตรวจสอบ remote connection ก่อน
    if ! sshpass -p "$REMOTE_PASSWORD" ssh -o ConnectTimeout=10 "$REMOTE_USER@$REMOTE_HOST" "echo 'Connection test'" > /dev/null 2>&1; then
        error "❌ Cannot connect to remote server $REMOTE_HOST"
        return 1
    fi
    
    log "✅ Remote server connection successful"
    echo ""
    
    # ตรวจสอบ services ทีละตัว
    if check_and_restart_remote_service "taskflow-mongodb" "27777" "MongoDB"; then
        ((services_ok++))
    else
        restart_needed=true
    fi
    
    if check_and_restart_remote_service "taskflow-redis" "6777" "Redis"; then
        ((services_ok++))
    else
        restart_needed=true
    fi
    
    if check_and_restart_remote_service "taskflow-backend" "777" "Backend"; then
        ((services_ok++))
    else
        restart_needed=true
    fi
    
    if check_and_restart_remote_service "taskflow-frontend" "666" "Frontend"; then
        ((services_ok++))
    else
        restart_needed=true
    fi
    
    if check_and_restart_remote_service "taskflow-nginx" "555" "Nginx"; then
        ((services_ok++))
    else
        restart_needed=true
    fi
    
    echo ""
    log "Remote Services Status: $services_ok/$total_services running"
    
    # ตรวจสอบ remote application accessibility
    log "🌐 Testing remote application accessibility..."
    
    if curl -s --connect-timeout 10 "http://192.168.20.10:555" > /dev/null; then
        log "✅ Main application (http://192.168.20.10:555) is accessible"
    else
        error "❌ Main application is not accessible"
        restart_needed=true
    fi
    
    # ตรวจสอบ backend health endpoint
    if curl -s --connect-timeout 10 "http://192.168.20.10:777/health" > /dev/null; then
        log "✅ Backend health endpoint is responding"
        
        # ตรวจสอบ ClickUp Integration
        if curl -s "http://192.168.20.10:777/health" | grep -q "ClickUp"; then
            log "🔗 ClickUp Integration is ready!"
        else
            warn "⚠️ ClickUp Integration may not be fully configured"
        fi
    else
        warn "⚠️ Backend health endpoint is not responding"
    fi
    
    echo ""
    
    if [ "$restart_needed" = false ] && [ "$services_ok" -eq "$total_services" ]; then
        log "🎉 All remote TaskFlow services are running normally!"
        
        # แสดงข้อมูล access URLs
        echo ""
        info "🌐 Access URLs:"
        info "   Main App: http://192.168.20.10:555"
        info "   Backend:  http://192.168.20.10:777"
        info "   Frontend: http://192.168.20.10:666"
        
    else
        warn "🔄 Some remote services required restart or are still down."
        info "You may need to run this script again or check remote logs manually."
    fi
}

# ฟังก์ชันสำหรับตรวจสอบอย่างเดียว (ไม่ restart)
verify_remote_services_only() {
    echo ""
    log "🔍 Verifying remote TaskFlow services status..."
    log "📡 Remote server: $REMOTE_HOST"
    echo ""
    
    local all_good=true
    local services_ok=0
    
    # ตรวจสอบ remote connection ก่อน
    if ! sshpass -p "$REMOTE_PASSWORD" ssh -o ConnectTimeout=10 "$REMOTE_USER@$REMOTE_HOST" "echo 'Connection test'" > /dev/null 2>&1; then
        error "❌ Cannot connect to remote server $REMOTE_HOST"
        return 1
    fi
    
    log "✅ Remote server connection successful"
    echo ""
    
    # ตรวจสอบ services
    services=("taskflow-mongodb:27777:MongoDB" "taskflow-redis:6777:Redis" "taskflow-backend:777:Backend" "taskflow-frontend:666:Frontend" "taskflow-nginx:555:Nginx")
    
    for service_info in "${services[@]}"; do
        IFS=':' read -r service_name port display_name <<< "$service_info"
        
        printf "%-20s " "$display_name:"
        
        if check_remote_systemd_service "$service_name" && check_remote_port "127.0.0.1" "$port"; then
            echo -e "${GREEN}✅ Running${NC}"
            ((services_ok++))
        else
            echo -e "${RED}❌ Down${NC}"
            all_good=false
        fi
    done
    
    echo ""
    log "Remote Services Status: $services_ok/5 running"
    
    if [ "$all_good" = true ]; then
        log "🎉 All remote services verified and running!"
        
        # ทดสอบ ClickUp Integration
        info "🔗 Testing ClickUp Integration readiness..."
        if curl -s --connect-timeout 10 "http://192.168.20.10:777/health" | grep -q "ClickUp"; then
            log "✅ ClickUp Integration is ready!"
        else
            warn "⚠️ ClickUp Integration may not be fully configured"
        fi
        
        return 0
    else
        error "❌ Some remote services are still down"
        return 1
    fi
}

# Main execution
case "${1:-}" in
    --verify-only)
        verify_remote_services_only
        ;;
    --help)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Remote TaskFlow Health Monitor"
        echo "Monitors and restarts services on remote server: $REMOTE_HOST"
        echo ""
        echo "Options:"
        echo "  (no args)     Check and restart failed remote services"
        echo "  --verify-only Only verify remote service status (no restart)"
        echo "  --help        Show this help message"
        echo ""
        ;;
    *)
        monitor_remote_services
        ;;
esac

echo ""
log "🏁 Remote health monitor completed"