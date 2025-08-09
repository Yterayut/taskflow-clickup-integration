# TaskFlow Pro - Context Handover Template

## 🎯 สำหรับ Context ใหม่: ใช้ Template นี้เพื่อเริ่มงานต่อเนื่อง

### 📋 การเริ่มต้น Context ใหม่

Copy message ด้านล่างนี้ส่งไปยัง Claude ใน context ใหม่:

```
ฉันต้องการต่อพัฒนา TaskFlow Pro จาก context ก่อนหน้า

โปรดทำตามขั้นตอนนี้เพื่อให้ทำงานต่อเนื่อง:

1. อ่านไฟล์ memory: /Users/teerayutyeerahem/CLAUDE.md 
2. ตรวจสอบ project status: /Users/teerayutyeerahem/team-workload/project_status.json
3. รัน health check: /Users/teerayutyeerahem/team-workload/check_system_status.sh
4. สรุปสถานะปัจจุบันของโปรเจค

หลังจากนั้นแจ้งให้ฉันทราบ:
- สถานะระบบปัจจุบัน
- checkpoint ล่าสุด
- features ที่ complete แล้ว
- จุดที่พร้อมพัฒนาต่อ

ระบบปัจจุบัน:
- Production URL: http://192.168.20.10:8888/
- Backend API: http://192.168.20.10:7810/
- Latest checkpoint: after_feature_Team_Attendance_tested
- Working directory: /Users/teerayutyeerahem/team-workload/
```

---

## 🛠️ ขั้นตอนสำหรับ Claude ที่รับ Context ใหม่

### Step 1: อ่าน Project Memory
```bash
# อ่านไฟล์หลัก
cat /Users/teerayutyeerahem/CLAUDE.md

# อ่าน status JSON
cat /Users/teerayutyeerahem/team-workload/project_status.json
```

### Step 2: ตรวจสอบระบบ
```bash
# รัน health check
cd /Users/teerayutyeerahem/team-workload/
./check_system_status.sh
```

### Step 3: ตรวจสอบ checkpoint
```bash
# ดู checkpoint ที่มี
./list_checkpoints.sh

# ดู checkpoint ล่าสุด
ls -la checkpoints/ | tail -5
```

### Step 4: ทดสอบระบบ
```bash
# ทดสอบ backend
curl -s http://192.168.20.10:7810/health | jq .

# ทดสอบ frontend (ใน browser)
# เปิด http://192.168.20.10:8888/
```

---

## 📊 Template การสรุปสถานะ

เมื่อ Claude ได้อ่านข้อมูลแล้ว ให้ตอบในรูปแบบนี้:

```
✅ TaskFlow Pro Context Handover สำเร็จ

📊 สถานะระบบปัจจุบัน:
- Version: 2.0.0
- Status: Production Ready
- Frontend: ✅ Online (http://192.168.20.10:8888/)
- Backend: ✅ Healthy (http://192.168.20.10:7810/)

🎯 Features ที่ Complete:
- ✅ Team Attendance System (Employee/Team Lead/Manager)
- ✅ Role-based Navigation
- ✅ Export PDF/CSV functionality
- ✅ ClickUp Integration

📁 Latest Checkpoint: after_feature_Team_Attendance_tested (24 June 2025)

🚀 พร้อมสำหรับ:
- Mobile responsiveness improvements
- Enhanced export formatting  
- Performance optimization
- Additional attendance metrics

💡 ต่อไปต้องการพัฒนาอะไรครับ?
```

---

## 🎯 Common Commands สำหรับ Context ใหม่

### การตรวจสอบ
```bash
# Health check ครบวงจร
./check_system_status.sh

# ดู log แบบ real-time
ssh one-climate@192.168.20.10 'tail -f /home/one-climate/team-workload/master_auth.log'

# ดู checkpoint ทั้งหมด
./list_checkpoints.sh
```

### การ Deploy
```bash
# Deploy อัพเดต
./deploy_real_clickup.sh

# สร้าง checkpoint ใหม่
./create_checkpoint.sh [ชื่อ_checkpoint]

# Rollback (ถ้าจำเป็น)
./rollback_to_checkpoint.sh after_feature_Team_Attendance_tested
```

### การดูโค้ด
```bash
# ดูไฟล์หลัก
head -50 current_frontend.html
tail -50 master_auth_service.js

# ค้นหา function
grep -n "function.*selectRole" current_frontend.html
grep -n "attendance" current_frontend.html
```

---

## 🔧 Troubleshooting สำหรับ Context ใหม่

### ถ้าระบบไม่ทำงาน
1. **Backend ไม่ทำงาน**:
   ```bash
   ssh one-climate@192.168.20.10 'cd /home/one-climate/team-workload && node master_auth_service.js'
   ```

2. **Frontend ไม่แสดง**:
   ```bash
   ./deploy_real_clickup.sh
   ```

3. **Code ไม่อัพเดต**:
   ```bash
   # Load checkpoint ล่าสุด
   ./rollback_to_checkpoint.sh after_feature_Team_Attendance_tested
   ```

### ถ้า Context ไม่เข้าใจสถานะ
1. อ่าน `/Users/teerayutyeerahem/CLAUDE.md` อีกครั้ง
2. รัน `./check_system_status.sh` 
3. อธิบายสถานะปัจจุบันจาก memory files

---

## ⚠️ สิ่งสำคัญที่ต้องจำ

### สำหรับ Human:
- ใช้ template message ข้างบนเมื่อเริ่ม context ใหม่
- อัพเดต CLAUDE.md เมื่อมีการเปลี่ยนแปลงสำคัญ
- สร้าง checkpoint ก่อนทำงานใหญ่

### สำหรับ Claude:
- อ่าน CLAUDE.md ก่อนเสมอเมื่อเริ่ม context ใหม่
- ตรวจสอบ system health ก่อนเริ่มพัฒนา
- สร้าง checkpoint ก่อนทำการเปลี่ยนแปลงใหญ่
- อัพเดต memory files เมื่อเสร็จงาน

---

*Template นี้ใช้สำหรับการ handover context ระหว่าง Claude sessions*
*อัพเดตล่าสุด: 24 June 2025*