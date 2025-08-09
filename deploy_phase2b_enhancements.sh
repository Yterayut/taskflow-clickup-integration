#!/bin/bash

# TaskFlow Pro Phase 2b Deployment Script
# Real-time + Email Services + SPA Foundation
# Version: 2.2.0

set -e  # Exit on any error

echo "🚀 TaskFlow Pro Phase 2b Deployment Starting..."
echo "📅 $(date)"
echo "🔧 Deploying: Email Service + WebSocket + SPA Foundation"

# Configuration
SERVER="one-climate@192.168.20.10"
REMOTE_DIR="/home/one-climate/team-workload"
LOCAL_DIR="."
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"

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

# Function to check if server is reachable
check_server() {
    print_status "Checking server connectivity..."
    if ping -c 1 192.168.20.10 &> /dev/null; then
        print_success "Server is reachable"
    else
        print_error "Server is not reachable"
        exit 1
    fi
}

# Function to backup current system
backup_system() {
    print_status "Creating system backup..."
    
    ssh $SERVER "
        cd $REMOTE_DIR
        mkdir -p backups/$BACKUP_DIR
        
        # Backup critical files
        cp single_login_backend_with_sync.js backups/$BACKUP_DIR/ 2>/dev/null || true
        cp -r infrastructure/ backups/$BACKUP_DIR/ 2>/dev/null || true
        cp -r api/ backups/$BACKUP_DIR/ 2>/dev/null || true
        cp package.json backups/$BACKUP_DIR/ 2>/dev/null || true
        
        echo 'Backup created: $BACKUP_DIR'
    "
    
    print_success "System backup created: $BACKUP_DIR"
}

# Function to install Node.js dependencies
install_dependencies() {
    print_status "Installing new Node.js dependencies..."
    
    ssh $SERVER "
        cd $REMOTE_DIR
        
        # Install email dependencies
        npm install nodemailer @types/nodemailer --save
        
        # Install WebSocket dependencies  
        npm install ws socket.io @types/ws --save
        
        # Install utility dependencies
        npm install uuid @types/uuid --save
        
        print_success 'Dependencies installed successfully'
    "
}

# Function to create necessary directories
create_directories() {
    print_status "Creating directory structure..."
    
    ssh $SERVER "
        cd $REMOTE_DIR
        
        # Create infrastructure directories
        mkdir -p infrastructure/adapters
        mkdir -p api/routes
        mkdir -p frontend-spa/src/{types,services,components,pages,hooks,utils,store,assets}
        
        print_success 'Directory structure created'
    "
}

# Function to upload new files
upload_files() {
    print_status "Uploading enhanced backend files..."
    
    # Upload infrastructure adapters
    scp infrastructure/adapters/EmailService.js $SERVER:$REMOTE_DIR/infrastructure/adapters/
    scp infrastructure/adapters/RealtimeService.js $SERVER:$REMOTE_DIR/infrastructure/adapters/
    
    # Upload API routes
    scp api/routes/emailRoutes.js $SERVER:$REMOTE_DIR/api/routes/
    scp api/routes/realtimeRoutes.js $SERVER:$REMOTE_DIR/api/routes/
    
    # Upload enhanced backend
    scp single_login_backend_with_sync.js $SERVER:$REMOTE_DIR/
    
    print_success "Backend files uploaded"
    
    print_status "Uploading SPA foundation files..."
    
    # Upload SPA foundation
    scp frontend-spa/package.json $SERVER:$REMOTE_DIR/frontend-spa/
    scp frontend-spa/vite.config.ts $SERVER:$REMOTE_DIR/frontend-spa/
    scp frontend-spa/tsconfig.json $SERVER:$REMOTE_DIR/frontend-spa/
    scp frontend-spa/src/types/index.ts $SERVER:$REMOTE_DIR/frontend-spa/src/types/
    scp frontend-spa/src/services/api.ts $SERVER:$REMOTE_DIR/frontend-spa/src/services/
    scp frontend-spa/src/services/websocket.ts $SERVER:$REMOTE_DIR/frontend-spa/src/services/
    
    print_success "SPA foundation files uploaded"
}

