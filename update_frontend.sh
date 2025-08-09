#!/bin/bash

echo "📁 Update Frontend to Enhanced Version"
echo "====================================="

# Copy enhanced dashboard (manual since sudo needed)
echo "Manual command to run:"
echo "sudo cp /home/one-climate/team-workload/taskflow_enhanced_dashboard.html /var/www/taskflow/index.html"
echo "sudo chown www-data:www-data /var/www/taskflow/index.html"
echo ""

# Test current frontend
echo "🔍 Current frontend:"
curl -s http://192.168.20.10:8888/ | head -10

echo ""
echo "✅ After manual copy, test again:"
echo "curl http://192.168.20.10:8888/"