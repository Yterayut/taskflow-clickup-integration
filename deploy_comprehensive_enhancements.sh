#!/bin/bash

# TaskFlow Pro - Comprehensive Enhancements Deployment Script
# This script deploys all the enhanced features to the production server

echo "🚀 TaskFlow Pro - Comprehensive Enhancements Deployment"
echo "=================================================="
echo ""

# Configuration
SERVER_USER="one-climate"
SERVER_HOST="192.168.20.10"
SERVER_PASSWORD="U8@1v3z#14"
SERVER_PATH="/home/one-climate/team-workload"

echo "📋 Deployment Configuration:"
echo "  Server: $SERVER_USER@$SERVER_HOST"
echo "  Path: $SERVER_PATH"
echo "  Enhanced Features: Employee Management, Dark Mode, Auto-Updates, etc."
echo ""

# Function to run SSH commands
run_ssh_command() {
    sshpass -p "$SERVER_PASSWORD" ssh "$SERVER_USER@$SERVER_HOST" "$1"
}

# Function to copy files to server
copy_to_server() {
    sshpass -p "$SERVER_PASSWORD" scp "$1" "$SERVER_USER@$SERVER_HOST:$2"
}

echo "🛑 Step 1: Stopping existing services..."
run_ssh_command "cd $SERVER_PATH && pkill -f backend"
sleep 2

echo "📁 Step 2: Backing up current files..."
run_ssh_command "cd $SERVER_PATH && cp backend_comprehensive_clickup.js backend_comprehensive_clickup.js.backup.$(date +%Y%m%d_%H%M%S)"
run_ssh_command "cd $SERVER_PATH && cp index.html index.html.backup.$(date +%Y%m%d_%H%M%S)"

echo "📤 Step 3: Uploading enhanced backend..."
copy_to_server "backend_comprehensive_enhanced.js" "$SERVER_PATH/backend_comprehensive_enhanced.js"

echo "📤 Step 4: Uploading enhanced frontend..."
copy_to_server "public/index_comprehensive.html" "$SERVER_PATH/index_comprehensive.html"

echo "🔧 Step 5: Installing dependencies..."
run_ssh_command "cd $SERVER_PATH && npm install"

echo "🔧 Step 6: Starting enhanced backend service..."
run_ssh_command "cd $SERVER_PATH && nohup node backend_comprehensive_enhanced.js > backend_enhanced.log 2>&1 &"

echo "⏳ Step 7: Waiting for service to start..."
sleep 5

echo "🔍 Step 8: Testing backend health..."
HEALTH_CHECK=$(run_ssh_command "curl -s http://localhost:777/health | grep -o '\"status\":\"OK\"' || echo 'FAILED'")

if [[ $HEALTH_CHECK == *"OK"* ]]; then
    echo "✅ Backend health check: PASSED"
else
    echo "❌ Backend health check: FAILED"
    echo "📋 Checking logs..."
    run_ssh_command "cd $SERVER_PATH && tail -20 backend_enhanced.log"
    exit 1
fi

echo "🌐 Step 9: Setting up frontend access..."
run_ssh_command "cd $SERVER_PATH && cp index_comprehensive.html index.html"

echo "🔍 Step 10: Testing frontend access..."
FRONTEND_CHECK=$(run_ssh_command "curl -s -o /dev/null -w '%{http_code}' http://localhost:8888")

if [[ $FRONTEND_CHECK == "200" ]]; then
    echo "✅ Frontend access check: PASSED"
else
    echo "❌ Frontend access check: FAILED (HTTP $FRONTEND_CHECK)"
fi

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "=================================================="
echo ""
echo "📊 Enhanced Features Deployed:"
echo "  ✅ Employee Management - Add/Edit users with ClickUp integration"
echo "  ✅ Dark Mode Support - All roles and UI components"
echo "  ✅ Fully Functional Components - Click/view/edit capabilities"
echo "  ✅ Ranking & Scoring - Performance metrics for all roles"
echo "  ✅ Team Leader Tasks - My Tasks with add/edit functionality"
echo "  ✅ English Interface - Complete system in English"
echo "  ✅ Auto & Manual Updates - 30-minute auto-refresh + manual trigger"
echo ""
echo "🔗 Access URLs:"
echo "  📊 Frontend: http://192.168.20.10:8888"
echo "  🔧 Backend API: http://192.168.20.10:777"
echo "  🚀 ClickUp OAuth: http://192.168.20.10:777/auth/clickup"
echo "  ❤️  Health Check: http://192.168.20.10:777/health"
echo ""
echo "📋 New API Endpoints:"
echo "  👥 Employees: /api/v1/employees (GET, POST, PUT, DELETE)"
echo "  📋 Tasks: /api/v1/tasks (GET, POST, PUT, DELETE)"
echo "  🔄 Manual Update: /api/v1/trigger-update (POST)"
echo ""
echo "🎯 Key Features:"
echo "  • Role-based navigation (Manager, Team Lead, Employee)"
echo "  • Employee management with CRUD operations"
echo "  • Task creation and management"
echo "  • Auto-update every 30 minutes"
echo "  • Manual update capability"
echo "  • Dark mode for all components"
echo "  • Performance ranking and scoring"
echo "  • Comprehensive ClickUp integration"
echo ""
echo "🔧 Troubleshooting:"
echo "  📋 Backend Logs: ssh $SERVER_USER@$SERVER_HOST 'tail -f $SERVER_PATH/backend_enhanced.log'"
echo "  🔍 Service Status: ssh $SERVER_USER@$SERVER_HOST 'ps aux | grep backend'"
echo "  🔄 Restart Service: ssh $SERVER_USER@$SERVER_HOST 'cd $SERVER_PATH && pkill -f backend && nohup node backend_comprehensive_enhanced.js > backend_enhanced.log 2>&1 &'"
echo ""
echo "💡 Next Steps:"
echo "  1. Connect ClickUp account: http://192.168.20.10:777/auth/clickup"
echo "  2. Test employee management features"
echo "  3. Test task creation and assignment"
echo "  4. Verify auto-update functionality"
echo "  5. Test dark mode across all roles"
echo ""
echo "🎉 TaskFlow Pro Enhanced - Ready for Production Use!"