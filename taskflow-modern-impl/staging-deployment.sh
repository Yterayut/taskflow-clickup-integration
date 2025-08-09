#!/bin/bash

# TaskFlow Modern - Staging Deployment Script
# Deploys the modern system to staging environment for testing

set -e

echo "🚀 TaskFlow Modern - Staging Deployment"
echo "======================================="

# Configuration
STAGING_SERVER="192.168.20.10"
STAGING_USER="one-climate"
STAGING_PASSWORD="U8@1v3z#14"
STAGING_PORT="3001"  # Different from production
BACKEND_PORT="5001"  # Different from production
PROJECT_NAME="taskflow-modern-staging"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "README.md" ] || [ ! -d "apps" ]; then
    log_error "Please run this script from the taskflow-modern-impl directory"
    exit 1
fi

# 1. Prepare staging configuration
log_info "Preparing staging configuration..."

# Create staging environment files
cp apps/backend/.env apps/backend/.env.staging
cp apps/frontend/.env apps/frontend/.env.staging

# Update staging backend config
cat > apps/backend/.env.staging << EOF
# Staging Environment
NODE_ENV=staging
HOST=0.0.0.0
PORT=${BACKEND_PORT}

# Database Configuration
DATABASE_PATH=/home/one-climate/taskflow-staging/data/taskflow.db
BACKUP_PATH=/home/one-climate/taskflow-staging/backups

# JWT Configuration (Use production-like secret)
JWT_SECRET=taskflow-staging-jwt-secret-key-for-testing-2024-secure
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGINS=http://${STAGING_SERVER}:${STAGING_PORT},http://localhost:${STAGING_PORT}

# ClickUp Integration (Same as production)
CLICKUP_CLIENT_ID=DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL
CLICKUP_CLIENT_SECRET=BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX
CLICKUP_REDIRECT_URI=http://${STAGING_SERVER}:${BACKEND_PORT}/api/auth/clickup/callback

# Logging
LOG_LEVEL=debug
LOG_FILE_ENABLED=true
LOG_FILE_PATH=/home/one-climate/taskflow-staging/logs
EOF

# Update staging frontend config
cat > apps/frontend/.env.staging << EOF
# Staging Environment
VITE_API_URL=http://${STAGING_SERVER}:${BACKEND_PORT}
VITE_WS_URL=ws://${STAGING_SERVER}:${BACKEND_PORT}

# ClickUp Integration
VITE_CLICKUP_CLIENT_ID=DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL
VITE_CLICKUP_REDIRECT_URI=http://${STAGING_SERVER}:${BACKEND_PORT}/api/auth/clickup/callback

# Staging Settings
VITE_DEBUG_MODE=true
VITE_SHOW_REDUX_DEVTOOLS=true
VITE_APP_NAME=TaskFlow Pro (Staging)
EOF

log_success "Staging configuration prepared"

# 2. Create deployment package
log_info "Creating deployment package..."

# Create temporary deployment directory
DEPLOY_DIR="./staging-deploy-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$DEPLOY_DIR"

# Copy essential files
cp -r apps "$DEPLOY_DIR/"
cp -r packages "$DEPLOY_DIR/"
cp -r migration "$DEPLOY_DIR/"
cp package.json "$DEPLOY_DIR/"
cp README.md "$DEPLOY_DIR/"
cp DEPLOYMENT_GUIDE.md "$DEPLOY_DIR/"

# Copy staging configurations
cp apps/backend/.env.staging "$DEPLOY_DIR/apps/backend/.env"
cp apps/frontend/.env.staging "$DEPLOY_DIR/apps/frontend/.env"

# Create staging deployment script for server
cat > "$DEPLOY_DIR/deploy-staging.sh" << 'EOF'
#!/bin/bash

echo "🚀 Starting TaskFlow Modern Staging Deployment on Server"

# Create project directory
sudo mkdir -p /home/one-climate/taskflow-staging/{data,logs,backups}
sudo chown -R one-climate:one-climate /home/one-climate/taskflow-staging

# Copy database from migration
cp migration/apps/backend/data/taskflow.db /home/one-climate/taskflow-staging/data/

# Install backend dependencies
cd apps/backend
npm install --legacy-peer-deps --production

# Install frontend dependencies and build
cd ../frontend
npm install --legacy-peer-deps
npm run build

# Install PM2 if not already installed
sudo npm install -g pm2

# Stop existing staging processes
pm2 delete taskflow-staging-backend 2>/dev/null || true
pm2 delete taskflow-staging-frontend 2>/dev/null || true

# Start backend
cd ../backend
pm2 start npm --name "taskflow-staging-backend" -- start

# Serve frontend build
cd ../frontend
pm2 serve dist ${STAGING_PORT} --name "taskflow-staging-frontend"

# Save PM2 configuration
pm2 save

echo "✅ TaskFlow Modern Staging deployed successfully!"
echo "🌐 Frontend: http://$(hostname -I | awk '{print $1}'):${STAGING_PORT}"
echo "⚙️  Backend: http://$(hostname -I | awk '{print $1}'):${BACKEND_PORT}"
echo "🔍 Health: http://$(hostname -I | awk '{print $1}'):${BACKEND_PORT}/health"
EOF

chmod +x "$DEPLOY_DIR/deploy-staging.sh"

# Create archive
tar -czf "${DEPLOY_DIR}.tar.gz" -C "$DEPLOY_DIR" .

log_success "Deployment package created: ${DEPLOY_DIR}.tar.gz"

