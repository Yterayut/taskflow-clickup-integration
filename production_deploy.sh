#!/bin/bash

echo "🚀 TaskFlow Production Deployment Script"
echo "========================================="

# ตรวจสอบว่ามี sudo หรือไม่
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run with sudo: sudo bash production_deploy.sh"
    exit 1
fi

# 1. อัปเดต nginx configuration
echo "📝 Updating nginx configuration..."
cp taskflow_8888.nginx.conf /etc/nginx/sites-available/taskflow
rm -f /etc/nginx/sites-enabled/taskflow
ln -s /etc/nginx/sites-available/taskflow /etc/nginx/sites-enabled/taskflow

# ทดสอบ nginx config
nginx -t
if [ $? -ne 0 ]; then
    echo "❌ Nginx configuration test failed!"
    exit 1
fi

# 2. Reload nginx
echo "🔄 Reloading nginx..."
systemctl reload nginx

# 3. สร้าง directory สำหรับ logs
mkdir -p /var/log/taskflow
chown www-data:www-data /var/log/taskflow

# 4. อัปเดต frontend files
echo "📁 Updating frontend files..."
cp taskflow_new_design.html /var/www/taskflow/index.html
chown www-data:www-data /var/www/taskflow/index.html
chmod 644 /var/www/taskflow/index.html

# 5. ติดตั้ง systemd services
echo "⚙️ Installing systemd services..."
cp taskflow.service /etc/systemd/system/
cp taskflow-callback.service /etc/systemd/system/
systemctl daemon-reload

# หยุด processes ที่รันอยู่
echo "🛑 Stopping existing processes..."
pkill -f master_auth_service.js
pkill -f clickup_callback_service.js
sleep 3

# เริ่ม services
echo "🚀 Starting TaskFlow services..."
systemctl enable taskflow
systemctl enable taskflow-callback
systemctl start taskflow
systemctl start taskflow-callback

# ตรวจสอบ status
sleep 5
systemctl status taskflow --no-pager
systemctl status taskflow-callback --no-pager

echo "✅ Production deployment completed!"
echo ""
echo "🌐 Frontend: http://192.168.20.10:8888/"
echo "🔧 Backend: Running on port 7810"
echo "👤 Test login: yterayut@gmail.com / 12345"
echo ""
echo "📊 Check status:"
echo "  - Frontend: curl -I http://192.168.20.10:8888/"
echo "  - API: curl http://192.168.20.10:8888/api/v1/health"
echo "  - Backend: curl http://localhost:7810/health"