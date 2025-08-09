#!/bin/bash
# TaskFlow Pro Background Authentication Startup Script
# Loads secure environment and starts backend with auto-refresh

echo "🚀 Starting TaskFlow Pro with Background Authentication..."

# Load secure environment variables
if [ -f ".env.secure" ]; then
    echo "🔐 Loading secure environment variables..."
    export $(cat .env.secure | xargs)
    echo "✅ Encryption key loaded"
else
    echo "⚠️ No .env.secure file found - using fallback key generation"
fi

# Ensure secure directory exists
mkdir -p .secure
chmod 700 .secure

echo "🔄 Starting backend with background authentication..."

# Stop any existing backend process
pkill -f "single_login_backend_with_sync.js" 2>/dev/null || true

# Start backend with environment variables
SECURE_STORAGE_DIR=./.secure \
NODE_ENV=production \
nohup node single_login_backend_with_sync.js > logs/background_auth.log 2>&1 &

echo "✅ Backend started with background authentication"
echo "📝 Logs: tail -f logs/background_auth.log"
echo "🌐 Health check: curl http://192.168.20.10:7812/health"
echo "🔐 Background auth status: curl http://192.168.20.10:7812/api/v2/background-auth/status"