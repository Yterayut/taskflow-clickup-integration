#!/bin/bash
# TaskFlow Pro - Refactored System Deployment Script

echo "🚀 Deploying TaskFlow Pro Refactored System..."

# Deploy unified components
echo "📦 Deploying unified components..."
scp unified_security_framework.js one-climate@192.168.20.10:/home/one-climate/team-workload/
scp unified_performance_engine.js one-climate@192.168.20.10:/home/one-climate/team-workload/
scp unified_monitoring_system.js one-climate@192.168.20.10:/home/one-climate/team-workload/
scp unified_frontend_optimizations.js one-climate@192.168.20.10:/home/one-climate/team-workload/
scp taskflow_master_controller.js one-climate@192.168.20.10:/home/one-climate/team-workload/

# Deploy documentation
echo "📚 Deploying documentation..."
scp REFACTORED_SYSTEM_README.md one-climate@192.168.20.10:/home/one-climate/team-workload/

echo "✅ Deployment completed!"
echo "🎯 Next steps:"
echo "   1. SSH to server: ssh one-climate@192.168.20.10"
echo "   2. Navigate to: cd /home/one-climate/team-workload"
echo "   3. Initialize system: node taskflow_master_controller.js"