# Function to setup environment variables
setup_environment() {
    print_status "Setting up environment variables..."
    
    ssh $SERVER "
        cd $REMOTE_DIR
        
        # Create .env file if it doesn't exist
        if [ ! -f .env ]; then
            touch .env
        fi
        
        # Add email configuration (if not exists)
        if ! grep -q 'EMAIL_ENABLED' .env; then
            echo 'EMAIL_ENABLED=true' >> .env
            echo 'SMTP_HOST=smtp.gmail.com' >> .env
            echo 'SMTP_PORT=587' >> .env
            echo 'SMTP_USER=' >> .env
            echo 'SMTP_PASSWORD=' >> .env
            echo 'SMTP_FROM=TaskFlow Pro <noreply@taskflow.pro>' >> .env
            echo 'SECURITY_ALERT_EMAIL=admin@taskflow.pro' >> .env
        fi
        
        # Add realtime configuration
        if ! grep -q 'REALTIME_PORT' .env; then
            echo 'REALTIME_PORT=7813' >> .env
        fi
        
        print_success 'Environment variables configured'
    "
}

# Function to stop current services
stop_services() {
    print_status "Stopping current services..."
    
    ssh $SERVER "
        cd $REMOTE_DIR
        
        # Stop backend services
        pkill -f 'node.*single_login_backend' || true
        pkill -f 'node.*backend.*enhanced' || true
        
        # Wait for graceful shutdown
        sleep 3
        
        print_success 'Services stopped'
    "
}

# Function to start enhanced services
start_services() {
    print_status "Starting enhanced services..."
    
    ssh $SERVER "
        cd $REMOTE_DIR
        
        # Start enhanced backend with real-time and email support
        nohup node single_login_backend_with_sync.js > logs/backend_phase2b.log 2>&1 &
        
        # Wait for services to start
        sleep 5
        
        print_success 'Enhanced services started'
    "
}

# Function to verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    # Test backend health
    print_status "Testing backend health..."
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://192.168.20.10:7812/health || echo "000")
    
    if [ "$HTTP_STATUS" = "200" ]; then
        print_success "Backend is healthy (HTTP $HTTP_STATUS)"
    else
        print_error "Backend health check failed (HTTP $HTTP_STATUS)"
        return 1
    fi
    
    # Test email service
    print_status "Testing email service..."
    EMAIL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://192.168.20.10:7812/api/v2/email/health || echo "000")
    
    if [ "$EMAIL_STATUS" = "200" ]; then
        print_success "Email service is healthy (HTTP $EMAIL_STATUS)"
    else
        print_warning "Email service not responding (HTTP $EMAIL_STATUS) - may be disabled"
    fi
    
    # Test realtime service
    print_status "Testing realtime service..."
    REALTIME_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://192.168.20.10:7812/api/v2/realtime/health || echo "000")
    
    if [ "$REALTIME_STATUS" = "200" ]; then
        print_success "Realtime service is healthy (HTTP $REALTIME_STATUS)"
    else
        print_warning "Realtime service not responding (HTTP $REALTIME_STATUS)"
    fi
    
    # Test WebSocket connection
    print_status "Testing WebSocket connection..."
    if nc -z 192.168.20.10 7813 2>/dev/null; then
        print_success "WebSocket port 7813 is open"
    else
        print_warning "WebSocket port 7813 is not accessible"
    fi
}

