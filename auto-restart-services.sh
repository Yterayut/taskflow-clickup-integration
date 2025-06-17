#!/bin/bash

# 🔄 TaskFlow Auto-Restart Services Script
# สำหรับตรวจสอบและ restart services อัตโนมัติ

set -e

# ใช้ bash version ที่รองรับ associative arrays
if [ "${BASH_VERSION%%.*}" -lt 4 ]; then
    echo "Error: This script requires Bash 4.0 or later for associative arrays"
    exit 1
fi

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

# ฟังก์ชันสำหรับตรวจสอบ port
check_port() {
    local host=$1
    local port=$2
    local service_name=$3
    
    if sshpass -p "$REMOTE_PASSWORD" ssh -o ConnectTimeout=5 "$REMOTE_USER@$REMOTE_HOST" "timeout 3 bash -c '</dev/tcp/$host/$port' 2>/dev/null"; then
        echo "✅"
        return 0
    else
        echo "❌"
        return 1
    fi
}

# ฟังก์ชันสำหรับตรวจสอบ systemd service
check_systemd_service() {
    local service_name=$1
    
    local status=$(sshpass -p "$REMOTE_PASSWORD" ssh "$REMOTE_USER@$REMOTE_HOST" "systemctl is-active $service_name 2>/dev/null || echo 'inactive'")
    
    if [ "$status" = "active" ]; then
        echo "✅"
        return 0
    else
        echo "❌"
        return 1
    fi
}

# ฟังก์ชันสำหรับ restart service
restart_service() {
    local service_name=$1
    
    info "🔄 Restarting $service_name..."
    
    if sshpass -p "$REMOTE_PASSWORD" ssh "$REMOTE_USER@$REMOTE_HOST" "echo '$REMOTE_PASSWORD' | sudo -S systemctl restart $service_name"; then
        log "✅ $service_name restarted successfully"
        sleep 3  # รอให้ service เริ่มทำงาน
        return 0
    else
        error "❌ Failed to restart $service_name"
        return 1
    fi
}

# ฟังก์ชันสำหรับ enable service
enable_service() {
    local service_name=$1
    
    info "🔧 Enabling $service_name for auto-start..."
    
    if sshpass -p "$REMOTE_PASSWORD" ssh "$REMOTE_USER@$REMOTE_HOST" "echo '$REMOTE_PASSWORD' | sudo -S systemctl enable $service_name"; then
        log "✅ $service_name enabled for auto-start"
        return 0
    else
        error "❌ Failed to enable $service_name"
        return 1
    fi
}

# ฟังก์ชันหลักสำหรับตรวจสอบและ restart services
check_and_restart_services() {
    echo ""
    log "🔍 Starting TaskFlow services health check..."
    echo ""
    
    local restart_needed=false
    
    # กำหนด services ที่ต้องตรวจสอบ
    declare -A services=(
        ["taskflow-mongodb"]="27777:MongoDB"
        ["taskflow-redis"]="6777:Redis"
        ["taskflow-backend"]="777:Backend"
        ["taskflow-frontend"]="666:Frontend"
        ["taskflow-nginx"]="555:Nginx"
    )
    
    # ตรวจสอบ services ทีละตัว
    for service in "${!services[@]}"; do
        IFS=':' read -r port name <<< "${services[$service]}"
        
        printf "%-20s " "$name:"
        
        # ตรวจสอบ systemd service status
        local systemd_status=$(check_systemd_service $service)
        
        # ตรวจสอบ port availability
        local port_status=$(check_port "127.0.0.1" $port $name)
        
        if [ "$systemd_status" = "✅" ] && [ "$port_status" = "✅" ]; then
            echo -e "${GREEN}✅ Running${NC} (port $port)"
        else
            echo -e "${RED}❌ Down${NC} (systemd: $systemd_status, port: $port_status)"
            
            # ถ้า service หยุดทำงาน ให้ restart
            warn "$name is down, attempting restart..."
            restart_needed=true
            
            # Enable service ถ้ายังไม่ได้ enable
            enable_service $service
            
            # Restart service
            if restart_service $service; then
                # ตรวจสอบอีกครั้งหลัง restart
                sleep 2
                local new_status=$(check_systemd_service $service)
                local new_port_status=$(check_port "127.0.0.1" $port $name)
                
                if [ "$new_status" = "✅" ] && [ "$new_port_status" = "✅" ]; then
                    log "🎉 $name is now running successfully!"
                else
                    error "⚠️ $name restart failed or still not responding"
                fi
            fi
        fi
    done
    
    echo ""
    
    # ตรวจสอบ overall system status
    log "🌐 Testing main application accessibility..."
    
    if curl -s --connect-timeout 10 "http://192.168.20.10:555" > /dev/null; then
        log "✅ Main application (http://192.168.20.10:555) is accessible"
    else
        error "❌ Main application is not accessible"
        restart_needed=true
    fi
    
    # ตรวจสอบ backend health endpoint
    if curl -s --connect-timeout 10 "http://192.168.20.10:777/health" > /dev/null; then
        log "✅ Backend health endpoint is responding"
    else
        warn "⚠️ Backend health endpoint is not responding"
    fi
    
    echo ""
    
    if [ "$restart_needed" = true ]; then
        warn "🔄 Some services required restart. Waiting for stabilization..."
        sleep 5
        
        # Final verification
        log "🔍 Final verification of all services..."
        "$0" --verify-only
    else
        log "🎉 All TaskFlow services are running normally!"
    fi
}

