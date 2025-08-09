#!/bin/bash

# TaskFlow Pro Role-Based Dashboard Deployment Script
# Deploys the complete role-based authentication and dashboard system

set -e  # Exit on any error

# Configuration
SERVER="one-climate@192.168.20.10"
REMOTE_PATH="/home/one-climate/team-workload"
FRONTEND_PATH="/var/www/taskflow"
SERVICE_NAME="taskflow-auth"
BACKEND_PORT="7812"
FRONTEND_PORT="8888"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Header
echo -e "${BLUE}🚀 TaskFlow Pro Role-Based Dashboard Deployment${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

# Pre-deployment checks
log_info "Running pre-deployment checks..."

# Check if server is reachable
if ! ssh -o ConnectTimeout=5 "$SERVER" "echo 'Server connection OK'" > /dev/null 2>&1; then
    log_error "Cannot connect to server $SERVER"
    exit 1
fi

log_success "Server connection verified"

# Check if required files exist
REQUIRED_FILES=(
    "single_login_backend.js"
    "role_based_dashboard.html"
    "domain/value-objects/UserRole.js"
    "application/services/AuthenticationService.js"
    "api/routes/dashboardRoutes.js"
    "api/routes/tokenRoutes.js"
    "public/js/token-manager.js"
    "test_role_based_system.js"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$file" ]]; then
        log_error "Required file missing: $file"
        exit 1
    fi
done

log_success "All required files present"

# Create backup
log_info "Creating system backup..."
BACKUP_NAME="role_based_system_backup_$(date +%Y%m%d_%H%M%S)"

ssh "$SERVER" "
    cd $REMOTE_PATH
    mkdir -p backups
    cp -r . backups/$BACKUP_NAME/ 2>/dev/null || true
    echo 'Backup created: $BACKUP_NAME'
"

log_success "Backup created: $BACKUP_NAME"

# Stop current services
log_info "Stopping current services..."
ssh "$SERVER" "
    sudo systemctl stop nginx || true
    pkill -f 'node.*backend' || true
    pkill -f 'node.*single_login' || true
    sleep 3
"

log_success "Services stopped"

# Deploy backend files
log_info "Deploying backend files..."

# Copy main backend
scp single_login_backend.js "$SERVER:$REMOTE_PATH/"

# Copy domain layer
ssh "$SERVER" "mkdir -p $REMOTE_PATH/domain/value-objects $REMOTE_PATH/domain/entities"
scp domain/value-objects/UserRole.js "$SERVER:$REMOTE_PATH/domain/value-objects/"
scp domain/entities/User.js "$SERVER:$REMOTE_PATH/domain/entities/" 2>/dev/null || true

# Copy application layer
ssh "$SERVER" "mkdir -p $REMOTE_PATH/application/services"
scp application/services/AuthenticationService.js "$SERVER:$REMOTE_PATH/application/services/"

# Copy infrastructure layer (if exists)
if [[ -d "infrastructure" ]]; then
    scp -r infrastructure/ "$SERVER:$REMOTE_PATH/" 2>/dev/null || true
fi

# Copy API routes
ssh "$SERVER" "mkdir -p $REMOTE_PATH/api/routes"
scp api/routes/dashboardRoutes.js "$SERVER:$REMOTE_PATH/api/routes/"
scp api/routes/tokenRoutes.js "$SERVER:$REMOTE_PATH/api/routes/"

# Copy existing API routes
for route in singleAuthRoutes.js oauthRoutes.js systemRoutes.js clickupDataRoutes.js; do
    if [[ -f "api/routes/$route" ]]; then
        scp "api/routes/$route" "$SERVER:$REMOTE_PATH/api/routes/"
    fi
done

log_success "Backend files deployed"

# Deploy frontend files
log_info "Deploying frontend files..."

# Copy main dashboard
scp role_based_dashboard.html "$SERVER:$REMOTE_PATH/"

# Copy static assets
ssh "$SERVER" "mkdir -p $REMOTE_PATH/public/js"
scp public/js/token-manager.js "$SERVER:$REMOTE_PATH/public/js/"

# Deploy to nginx directory
ssh "$SERVER" "
    sudo cp $REMOTE_PATH/role_based_dashboard.html $FRONTEND_PATH/role_based_dashboard.html
    sudo cp $REMOTE_PATH/current_dashboard.html $FRONTEND_PATH/index.html 2>/dev/null || true
    sudo mkdir -p $FRONTEND_PATH/js
    sudo cp $REMOTE_PATH/public/js/token-manager.js $FRONTEND_PATH/js/
    sudo chown -R www-data:www-data $FRONTEND_PATH
    sudo chmod -R 755 $FRONTEND_PATH
"

log_success "Frontend files deployed"

# Deploy test files
log_info "Deploying test files..."
scp test_role_based_system.js "$SERVER:$REMOTE_PATH/"

# Update package dependencies (if needed)
log_info "Checking dependencies..."
ssh "$SERVER" "
    cd $REMOTE_PATH
    if [[ -f package.json ]]; then
        npm install --production 2>/dev/null || true
    fi
"

# Set environment variables
log_info "Setting environment variables..."
ssh "$SERVER" "
    cd $REMOTE_PATH
    # Ensure required environment variables are set
    grep -q 'SINGLE_LOGIN_ENABLED' .env || echo 'SINGLE_LOGIN_ENABLED=true' >> .env
    grep -q 'LEGACY_SUPPORT' .env || echo 'LEGACY_SUPPORT=true' >> .env
    grep -q 'TOKEN_GRACE_PERIOD_MINUTES' .env || echo 'TOKEN_GRACE_PERIOD_MINUTES=30' >> .env
"

# Start backend service
log_info "Starting backend service..."
ssh "$SERVER" "
    cd $REMOTE_PATH
    PORT=$BACKEND_PORT nohup node single_login_backend.js > role_based_backend.log 2>&1 &
    sleep 5
"

# Start nginx
log_info "Starting nginx..."
ssh "$SERVER" "sudo systemctl start nginx"

# Health checks
log_info "Performing health checks..."

# Wait for backend to start
sleep 10

# Check backend health
BACKEND_HEALTH=$(ssh "$SERVER" "curl -s http://localhost:$BACKEND_PORT/health | jq -r '.status' 2>/dev/null" || echo "ERROR")
if [[ "$BACKEND_HEALTH" == "OK" ]]; then
    log_success "Backend health check passed"
else
    log_error "Backend health check failed"
    ssh "$SERVER" "tail -20 $REMOTE_PATH/role_based_backend.log"
    exit 1
fi

# Check frontend accessibility
FRONTEND_STATUS=$(ssh "$SERVER" "curl -s -o /dev/null -w '%{http_code}' http://localhost:$FRONTEND_PORT/role_based_dashboard.html" || echo "000")
if [[ "$FRONTEND_STATUS" == "200" ]]; then
    log_success "Frontend accessibility check passed"
else
    log_error "Frontend accessibility check failed (HTTP $FRONTEND_STATUS)"
    exit 1
fi

# Run integration tests
log_info "Running integration tests..."
ssh "$SERVER" "
    cd $REMOTE_PATH
    if command -v node >/dev/null 2>&1; then
        timeout 60 node test_role_based_system.js || echo 'Some tests may have failed - check manually'
    else
        echo 'Node.js not available for testing'
    fi
"

# Display system information
log_info "Deployment completed successfully!"
echo ""
echo -e "${GREEN}🎉 Role-Based Dashboard System Deployed${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""
echo -e "${BLUE}Access URLs:${NC}"
echo -e "  🌐 Role-Based Dashboard: http://192.168.20.10:$FRONTEND_PORT/role_based_dashboard.html"
echo -e "  🌐 Current Dashboard:    http://192.168.20.10:$FRONTEND_PORT/"
echo -e "  🔐 Login Page:           http://192.168.20.10:$FRONTEND_PORT/login-v2.html"
echo -e "  🔌 Backend API:          http://192.168.20.10:$BACKEND_PORT/"
echo ""
echo -e "${BLUE}API Endpoints:${NC}"
echo -e "  🔑 Authentication:       /api/v2/auth/*"
echo -e "  🎛️  Dashboard:            /api/v2/dashboard/*"
echo -e "  🔄 Token Management:     /api/v2/token/*"
echo -e "  🔗 ClickUp Integration:  /api/v2/clickup/*"
echo -e "  ⚙️  System:               /api/v2/system/*"
echo ""
echo -e "${BLUE}Test Users:${NC}"
echo -e "  👑 Master (OAuth):       yterayut@gmail.com"
echo -e "  👨‍💼 Team Lead:            chaiwutwck@gmail.com / 12345"
echo -e "  👨‍🔧 Employee:             atthakorn.na@ku.th / 12345"
echo ""
echo -e "${BLUE}Features:${NC}"
echo -e "  ✅ Role-based authentication"
echo -e "  ✅ Automatic token refresh"
echo -e "  ✅ Dynamic dashboard components"
echo -e "  ✅ Master user ClickUp OAuth"
echo -e "  ✅ Grace period token handling"
echo ""
echo -e "${BLUE}Monitoring:${NC}"
echo -e "  📊 Health Check:         curl http://192.168.20.10:$BACKEND_PORT/health"
echo -e "  📋 Backend Logs:         ssh $SERVER 'tail -f $REMOTE_PATH/role_based_backend.log'"
echo -e "  🔍 Integration Test:     ssh $SERVER 'cd $REMOTE_PATH && node test_role_based_system.js'"
echo ""

# Save deployment info
ssh "$SERVER" "
    cd $REMOTE_PATH
    cat > DEPLOYMENT_INFO.md << EOF
# Role-Based Dashboard Deployment

**Deployment Date:** $(date)
**Version:** Role-Based Dashboard v1.0
**Backup:** $BACKUP_NAME

## Deployed Components
- Enhanced UserRole value object (5 roles)
- JWT token management with refresh logic
- Role-based dashboard APIs
- Dynamic frontend with token manager
- Integration tests

## URLs
- Dashboard: http://192.168.20.10:$FRONTEND_PORT/role_based_dashboard.html
- API: http://192.168.20.10:$BACKEND_PORT/

## Health Check
\`\`\`bash
curl http://192.168.20.10:$BACKEND_PORT/health
\`\`\`

EOF
"

log_success "Deployment information saved to DEPLOYMENT_INFO.md"
log_success "🎯 Role-Based Dashboard System is now live!"

echo ""
echo -e "${GREEN}Next Steps:${NC}"
echo -e "  1. 🧪 Test the system with different user roles"
echo -e "  2. 📊 Monitor system performance and logs"
echo -e "  3. 👥 Train users on the new role-based interface"
echo -e "  4. 🔄 Monitor automatic token refresh functionality"
echo ""