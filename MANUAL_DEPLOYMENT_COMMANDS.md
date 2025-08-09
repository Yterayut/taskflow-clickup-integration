# 🚨 MANUAL DEPLOYMENT COMMANDS - LOGIN LOOP FIX

## SSH to Server
```bash
ssh one-climate@192.168.20.10
# Password: U8@1v3z#14
```

## 1. Check Current Nginx Config
```bash
sudo nginx -t
sudo cat /etc/nginx/sites-available/taskflow_8888
```

## 2. Backup and Update Nginx Config
```bash
# Backup current config
sudo cp /etc/nginx/sites-available/taskflow_8888 /etc/nginx/sites-available/taskflow_8888.backup.$(date +%Y%m%d_%H%M%S)

# Copy new config
sudo cp /tmp/taskflow_8888_new.nginx.conf /etc/nginx/sites-available/taskflow_8888

# Test config
sudo nginx -t

# If valid, reload
sudo systemctl reload nginx
```

## 3. Update Backend
```bash
cd /home/one-climate/team-workload

# Install dependencies
npm install

# Kill existing backend
pkill -f "single_login_backend.js"

# Start new backend
nohup node single_login_backend.js > backend_production.log 2>&1 &

# Check if running
ps aux | grep single_login_backend
```

## 4. Test System
```bash
# Test backend API
curl http://localhost:7812/api/v2/system/status

# Check nginx status
sudo systemctl status nginx
```

## 5. Verify Fix
- Frontend: http://192.168.20.10:8888/
- Login: http://192.168.20.10:8888/login
- Backend API: http://192.168.20.10:7812/api/v2/system/status

## Expected Result
✅ Login loop eliminated - all users can login successfully

---

**Files already copied to server:**
- `/home/one-climate/team-workload/single_login_backend.js` ✅
- `/home/one-climate/team-workload/package.json` ✅  
- `/tmp/taskflow_8888_new.nginx.conf` ✅

**คุณต้อง SSH เข้าไปและรันคำสั่งเหล่านี้ด้วยตนเอง**