# ฟังก์ชันสำหรับตรวจสอบอย่างเดียว (ไม่ restart)
verify_services_only() {
    echo ""
    log "🔍 Verifying TaskFlow services status..."
    echo ""
    
    declare -A services=(
        ["taskflow-mongodb"]="27777:MongoDB"
        ["taskflow-redis"]="6777:Redis"  
        ["taskflow-backend"]="777:Backend"
        ["taskflow-frontend"]="666:Frontend"
        ["taskflow-nginx"]="555:Nginx"
    )
    
    local all_good=true
    
    for service in "${!services[@]}"; do
        IFS=':' read -r port name <<< "${services[$service]}"
        
        printf "%-20s " "$name:"
        
        local systemd_status=$(check_systemd_service $service)
        local port_status=$(check_port "127.0.0.1" $port $name)
        
        if [ "$systemd_status" = "✅" ] && [ "$port_status" = "✅" ]; then
            echo -e "${GREEN}✅ Running${NC}"
        else
            echo -e "${RED}❌ Down${NC}"
            all_good=false
        fi
    done
    
    echo ""
    
    if [ "$all_good" = true ]; then
        log "🎉 All services verified and running!"
        
        # ทดสอบ ClickUp Integration
        info "🔗 Testing ClickUp Integration readiness..."
        if curl -s --connect-timeout 10 "http://192.168.20.10:777/health" | grep -q "ClickUp"; then
            log "✅ ClickUp Integration is ready!"
        else
            warn "⚠️ ClickUp Integration may not be fully configured"
        fi
        
        return 0
    else
        error "❌ Some services are still down"
        return 1
    fi
}

# Schedule auto-restart as cron job
setup_auto_restart_cron() {
    log "🕒 Setting up automatic health check every 5 minutes..."
    
    local cron_job="*/5 * * * * cd $SCRIPT_DIR && ./auto-restart-services.sh --verify-only >> ~/team-workload/auto-restart.log 2>&1"
    
    # เพิ่ม cron job ถ้ายังไม่มี
    if ! crontab -l 2>/dev/null | grep -q "auto-restart-services.sh"; then
        (crontab -l 2>/dev/null; echo "$cron_job") | crontab -
        log "✅ Auto-restart cron job added (every 5 minutes)"
    else
        info "ℹ️ Auto-restart cron job already exists"
    fi
}

# Main execution
case "${1:-}" in
    --verify-only)
        verify_services_only
        ;;
    --setup-cron)
        setup_auto_restart_cron
        ;;
    --help)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  (no args)     Check and restart failed services"
        echo "  --verify-only Only verify service status (no restart)"
        echo "  --setup-cron  Setup automatic health check every 5 minutes"
        echo "  --help        Show this help message"
        echo ""
        ;;
    *)
        check_and_restart_services
        
        # สอบถามเกี่ยวกับการตั้ง cron job
        echo ""
        read -p "🕒 Do you want to setup automatic health check every 5 minutes? (y/N): " setup_cron
        if [[ "$setup_cron" =~ ^[Yy]$ ]]; then
            setup_auto_restart_cron
        fi
        ;;
esac

echo ""
log "🏁 Auto-restart services script completed"