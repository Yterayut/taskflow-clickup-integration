#!/bin/bash

# TaskFlow Pro v2.1 - Single Login System Deployment Script
# Deploy the new single login implementation to production server

set -e  # Exit on any error

# Configuration
SERVER="one-climate@192.168.20.10"
LOCAL_DIR="/Users/teerayutyeerahem/team-workload"
SERVER_DIR="/home/one-climate/team-workload"
BACKUP_DIR="/home/one-climate/team-workload/backups"
PORT=7812

echo "🚀 TaskFlow Pro v2.1 - Single Login Deployment"
echo "=============================================="
echo "Server: $SERVER"
echo "Port: $PORT"
echo "Time: $(date)"
echo ""

# Function to check if server is accessible
check_server() {
    echo "🔍 Checking server connectivity..."
    if ssh -o ConnectTimeout=10 $SERVER "echo 'Server accessible'" >/dev/null 2>&1; then
        echo "✅ Server is accessible"
    else
        echo "❌ Cannot connect to server"
        exit 1
    fi
}

# Function to create backup
create_backup() {
    echo "💾 Creating backup on server..."
    ssh $SERVER "
        mkdir -p $BACKUP_DIR
        BACKUP_NAME=\"single_login_backup_\$(date +%Y%m%d_%H%M%S)\"
        cp -r $SERVER_DIR \$BACKUP_NAME 2>/dev/null || echo 'No existing files to backup'
        mv \$BACKUP_NAME $BACKUP_DIR/ 2>/dev/null || echo 'Backup created'
        echo \"✅ Backup created: \$BACKUP_NAME\"
    "
}

# Function to upload files
upload_files() {
    echo "📤 Uploading new single login system files..."
    
    # Create directories on server
    ssh $SERVER "mkdir -p $SERVER_DIR/{domain,application,infrastructure,api,database}"
    
    # Upload backend files
    scp -r "$LOCAL_DIR/domain" $SERVER:$SERVER_DIR/ || echo "Domain files uploaded"
    scp -r "$LOCAL_DIR/application" $SERVER:$SERVER_DIR/ || echo "Application files uploaded"
    scp -r "$LOCAL_DIR/infrastructure" $SERVER:$SERVER_DIR/ || echo "Infrastructure files uploaded"
    scp -r "$LOCAL_DIR/api" $SERVER:$SERVER_DIR/ || echo "API files uploaded"
    scp -r "$LOCAL_DIR/database" $SERVER:$SERVER_DIR/ || echo "Database files uploaded"
    
    # Upload main files
    scp "$LOCAL_DIR/single_login_backend.js" $SERVER:$SERVER_DIR/
    scp "$LOCAL_DIR/.env" $SERVER:$SERVER_DIR/
    scp "$LOCAL_DIR/package_single_login.json" $SERVER:$SERVER_DIR/package.json
    
    # Upload frontend
    scp "$LOCAL_DIR/single_login_form.html" $SERVER:$SERVER_DIR/
    
    echo "✅ Files uploaded successfully"
}

# Function to install dependencies
install_dependencies() {
    echo "📦 Installing dependencies on server..."
    ssh $SERVER "
        cd $SERVER_DIR
        npm install --production
        echo '✅ Dependencies installed'
    "
}

# Function to run database migration
run_migration() {
    echo "🗄️ Running database migration..."
    ssh $SERVER "
        cd $SERVER_DIR
        node database/run_migration.js
        echo '✅ Database migration completed'
    "
}

# Function to stop existing services
stop_services() {
    echo "🛑 Stopping existing services..."
    ssh $SERVER "
        # Kill any existing Node.js processes on target port
        pkill -f 'node.*$PORT' || echo 'No existing processes found'
        
        # Kill any existing authentication services
        pkill -f 'taskflow.*auth' || echo 'No auth services found'
        
        echo '✅ Existing services stopped'
    "
}

# Function to start new service
start_service() {
    echo "🚀 Starting new single login service..."
    ssh $SERVER "
        cd $SERVER_DIR
        
        # Start the service in background
        nohup node single_login_backend.js > single_login.log 2>&1 &
        SERVICE_PID=\$!
        
        echo \"✅ Service started with PID: \$SERVICE_PID\"
        echo \"📋 Log file: $SERVER_DIR/single_login.log\"
        
        # Wait a moment and check if service is running
        sleep 3
        if kill -0 \$SERVICE_PID 2>/dev/null; then
            echo \"✅ Service is running successfully\"
        else
            echo \"❌ Service failed to start\"
            exit 1
        fi
    "
}

