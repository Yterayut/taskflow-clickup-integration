# 📝 TaskFlow Deployment Memory

## 🎯 Current Configuration (2025-06-21)

### **Production URLs**
- **Frontend**: http://192.168.20.10:556 (nginx)
- **Backend**: http://192.168.20.10:777 (node.js)
- **Server**: one-climate@192.168.20.10 (password: U8@1v3z#14)

### **File Locations**
```
Remote Server:
├── /home/one-climate/team-workload/     # Source code
├── /var/www/taskflow/                   # Frontend serving directory
├── /etc/nginx/sites-available/taskflow # Nginx config
├── /etc/nginx/sites-enabled/taskflow   # Nginx symlink
└── ~/team-workload/deploy-update.sh    # Deployment script
```

### **Key Changes Made**
1. **Port Configuration**: Frontend moved from 555 → 556 (port conflict)
2. **File Serving**: Frontend files copied to /var/www/taskflow/ (permission fix)
3. **Nginx Config**: Updated to serve from /var/www/taskflow
4. **Ownership**: All files chowned to www-data:www-data

### **Deployment Commands**
```bash
# Quick deployment update
sshpass -p 'U8@1v3z#14' ssh one-climate@192.168.20.10 '~/team-workload/deploy-update.sh'

# Manual sync frontend
sshpass -p 'U8@1v3z#14' ssh one-climate@192.168.20.10 'echo "U8@1v3z#14" | sudo -S rsync -av ~/team-workload/public/ /var/www/taskflow/ && echo "U8@1v3z#14" | sudo -S chown -R www-data:www-data /var/www/taskflow'

# Restart backend
sshpass -p 'U8@1v3z#14' ssh one-climate@192.168.20.10 'pkill -f "node.*backend" && cd ~/team-workload && nohup node backend.js > backend.log 2>&1 &'

# Reload nginx
sshpass -p 'U8@1v3z#14' ssh one-climate@192.168.20.10 'echo "U8@1v3z#14" | sudo -S systemctl reload nginx'
```

### **OAuth Configuration**
```
Client ID: DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL
Client Secret: BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX
Redirect URI: http://192.168.20.10:777/api/v1/auth/clickup/callback
```

### **Status Check Commands**
```bash
# Check all services
curl -I http://192.168.20.10:556  # Frontend (should be 200)
curl -s http://192.168.20.10:777/health  # Backend health
sshpass -p 'U8@1v3z#14' ssh one-climate@192.168.20.10 'ps aux | grep -E "(node.*backend|nginx)"'
```

### **Common Issues & Solutions**
1. **502 Bad Gateway**: Backend not running → restart backend
2. **Permission Denied**: Files not in /var/www/taskflow → run rsync
3. **Port Conflict**: Use port 556 instead of 555
4. **OAuth Fails**: Check redirect URI and backend status

### **Files to Sync on Updates**
- `public/index.html` → `/var/www/taskflow/index.html`
- `taskflow.nginx.conf` → `/etc/nginx/sites-available/taskflow`
- `backend.js` → restart backend service
- `package.json` → npm install if dependencies changed

## ✅ Current Status: PRODUCTION READY
- OAuth flow: ✅ Working
- Frontend: ✅ Port 556
- Backend: ✅ Port 777  
- Nginx: ✅ Configured
- Permissions: ✅ Fixed