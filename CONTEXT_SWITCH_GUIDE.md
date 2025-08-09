# 🔄 TaskFlow Pro - Context Switch Guide

## 🚨 EMERGENCY CONTEXT SWITCH (เมื่อ Context เหลือ 10%)

### 1️⃣ Save ทันที:
```bash
./auto_save_now.sh
```

### 2️⃣ Copy Message:
```
Emergency handover from TaskFlow Pro session.
Context limit reached - auto save was triggered.

โปรดทำตามขั้นตอนนี้เพื่อต่อการทำงาน:
1. อ่าน project memory: /Users/teerayutyeerahem/CLAUDE.md
2. ตรวจสอบ system health: /Users/teerayutyeerahem/team-workload/check_system_status.sh
3. ดู latest files ใน: /Users/teerayutyeerahem/team-workload/quick_saves/
4. อ่าน emergency handover: /Users/teerayutyeerahem/team-workload/EMERGENCY_HANDOVER.txt

ระบบปัจจุบัน:
- Production: http://192.168.20.10:8888/
- Backend API: http://192.168.20.10:7810/
- Working directory: /Users/teerayutyeerahem/team-workload/
- Latest checkpoint: after_feature_Team_Attendance_tested

โปรดสรุปสถานะปัจจุบันและพร้อมต่อการทำงาน
```

### 3️⃣ เริ่ม Context ใหม่:
- วาง message ข้างบน
- Claude จะอ่าน memory และต่อการทำงาน

---

## 🔄 PLANNED CONTEXT SWITCH (เปลี่ยน Context ตามปกติ)

### 1️⃣ Save และ Checkpoint:
```bash
./save_session_state.sh
./create_checkpoint.sh session_end_$(date +%Y%m%d_%H%M)
```

### 2️⃣ Copy Message:
```
ฉันต้องการต่อพัฒนา TaskFlow Pro ต่อจาก session ก่อนหน้า

โปรดทำตามขั้นตอนนี้:
1. อ่าน project memory: /Users/teerayutyeerahem/CLAUDE.md
2. ตรวจสอบระบบ: /Users/teerayutyeerahem/team-workload/check_system_status.sh  
3. สรุปสถานะปัจจุบันและ features ที่ complete แล้ว
4. แจ้งว่าพร้อมพัฒนาต่อหรือไม่

Project info:
- Version: 2.0 (Team Attendance features completed)
- Production: http://192.168.20.10:8888/
- Latest checkpoint: after_feature_Team_Attendance_tested
- Working dir: /Users/teerayutyeerahem/team-workload/
```

---

## 📱 ONE-LINER COMMANDS

### Emergency Save:
```bash
./auto_save_now.sh && echo "Copy message from EMERGENCY_HANDOVER.txt"
```

### Health Check:
```bash
./check_system_status.sh
```

### Quick Status:
```bash
curl -s http://192.168.20.10:7810/health | jq .status
```

---

## 🎯 WHAT CLAUDE WILL DO

### เมื่อได้รับ handover message Claude จะ:

1. **อ่าน CLAUDE.md** → ได้ประวัติโปรเจคแบบสมบูรณ์
2. **รัน check_system_status.sh** → ทราบสถานะระบบปัจจุบัน
3. **ดู emergency/session files** → รู้งานล่าสุดที่ทำ
4. **สรุปสถานะ** → บอกว่าเข้าใจแล้วและพร้อมต่อ

### ผลลัพธ์:
```
✅ TaskFlow Pro Context Handover สำเร็จ

📊 สถานะระบบปัจจุบัน:
- Version: 2.0.0  
- Status: Production Ready
- Frontend: ✅ Online
- Backend: ✅ Healthy

🎯 Features Complete:
- ✅ Team Attendance System
- ✅ Role-based Navigation  
- ✅ Export PDF/CSV

📁 Latest Checkpoint: after_feature_Team_Attendance_tested

🚀 พร้อมสำหรับการพัฒนาต่อ - ต้องการทำอะไรครับ?
```

---

## 🔧 TROUBLESHOOTING

### ถ้า Context Switch ไม่สำเร็จ:

1. **Claude ไม่เข้าใจ**:
   ```
   โปรดอ่าน /Users/teerayutyeerahem/CLAUDE.md ก่อน
   แล้วรัน /Users/teerayutyeerahem/team-workload/check_system_status.sh
   ```

2. **ระบบไม่ทำงาน**:
   ```bash
   ./rollback_to_checkpoint.sh after_feature_Team_Attendance_tested
   ```

3. **ไฟล์หาย**:
   ```bash
   ls -la quick_saves/
   ls -la session_saves/
   ```

---

## 🎉 SUCCESS INDICATORS

### Context Switch สำเร็จเมื่อ Claude ใหม่:
- ✅ แสดงสถานะระบบปัจจุบัน
- ✅ รู้ features ที่ complete แล้ว  
- ✅ ทราบ latest checkpoint
- ✅ พร้อมรับงานใหม่หรือต่อการทำงาน

### คุณจะได้:
- 🔄 **Zero Downtime**: ต่อการทำงานได้ทันที
- 🧠 **Full Context**: Claude รู้ทุกอย่างเหมือนเดิม
- 📁 **Safe Backup**: ไม่สูญหายงานแน่นอน
- 🚀 **Ready to Code**: พร้อมพัฒนาต่อทันที