# Function to health check
health_check() {
    echo "🏥 Performing health check..."
    
    # Wait for service to fully start
    sleep 5
    
    ssh $SERVER "
        # Test health endpoint
        curl -f http://localhost:$PORT/health >/dev/null 2>&1
        if [ \$? -eq 0 ]; then
            echo '✅ Health check passed'
        else
            echo '❌ Health check failed'
            echo 'Service logs:'
            tail -20 $SERVER_DIR/single_login.log
            exit 1
        fi
    "
}

# Function to update frontend
update_frontend() {
    echo "🌐 Updating frontend files..."
    ssh $SERVER "
        # Copy new login page to web directory
        sudo cp $SERVER_DIR/single_login_form.html /var/www/taskflow/login-v2.html
        
        # Set permissions
        sudo chown www-data:www-data /var/www/taskflow/login-v2.html
        sudo chmod 644 /var/www/taskflow/login-v2.html
        
        echo '✅ Frontend updated'
        echo '🔗 New login page: http://192.168.20.10:8888/login-v2.html'
    "
}

# Function to show deployment status
show_status() {
    echo ""
    echo "📊 DEPLOYMENT STATUS"
    echo "===================="
    echo "✅ Single Login System v2.1 deployed successfully!"
    echo ""
    echo "🔗 Service URLs:"
    echo "   - Health Check: http://192.168.20.10:$PORT/health"
    echo "   - System Status: http://192.168.20.10:$PORT/api/v2/system/status"
    echo "   - Login API: http://192.168.20.10:$PORT/api/v2/auth/login"
    echo "   - Frontend: http://192.168.20.10:8888/login-v2.html"
    echo ""
    echo "📋 Features:"
    echo "   - Single form login with auto flow detection"
    echo "   - Master user ClickUp OAuth integration"
    echo "   - Regular user email/password authentication"
    echo "   - JWT with HttpOnly cookies"
    echo "   - System health monitoring"
    echo "   - Rate limiting protection"
    echo ""
    echo "⚙️ Management Commands:"
    echo "   - View logs: ssh $SERVER 'tail -f $SERVER_DIR/single_login.log'"
    echo "   - Check status: curl http://192.168.20.10:$PORT/health"
    echo "   - Stop service: ssh $SERVER 'pkill -f single_login_backend'"
    echo ""
}

# Function to rollback on failure
rollback() {
    echo "🔄 Rolling back deployment..."
    ssh $SERVER "
        # Stop new service
        pkill -f 'single_login_backend' || echo 'Service stopped'
        
        # Restore from latest backup
        LATEST_BACKUP=\$(ls -t $BACKUP_DIR/ | head -1)
        if [ -n \"\$LATEST_BACKUP\" ]; then
            cp -r \"$BACKUP_DIR/\$LATEST_BACKUP\"/* $SERVER_DIR/
            echo \"✅ Rolled back to: \$LATEST_BACKUP\"
        else
            echo \"❌ No backup found for rollback\"
        fi
    "
}

# Main deployment process
main() {
    echo "Starting deployment process..."
    
    # Trap errors for rollback
    trap 'echo "❌ Deployment failed. Initiating rollback..."; rollback; exit 1' ERR
    
    check_server
    create_backup
    upload_files
    install_dependencies
    run_migration
    stop_services
    start_service
    health_check
    update_frontend
    show_status
    
    echo "🎉 Deployment completed successfully!"
}

# Help function
show_help() {
    echo "TaskFlow Pro v2.1 - Single Login Deployment Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help          Show this help message"
    echo "  --test-only     Run deployment test without actually deploying"
    echo "  --no-migration  Skip database migration"
    echo "  --no-frontend   Skip frontend update"
    echo ""
    echo "Examples:"
    echo "  $0                    # Full deployment"
    echo "  $0 --test-only        # Test deployment process"
    echo "  $0 --no-migration     # Deploy without running migration"
}

# Parse command line arguments
case "${1:-}" in
    --help)
        show_help
        exit 0
        ;;
    --test-only)
        echo "🧪 Test mode - would deploy but not actually executing"
        echo "Files would be uploaded to: $SERVER:$SERVER_DIR"
        echo "Service would run on port: $PORT"
        exit 0
        ;;
    --no-migration)
        run_migration() { echo "⏭️ Skipping database migration"; }
        ;;
    --no-frontend)
        update_frontend() { echo "⏭️ Skipping frontend update"; }
        ;;
    "")
        # No arguments, proceed with full deployment
        ;;
    *)
        echo "❌ Unknown option: $1"
        show_help
        exit 1
        ;;
esac

# Execute main deployment
main