#!/bin/bash

LOCAL_PATH="/Users/teerayutyeerahem/team-workload/"
REMOTE_USER="one-climate"
REMOTE_HOST="192.168.20.10"
REMOTE_PATH="/home/one-climate/team-workload/"

echo "🚀 เริ่ม Deploy..."
rsync -avz --delete "$LOCAL_PATH" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"
echo "✅ Deploy เสร็จสมบูรณ์"

