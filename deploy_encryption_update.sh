#!/bin/bash
# Deploy Token Encryption Update to Production
# Phase 1 Week 1: CRITICAL SECURITY FIX

set -e

echo "🚀 Starting Token Encryption Security Update Deployment..."
echo "📊 This is a CRITICAL SECURITY UPDATE - deploying AES-256 token encryption"

# Production server details
PROD_SERVER="one-climate@192.168.20.10"
PROD_DIR="/home/one-climate/team-workload"

echo "🔄 Step 1: Creating deployment backup..."
ssh $PROD_SERVER "cd $PROD_DIR && cp -r . ../backup_before_encryption_$(date +%Y%m%d_%H%M%S)"

echo "🔄 Step 2: Uploading new encryption service..."
scp infrastructure/adapters/TokenEncryptionService.js $PROD_SERVER:$PROD_DIR/infrastructure/adapters/

echo "🔄 Step 3: Uploading updated repository..."
scp infrastructure/repositories/PostgresClickUpTokenRepository.js $PROD_SERVER:$PROD_DIR/infrastructure/repositories/

echo "🔄 Step 4: Uploading updated backend..."
scp single_login_backend.js $PROD_SERVER:$PROD_DIR/

echo "🔄 Step 5: Uploading migration script..."
ssh $PROD_SERVER "mkdir -p $PROD_DIR/scripts"
scp scripts/encrypt_existing_tokens.js $PROD_SERVER:$PROD_DIR/scripts/

echo "🔄 Step 6: Creating .secure directory on production..."
ssh $PROD_SERVER "mkdir -p $PROD_DIR/.secure && chmod 700 $PROD_DIR/.secure"

echo "🔄 Step 7: Restarting production service..."
ssh $PROD_SERVER "cd $PROD_DIR && pm2 restart single_login_backend || node single_login_backend.js &"

echo "⏳ Waiting for service to start..."
sleep 5

echo "🔍 Step 8: Testing new encryption service..."
HEALTH_CHECK=$(curl -s http://192.168.20.10:7812/health)
echo "Health check response: $HEALTH_CHECK"

if echo "$HEALTH_CHECK" | grep -q "AES-256 token encryption"; then
    echo "✅ Encryption service deployed successfully!"
else
    echo "❌ Encryption service not detected in health check"
    exit 1
fi

echo "🔐 Step 9: Running token encryption migration..."
ssh $PROD_SERVER "cd $PROD_DIR && node scripts/encrypt_existing_tokens.js"

echo "🎉 Token Encryption Security Update completed successfully!"
echo "✅ All ClickUp tokens are now encrypted with AES-256"
echo "🛡️ Critical security vulnerability has been fixed"

echo ""
echo "📋 Next Steps:"
echo "1. Monitor system logs for any encryption errors"
echo "2. Verify all tokens are working correctly"
echo "3. Continue with Week 1 tasks: Account Lockout implementation"