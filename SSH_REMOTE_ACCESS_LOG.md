# 🔐 SSH Remote Access Guide & Log

**Updated**: 2025-06-17 11:16:00  
**Server**: one-climate@192.168.20.10  
**Purpose**: Team-Workload TaskFlow System Management  

---

## 📋 **SSH Connection Information**

### **Primary SSH Connection**
```bash
# Standard SSH connection
ssh one-climate@192.168.20.10

# With password authentication using sshpass (recommended for automation)
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10

# SSH with timeout for scripts
sshpass -p "U8@1v3z#14" ssh -o ConnectTimeout=10 one-climate@192.168.20.10
```

### **Server Credentials**
- **Username**: `one-climate`
- **Password**: `U8@1v3z#14`
- **Server IP**: `192.168.20.10`
- **OS**: Ubuntu 22.04 LTS

---

## 🛠️ **Common SSH Commands for TaskFlow Management**

### **Service Management**
```bash
# Check all services status
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'systemctl status taskflow-*'

# Restart specific service with sudo
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'echo "U8@1v3z#14" | sudo -S systemctl restart taskflow-backend'

# Start all services
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'echo "U8@1v3z#14" | sudo -S systemctl start taskflow-*'

# Enable auto-start
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'echo "U8@1v3z#14" | sudo -S systemctl enable taskflow-backend'
```

### **Port Connectivity Tests**
```bash
# Test specific port connectivity
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'timeout 3 bash -c "</dev/tcp/127.0.0.1/777" 2>/dev/null && echo "Port 777: Connected" || echo "Port 777: Failed"'

# Check all TaskFlow ports
for port in 555 666 777 6777 27777; do
    echo "Testing port $port:"
    sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 "timeout 3 bash -c '</dev/tcp/127.0.0.1/$port' 2>/dev/null && echo 'Connected' || echo 'Failed'"
done
```

### **Process Management**
```bash
# Find process using specific port
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'echo "U8@1v3z#14" | sudo -S netstat -tlnp | grep :777'

# Kill process by PID
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'echo "U8@1v3z#14" | sudo -S kill -9 PID_NUMBER'

# Kill all Node.js processes (use with caution)
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'echo "U8@1v3z#14" | sudo -S killall node'
```

### **File Operations**
```bash
# Check directory contents
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'ls -la ~/team-workload'

# Edit file remotely
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'nano ~/team-workload/backend.js'

# Copy file to server
sshpass -p "U8@1v3z#14" scp localfile.txt one-climate@192.168.20.10:~/team-workload/
```

---

## 🔧 **Troubleshooting SSH Issues**

### **Common Problems & Solutions**

#### **1. Permission Denied (publickey,password)**
```bash
# Solution: Use sshpass for password authentication
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10

# Alternative: Disable strict host key checking for scripts
sshpass -p "U8@1v3z#14" ssh -o StrictHostKeyChecking=no one-climate@192.168.20.10
```

#### **2. Connection Timeout**
```bash
# Solution: Add timeout options
sshpass -p "U8@1v3z#14" ssh -o ConnectTimeout=10 -o ServerAliveInterval=30 one-climate@192.168.20.10
```

#### **3. Sudo Password Issues**
```bash
# Solution: Pipe sudo password correctly
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'echo "U8@1v3z#14" | sudo -S command'

# For commands that need stdin
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'echo "U8@1v3z#14" | sudo -S -i command'
```

---

## 📊 **TaskFlow Specific SSH Commands**

### **Service Health Check**
```bash
# Complete health check
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'cd ~/team-workload && ./health-check.sh'

# Quick service check
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'systemctl is-active taskflow-backend taskflow-redis taskflow-frontend'
```

### **ClickUp Integration Management**
```bash
# Check backend with ClickUp features
curl -s http://192.168.20.10:777/health | jq '.features'

# Test OAuth endpoint
curl -I http://192.168.20.10:777/api/v1/auth/clickup/authorize

# Check environment variables
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'echo "U8@1v3z#14" | sudo -S cat ~/team-workload/.env'
```

### **Log Monitoring**
```bash
# Monitor backend logs
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'echo "U8@1v3z#14" | sudo -S journalctl -u taskflow-backend -f'

# Check system logs
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'echo "U8@1v3z#14" | sudo -S tail -f /var/log/syslog | grep taskflow'
```

---

## 🔐 **Security Best Practices**

### **Password Management**
- Store passwords in environment variables when possible
- Use SSH keys instead of passwords for production
- Rotate passwords regularly
- Limit SSH access to specific IPs

### **Connection Security**
```bash
# Use SSH keys (recommended for production)
ssh-keygen -t rsa -b 4096 -C "taskflow-management"
ssh-copy-id one-climate@192.168.20.10

# Then connect without password:
ssh one-climate@192.168.20.10
```

---

## 📋 **SSH Connection Log**

### **2025-06-17 Session**
- **11:11:00**: Initial connection test - ✅ SUCCESS
- **11:12:00**: Service restart attempts - ⚠️ PARTIAL (Redis timeout)
- **11:13:00**: Manual Redis restart - ✅ SUCCESS  
- **11:14:00**: Backend port binding issue resolved - ✅ SUCCESS
- **11:15:00**: Final verification - ✅ ALL SERVICES OPERATIONAL

### **Connection Status**
- **SSH Access**: ✅ Working with sshpass
- **Sudo Access**: ✅ Password authentication working
- **Port Access**: ✅ All TaskFlow ports accessible
- **File Access**: ✅ Read/write permissions confirmed

---

## 🎯 **Quick Reference Commands**

### **One-Line Service Restart**
```bash
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'echo "U8@1v3z#14" | sudo -S systemctl restart taskflow-backend taskflow-redis'
```

### **Complete System Check**
```bash
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'cd ~/team-workload && ./status.sh'
```

### **Emergency Service Recovery**
```bash
# Kill stuck processes and restart
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'echo "U8@1v3z#14" | sudo -S killall -9 node redis-server && sudo systemctl restart taskflow-*'
```

---

**💡 Pro Tips:**
1. Always use `sshpass` for automated scripts
2. Include timeouts for connection commands
3. Pipe sudo password with `echo "password" | sudo -S`
4. Test connections before running complex operations
5. Keep this log updated with new procedures

**🔄 Last Updated**: 2025-06-17 11:16:00 - All SSH procedures verified working