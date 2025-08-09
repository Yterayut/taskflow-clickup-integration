#!/bin/bash
# Start backend with complete environment variables

cd /home/one-climate/team-workload

# Kill existing processes
pkill -f single_login_backend
pkill -f master_auth_service

# Wait for processes to terminate
sleep 2

# Start with explicit environment variables
JWT_SECRET='taskflow_pro_jwt_secret_2025_secure_key_v2.1' \
DB_HOST='localhost' \
DB_USER='taskflow_user' \
DB_NAME='taskflow_pro' \
DB_PASSWORD='TaskFlow2025Secure' \
CLICKUP_CLIENT_ID='F9M7XRHB7T6Q78ZVL5077IT2HM89KTK5' \
CLICKUP_CLIENT_SECRET='TQ1U9MFFTFFMGLGJ8MEVN5MKTGQR7Y33XVQDZ4KSQJ1K' \
CLICKUP_REDIRECT_URI='http://192.168.20.10:7812/auth/clickup/callback' \
MASTER_USER_EMAIL='yterayut@gmail.com' \
nohup node single_login_backend.js > auth_backend.log 2>&1 &

echo "Backend started with complete environment variables"
echo "Process ID: $!"
sleep 3
echo "Health check:"
curl -s http://192.168.20.10:7812/health | jq .status