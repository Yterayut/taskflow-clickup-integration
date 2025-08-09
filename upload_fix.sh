#!/bin/bash

echo "🚀 อัปโหลดไฟล์ที่แก้ไขแล้ว..."

# Use cat and SSH to directly update the file
cat public/index.html | ssh one-climate@192.168.20.10 "cat > ~/team-workload/public/index.html"

echo "✅ อัปโหลดเสร็จสิ้น"

# Restart frontend service
ssh one-climate@192.168.20.10 "sudo systemctl restart taskflow-frontend"

echo "🔄 รีสตาร์ทบริการเสร็จสิ้น"

# Test if it works
curl -s http://192.168.20.10:555 | head -c 100
echo ""
echo "✅ ทดสอบการเข้าถึงเสร็จสิ้น"