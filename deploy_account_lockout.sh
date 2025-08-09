#!/bin/bash
# Deploy Account Lockout Security Update
# Phase 1 Week 1 Task 2: Account Security Implementation

set -e

echo "🛡️ Starting Account Lockout Security Update Deployment..."
echo "📊 This implements brute force protection with account lockout"

# Production server details
PROD_SERVER="one-climate@192.168.20.10"
PROD_DIR="/home/one-climate/team-workload"

echo "🔄 Step 1: Creating deployment backup..."
ssh $PROD_SERVER "cd $PROD_DIR && cp single_login_backend.js backup_before_lockout_$(date +%Y%m%d_%H%M%S).js"

echo "🔄 Step 2: Uploading AccountSecurityService..."
scp infrastructure/adapters/AccountSecurityService.js $PROD_SERVER:$PROD_DIR/infrastructure/adapters/

echo "🔄 Step 3: Uploading updated AuthenticationService..."
scp application/services/AuthenticationService.js $PROD_SERVER:$PROD_DIR/application/services/

echo "🔄 Step 4: Uploading security routes..."
scp api/routes/securityRoutes.js $PROD_SERVER:$PROD_DIR/api/routes/
scp api/routes/singleAuthRoutes.js $PROD_SERVER:$PROD_DIR/api/routes/

echo "🔄 Step 5: Uploading updated backend..."
scp single_login_backend.js $PROD_SERVER:$PROD_DIR/

echo "🔄 Step 6: Running database migration..."
ssh $PROD_SERVER "cd $PROD_DIR && psql -h 192.168.20.10 -U teamworkflow -d team_workload -f database/add_user_security_table.sql"

echo "🔄 Step 7: Restarting production service..."
ssh $PROD_SERVER "cd $PROD_DIR && pkill -f single_login_backend && sleep 3 && nohup node single_login_backend_with_sync.js > lockout_deploy.log 2>&1 &"

echo "⏳ Waiting for service to start..."
sleep 8

echo "🔍 Step 8: Testing account lockout service..."
HEALTH_CHECK=$(curl -s http://192.168.20.10:7812/api/v2/security/health)
echo "Security health check: $HEALTH_CHECK"

if echo "$HEALTH_CHECK" | grep -q '"success":true'; then
    echo "✅ Account lockout service deployed successfully!"
else
    echo "❌ Account lockout service not responding correctly"
    exit 1
fi

echo "🔍 Step 9: Testing general health..."
MAIN_HEALTH=$(curl -s http://192.168.20.10:7812/health | jq -r '.features[]' | grep -c "AES-256")
if [ "$MAIN_HEALTH" -gt 0 ]; then
    echo "✅ Main service health check passed"
else
    echo "❌ Main service health check failed"
    exit 1
fi

echo "🎉 Account Lockout Security Update completed successfully!"
echo "🛡️ Brute force protection is now active"
echo "📋 Configuration:"
echo "   - Max failed attempts: 5"
echo "   - Lockout duration: 15 minutes"
echo "   - CAPTCHA threshold: 3 attempts"

echo ""
echo "📋 Next Steps:"
echo "1. Test failed login scenarios"
echo "2. Verify lockout behavior"
echo "3. Continue with Week 2 tasks: Audit Logging implementation"