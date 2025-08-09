#!/bin/bash

echo "🎯 Deploy Role-Based TaskFlow Dashboard"
echo "======================================"

# Upload role-based dashboard
echo "📤 Step 1: Uploading role-based dashboard..."
scp taskflow_role_based_dashboard.html one-climate@192.168.20.10:/home/one-climate/team-workload/

# Update frontend on remote server
echo "📁 Step 2: Updating frontend..."
ssh one-climate@192.168.20.10 'echo "12345" | sudo -S cp /home/one-climate/team-workload/taskflow_role_based_dashboard.html /var/www/taskflow/index.html && echo "12345" | sudo -S chown www-data:www-data /var/www/taskflow/index.html'

# Test the deployment
echo "✅ Step 3: Testing deployment..."
echo "Frontend Test:"
ssh one-climate@192.168.20.10 'curl -s http://192.168.20.10:8888/ | head -10'

echo ""
echo "Services Status:"
ssh one-climate@192.168.20.10 'curl -s http://localhost:777/health | jq .'
ssh one-climate@192.168.20.10 'curl -s http://localhost:7810/health | jq .'

echo ""
echo "🎉 Role-Based Dashboard Deployed!"
echo "================================="
echo "🌐 Frontend: http://192.168.20.10:8888/"
echo ""
echo "👤 Login Accounts:"
echo "   Manager: yterayut@gmail.com / 12345"
echo "   Team Lead: chaiwutwck@gmail.com / 12345"
echo "   Employee: kittipong@example.com / 12345"
echo ""
echo "🎯 Role-Based Features:"
echo "   📊 Manager: Full dashboard with all features"
echo "   👥 Team Lead: Team-focused dashboard"
echo "   📋 Employee: Personal dashboard with limited access"
echo ""
echo "🚀 New Navigation Structure:"
echo "   ✅ Dynamic menus based on user role"
echo "   ✅ Role-specific KPIs and content"
echo "   ✅ Proper access control"