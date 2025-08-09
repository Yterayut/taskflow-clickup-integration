#!/bin/bash
# TaskFlow Pro Monitoring System Deployment Script

echo "🚀 Deploying TaskFlow Pro Monitoring System..."

# Deploy monitoring components
scp system_metrics_collector.js one-climate@192.168.20.10:/home/one-climate/team-workload/
scp performance_monitor.js one-climate@192.168.20.10:/home/one-climate/team-workload/
scp health_checker.js one-climate@192.168.20.10:/home/one-climate/team-workload/
scp alert_manager.js one-climate@192.168.20.10:/home/one-climate/team-workload/
scp alert_rules.js one-climate@192.168.20.10:/home/one-climate/team-workload/
scp notification_system.js one-climate@192.168.20.10:/home/one-climate/team-workload/

# Deploy API and configuration
scp metrics_api.js one-climate@192.168.20.10:/home/one-climate/team-workload/
scp monitoring_config.json one-climate@192.168.20.10:/home/one-climate/team-workload/

# Deploy dashboard to web directory
ssh one-climate@192.168.20.10 "sudo cp /home/one-climate/team-workload/monitoring_dashboard.html /var/www/taskflow/"

echo "✅ Monitoring system deployed successfully"
echo "📊 Dashboard available at: http://192.168.20.10:8888/monitoring_dashboard.html"