# Function to display deployment summary
deployment_summary() {
    print_status "Generating deployment summary..."
    
    ssh $SERVER "
        cd $REMOTE_DIR
        echo '=== TaskFlow Pro Phase 2b Deployment Summary ===' > deployment_summary_phase2b.txt
        echo 'Date: $(date)' >> deployment_summary_phase2b.txt
        echo 'Version: 2.2.0' >> deployment_summary_phase2b.txt
        echo '' >> deployment_summary_phase2b.txt
        echo 'Enhanced Features:' >> deployment_summary_phase2b.txt
        echo '✅ Email Service (Security alerts, notifications)' >> deployment_summary_phase2b.txt
        echo '✅ WebSocket Real-time (Live dashboard updates)' >> deployment_summary_phase2b.txt
        echo '✅ SPA Foundation (React/TypeScript structure)' >> deployment_summary_phase2b.txt
        echo '✅ Enhanced Backend (Email + WebSocket integration)' >> deployment_summary_phase2b.txt
        echo '' >> deployment_summary_phase2b.txt
        echo 'Service Endpoints:' >> deployment_summary_phase2b.txt
        echo '- Backend API: http://192.168.20.10:7812' >> deployment_summary_phase2b.txt
        echo '- Email API: http://192.168.20.10:7812/api/v2/email' >> deployment_summary_phase2b.txt
        echo '- Realtime API: http://192.168.20.10:7812/api/v2/realtime' >> deployment_summary_phase2b.txt
        echo '- WebSocket: ws://192.168.20.10:7813' >> deployment_summary_phase2b.txt
        echo '' >> deployment_summary_phase2b.txt
        echo 'Backup Location: backups/$BACKUP_DIR' >> deployment_summary_phase2b.txt
    "
    
    print_success "Deployment summary created"
}

# Function to rollback on failure
rollback() {
    print_error "Deployment failed. Initiating rollback..."
    
    ssh $SERVER "
        cd $REMOTE_DIR
        
        # Stop current services
        pkill -f 'node.*single_login_backend' || true
        
        # Restore from backup
        if [ -d backups/$BACKUP_DIR ]; then
            cp backups/$BACKUP_DIR/single_login_backend_with_sync.js ./ || true
            cp -r backups/$BACKUP_DIR/infrastructure/ ./ || true
            cp -r backups/$BACKUP_DIR/api/ ./ || true
            
            # Restart old service
            nohup node single_login_backend_with_sync.js > logs/backend_rollback.log 2>&1 &
            
            echo 'System rolled back to previous version'
        fi
    "
    
    print_error "Rollback completed. Please check the system manually."
    exit 1
}

# Main deployment process
main() {
    echo "🚀 Starting TaskFlow Pro Phase 2b Deployment"
    echo "============================================="
    
    # Set trap for error handling
    trap rollback ERR
    
    # Pre-deployment checks
    check_server
    
    # Deployment steps
    backup_system
    create_directories
    install_dependencies
    upload_files
    setup_environment
    stop_services
    start_services
    
    # Wait for services to fully start
    sleep 10
    
    # Verification
    verify_deployment
    
    # Generate summary
    deployment_summary
    
    echo ""
    echo "🎉 TaskFlow Pro Phase 2b Deployment Complete!"
    echo "=============================================="
    print_success "Enhanced Features Deployed:"
    echo "  ✅ Email Service for security alerts and notifications"
    echo "  ✅ WebSocket Real-time communication system"
    echo "  ✅ SPA Foundation with React/TypeScript structure"
    echo "  ✅ Enhanced Backend with integrated services"
    echo ""
    print_success "Service Endpoints:"
    echo "  📡 Backend API: http://192.168.20.10:7812"
    echo "  📧 Email API: http://192.168.20.10:7812/api/v2/email"
    echo "  🔄 Realtime API: http://192.168.20.10:7812/api/v2/realtime"
    echo "  🔌 WebSocket: ws://192.168.20.10:7813"
    echo ""
    print_success "Next Steps:"
    echo "  1. Configure email settings in .env file"
    echo "  2. Test email functionality with /api/v2/email/test"
    echo "  3. Begin React SPA development in frontend-spa/"
    echo "  4. Monitor logs in logs/backend_phase2b.log"
    echo ""
    print_warning "Remember to update CLAUDE.md with deployment status!"
}

# Run main function
main "$@"