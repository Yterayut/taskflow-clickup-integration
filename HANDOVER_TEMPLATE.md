# Context Handover Template

## 🚨 สำหรับเมื่อ Context เหลือน้อย

### Copy message นี้ไปยัง Claude Context ใหม่:

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

### หลังจากส่ง message แล้ว Claude ใหม่จะ:
1. ✅ อ่าน CLAUDE.md → รู้ประวัติโปรเจค
2. ✅ รัน check_system_status.sh → ทราบสถานะปัจจุบัน  
3. ✅ ดู emergency handover → รู้งานล่าสุด
4. ✅ พร้อมทำงานต่อทันที

## 🔄 สำหรับการเริ่ม Context ใหม่ทั่วไป

### Copy message นี้:

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

## 📱 Quick Commands Reference

### ตรวจสอบสถานะ:
```bash
./check_system_status.sh
```

### Save งานปัจจุบัน:
```bash
./auto_save_now.sh                    # Emergency save
./quick_save.sh "description"         # Manual save
```

### จัดการ Checkpoint:
```bash
./create_checkpoint.sh [name]         # สร้าง checkpoint
./list_checkpoints.sh                 # ดู checkpoint ทั้งหมด
./rollback_to_checkpoint.sh [name]    # กู้คืน checkpoint
```

### Deploy ระบบ:
```bash
./deploy_real_clickup.sh              # Deploy ไป production
```