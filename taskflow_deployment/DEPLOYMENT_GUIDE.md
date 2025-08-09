# 🚀 TaskFlow Master Auth - Deployment Guide

## 📋 **Manual Deployment Steps**

### **Step 1: Copy Files to Server**
```bash
# On your local machine, copy these files to the server:
# - master_auth_service.js
# - taskflow_master_auth.html  
# - users_config.json
# - taskflow.nginx.conf
# - package.json (if exists)

# Use SCP or SFTP to copy files:
scp master_auth_service.js one-climate@192.168.20.10:/home/one-climate/team-workload/
scp taskflow_master_auth.html one-climate@192.168.20.10:/home/one-climate/team-workload/
scp users_config.json one-climate@192.168.20.10:/home/one-climate/team-workload/
scp taskflow.nginx.conf one-climate@192.168.20.10:/home/one-climate/team-workload/
```

### **Step 2: Setup Service on Server**
```bash
# SSH to server
ssh one-climate@192.168.20.10
# Password: U8@1v3z#14

# Navigate to project directory
cd /home/one-climate/team-workload

# Stop old services
pkill -f real_clickup_service.js
pkill -f hybrid_auth_service.js  
pkill -f master_auth_service.js

# Install dependencies (if needed)
npm install express cors axios

# Start Master Auth Service
nohup node master_auth_service.js > master_auth.log 2>&1 &

# Test service
curl http://localhost:781/health
```

### **Step 3: Update Nginx Configuration**
```bash
# Copy nginx config
sudo cp taskflow.nginx.conf /etc/nginx/sites-available/taskflow

# Enable site
sudo ln -sf /etc/nginx/sites-available/taskflow /etc/nginx/sites-enabled/

# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### **Step 4: Verify Deployment**
```bash
# Test service health
curl http://localhost:781/health

# Test login
curl "http://localhost:781/api/v1/auth/login" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"yterayut@gmail.com","password":"12345"}'

# Check service is running
ps aux | grep master_auth_service.js
```

---

## 📁 **Files to Deploy**

### **1. master_auth_service.js** (Backend Service)
- Port: 781
- Master authentication service
- ClickUp OAuth for yterayut@gmail.com only

### **2. taskflow_master_auth.html** (Frontend)
- Login page with user/password
- Role-based dashboard
- ClickUp setup for master user

### **3. users_config.json** (User Database)
- 11 predefined users with roles
- Password: 12345 for all users
- Role permissions defined

### **4. taskflow.nginx.conf** (Nginx Configuration)
- Frontend on port 8080
- API proxy to port 781
- Static file serving

---

## 🎯 **Testing After Deployment**

### **Access URLs:**
- **Frontend:** http://192.168.20.10:8080
- **API Health:** http://192.168.20.10:8080/health
- **Direct API:** http://192.168.20.10:781/health

### **Test Users:**
- **Manager:** yterayut@gmail.com / 12345 (Master User)
- **Team Lead:** chaiwutwck@gmail.com / 12345
- **Employee:** kittipong@example.com / 12345

### **Expected Behavior:**
1. **Login** with any user/password works immediately
2. **Master user** sees setup button if ClickUp not configured
3. **Other users** see "setup required" message until master user completes ClickUp OAuth
4. **After ClickUp setup:** All users see real ClickUp data filtered by role

---

## 🔧 **Troubleshooting**

### **Service Not Starting:**
```bash
# Check logs
tail -f /home/one-climate/team-workload/master_auth.log

# Check port usage
lsof -i :781

# Manual start with debug
node master_auth_service.js
```

### **Nginx Issues:**
```bash
# Check nginx status
sudo systemctl status nginx

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Test configuration
sudo nginx -t
```

### **File Permissions:**
```bash
# Ensure correct ownership
sudo chown -R one-climate:one-climate /home/one-climate/team-workload/

# Make service file executable
chmod +x master_auth_service.js
```

---

## 📊 **Service Information**

- **Service:** TaskFlow Master Auth Service
- **Version:** 1.0.0-master-auth
- **Port:** 781 (Backend), 8080 (Frontend)
- **Master User:** yterayut@gmail.com
- **Total Users:** 11
- **Data Source:** Real ClickUp data only (no demo/mock)
- **Authentication:** Email/Password + ClickUp OAuth (master only)

---

## ✅ **Deployment Checklist**

- [ ] Files copied to server
- [ ] Dependencies installed
- [ ] Old services stopped
- [ ] Master auth service started
- [ ] Nginx configuration updated
- [ ] Nginx reloaded
- [ ] Service health check passed
- [ ] Login test successful
- [ ] Frontend accessible at port 8080

**🎉 Deployment Complete!**