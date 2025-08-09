# 🖥️ Terminal Commands Reference

## TaskFlow Development & Deployment Commands

### **Project Setup**
```bash
cd /Users/teerayutyeerahem/team-workload
```

### **Development**
```bash
# Start backend
node backend.js
npm run dev

# Start frontend  
python3 -m http.server 8000 --directory public

# Test API
curl http://192.168.20.10:777/api/v1/test/clickup-data
```

### **Deployment**
```bash
# Deploy to production
scp public/index.html one-climate@192.168.20.10:~/team-workload/public/

# Restart services
sudo systemctl restart nginx
sudo systemctl restart taskflow-backend
```

### **Monitoring**
```bash
# Check services
systemctl status nginx
systemctl status taskflow-backend

# Check logs
tail -f /var/log/nginx/access.log
journalctl -u taskflow-backend -f
```

### **Testing**
```bash
# Test frontend
curl http://192.168.20.10:555/

# Test backend API  
curl http://192.168.20.10:777/health

# Test real data
curl http://192.168.20.10:777/api/v1/test/clickup-data | jq
```

*Quick reference for TaskFlow operations*