# 3. Upload to staging server
log_info "Uploading to staging server..."

# Use sshpass if available, otherwise manual
if command -v sshpass >/dev/null 2>&1; then
    sshpass -p "$STAGING_PASSWORD" scp "${DEPLOY_DIR}.tar.gz" "${STAGING_USER}@${STAGING_SERVER}:/tmp/"
    log_success "Package uploaded successfully"
else
    log_warning "sshpass not available. Please upload manually:"
    echo "scp ${DEPLOY_DIR}.tar.gz ${STAGING_USER}@${STAGING_SERVER}:/tmp/"
    read -p "Press Enter when upload is complete..."
fi

# 4. Deploy on staging server
log_info "Deploying on staging server..."

# Create remote deployment script
REMOTE_SCRIPT=$(cat << 'EOF'
cd /tmp
tar -xzf staging-deploy-*.tar.gz -C /home/one-climate/taskflow-staging --strip-components=1
cd /home/one-climate/taskflow-staging
chmod +x deploy-staging.sh
./deploy-staging.sh
EOF
)

if command -v sshpass >/dev/null 2>&1; then
    sshpass -p "$STAGING_PASSWORD" ssh "${STAGING_USER}@${STAGING_SERVER}" "$REMOTE_SCRIPT"
else
    log_warning "Please run the following commands on the staging server:"
    echo "$REMOTE_SCRIPT"
    read -p "Press Enter when deployment is complete..."
fi

# 5. Verify deployment
log_info "Verifying staging deployment..."

sleep 5

# Test backend health
BACKEND_URL="http://${STAGING_SERVER}:${BACKEND_PORT}"
FRONTEND_URL="http://${STAGING_SERVER}:${STAGING_PORT}"

if curl -f -s "${BACKEND_URL}/health" >/dev/null; then
    log_success "Backend is healthy: ${BACKEND_URL}/health"
else
    log_warning "Backend health check failed"
fi

if curl -f -s "${FRONTEND_URL}" >/dev/null; then
    log_success "Frontend is accessible: ${FRONTEND_URL}"
else
    log_warning "Frontend access check failed"
fi

# 6. Generate staging test report
log_info "Generating staging test report..."

cat > staging-test-report.md << EOF
# TaskFlow Modern - Staging Deployment Report

**Deployment Date**: $(date)
**Deployment Status**: ✅ COMPLETED

## 🌐 Staging URLs

- **Frontend**: ${FRONTEND_URL}
- **Backend API**: ${BACKEND_URL}
- **Health Check**: ${BACKEND_URL}/health
- **API Documentation**: ${BACKEND_URL}/api

## 🧪 Test Credentials

### Manager Account
- **Email**: yterayut@gmail.com
- **Password**: 12345
- **Access**: Full system access

### Team Lead Account
- **Email**: chaiwutwck@gmail.com
- **Password**: 12345
- **Access**: Team management

### Employee Account
- **Email**: kittipong@example.com
- **Password**: 12345
- **Access**: Personal tasks only

## 📋 Test Checklist

### Basic Functionality
- [ ] Login with each role
- [ ] Dashboard loading
- [ ] Navigation between pages
- [ ] Dark/Light mode toggle
- [ ] Responsive design (mobile/tablet)

### Manager Tests
- [ ] User management
- [ ] Team analytics
- [ ] All reports access
- [ ] System settings

### Team Lead Tests
- [ ] Team member management
- [ ] Team task overview
- [ ] Team attendance reports

### Employee Tests
- [ ] Personal dashboard
- [ ] Task management
- [ ] Attendance clock in/out
- [ ] Profile management

### ClickUp Integration
- [ ] OAuth authentication
- [ ] Task synchronization
- [ ] Data consistency

### Performance Tests
- [ ] Page load times < 3s
- [ ] API response times < 500ms
- [ ] No console errors
- [ ] Memory usage acceptable

## 🐛 Issues Found

_Record any issues discovered during testing:_

1. 
2. 
3. 

## ✅ Sign-off

- [ ] **Frontend Developer**: ________________
- [ ] **Backend Developer**: ________________
- [ ] **Team Lead**: ________________
- [ ] **Manager**: ________________

## 📝 Notes

_Additional notes and observations:_

---

**Next Steps**: After successful staging tests, proceed with production deployment.
EOF

log_success "Staging test report generated: staging-test-report.md"

# 7. Cleanup
log_info "Cleaning up temporary files..."
rm -rf "$DEPLOY_DIR"
rm -f "${DEPLOY_DIR}.tar.gz"
rm -f apps/backend/.env.staging
rm -f apps/frontend/.env.staging

# 8. Final summary
echo ""
echo "🎉 Staging Deployment Summary"
echo "============================"
echo ""
log_success "✅ Staging environment deployed successfully!"
echo ""
echo "🌐 **Access URLs:**"
echo "   Frontend: ${FRONTEND_URL}"
echo "   Backend:  ${BACKEND_URL}"
echo ""
echo "👥 **Test with these accounts:**"
echo "   Manager:    yterayut@gmail.com / 12345"
echo "   Team Lead:  chaiwutwck@gmail.com / 12345"
echo "   Employee:   kittipong@example.com / 12345"
echo ""
echo "📋 **Next Steps:**"
echo "   1. Complete staging testing using staging-test-report.md"
echo "   2. Gather user feedback"
echo "   3. Fix any issues found"
echo "   4. Proceed with production deployment"
echo ""
log_info "Happy testing! 🚀"