้อมูลส่วนตัวเท่านั้น
- **ฟีเจอร์เฉพาะ**:
  - ดูงานที่ได้รับมอบหมาย (7 งาน)
  - อัพเดทความคืบหน้างาน
  - Time Tracking
  - ตารางงานส่วนตัว
  - Learning และ Goals
- **KPIs**: งานส่วนตัว, ประสิทธิภาพตัวเอง, เป้าหมายส่วนบุคคล

## 🛠️ **การติดตั้งและใช้งาน**

### 📋 **ความต้องการระบบ**
- Node.js >= 18.0.0
- npm >= 8.0.0
- (Optional) Redis สำหรับ caching
- (Optional) ClickUp API สำหรับ integration

### 🚀 **วิธีการเริ่มใช้งาน**

#### **1. Quick Start (แบบง่าย)**
```bash
# ไปยังโฟลเดอร์โปรเจค
cd /Users/teerayutyeerahem/team-workload

# รันระบบ TaskFlow Pro
./start_taskflow_pro.sh
```

#### **2. Manual Start (แบบละเอียด)**
```bash
# ติดตั้ง dependencies
npm install

# สร้างไฟล์ .env (ถ้ายังไม่มี)
cp .env.example .env

# รัน TaskFlow Pro Backend
node backend_taskflow_pro.js

# หรือรัน Legacy Backend
node backend.js
```

### 🌐 **การเข้าถึงระบบ**
- **TaskFlow Pro**: http://localhost:777/
- **Legacy System**: http://localhost:777/legacy
- **Health Check**: http://localhost:777/health
- **API Documentation**: http://localhost:777/api/v1/health

## 🔐 **การเข้าสู่ระบบ**

### **Demo Users (สำหรับทดสอบ)**
| บทบาท | ชื่อผู้ใช้ | อีเมล | รหัสผ่าน |
|--------|-----------|-------|----------|
| Manager | ประยุทธ์ ผู้จัดการ | manager@taskflow.com | demo |
| Team Lead | สมศักดิ์ หัวหน้าทีม | teamlead@taskflow.com | demo |
| Employee | กิตติพงษ์ พนักงาน | employee@taskflow.com | demo |

### **วิธีการ Login**
1. เข้าไปที่ http://localhost:777/
2. คลิกเลือกบทบาทที่ต้องการทดสอบ
3. ระบบจะเข้าสู่ Dashboard ที่เหมาะสมกับบทบาท

## 📊 **โครงสร้างข้อมูล**

### **Teams (ทีมงาน)**
```javascript
- Frontend Team (4 สมาชิก) - หัวหน้าทีม: สมศักดิ์
- Backend Team (3 สมาชิก) - หัวหน้าทีม: อนุชา  
- Design Team (2 สมาชิก) - หัวหน้าทีม: นิดา
- QA Team (3 สมาชิก) - หัวหน้าทีม: วิชัย
```

### **Sample Tasks**
```javascript
- API Development for User Authentication (High Priority)
- Frontend Component Refactoring (Medium Priority)  
- Code Review - Payment Module (Low Priority)
```

## 🔧 **การตั้งค่า Environment**

### **.env Configuration**
```bash
# Server Settings
PORT=777
NODE_ENV=development
APP_URL=http://localhost:777

# Security
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_encryption_key_here

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_REQUESTS=100

# ClickUp Integration (Optional)
CLICKUP_CLIENT_ID=your_clickup_client_id
CLICKUP_CLIENT_SECRET=your_clickup_client_secret
CLICKUP_REDIRECT_URI=http://localhost:777/api/v1/auth/clickup/callback

# Redis (Optional)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password
```

## 📡 **API Endpoints**

### **Authentication**
```
POST /api/v1/auth/login
GET  /api/v1/user/profile
```

### **Dashboard**
```
GET  /api/v1/dashboard/kpis
GET  /api/v1/analytics
```

### **Teams & Tasks**
```
GET  /api/v1/teams
GET  /api/v1/tasks
POST /api/v1/tasks
PUT  /api/v1/tasks/:taskId
```

### **Notifications**
```
GET  /api/v1/notifications
PUT  /api/v1/notifications/:id/read
```

## 🎨 **UI Components**

### **Role-Based Dashboards**
- **Manager Dashboard**: Organization overview, all teams, budget management
- **Team Lead Dashboard**: Team members, task assignment, team analytics  
- **Employee Dashboard**: Personal tasks, schedule, achievements

### **Interactive Elements**
- **KPI Cards**: ข้อมูลสถิติแบบ Real-time พร้อม trends
- **Progress Bars**: แสดงความคืบหน้าแบบ animated
- **Team Cards**: ข้อมูลทีมพร้อม workload indicators
- **Task Items**: รายการงานพร้อม priority และ status badges

## 🔔 **Notification System**

### **Manager Notifications**
- QA Team มีงานล้นเกินกำหนด
- Frontend Team ประสิทธิภาพเพิ่มขึ้น
- งบประมาณโครงการรออนุมัติ

### **Team Lead Notifications**  
- สมาชิกทีมมีงานเกินกำหนด
- งานใหม่ถูกส่งมอบ
- Sprint Planning กำหนดการ

### **Employee Notifications**
- งานถูกอัพเดทโดย Team Lead
- Daily Standup ใกล้เวลา
- Deadline เข้าใกล้

## 📈 **Analytics & Reports**

### **Manager Analytics**
- Total teams, employees, tasks
- Organization completion rate
- Team performance comparison
- Budget and resource allocation

### **Team Lead Analytics**
- Team efficiency metrics
- Member workload distribution
- Sprint progress tracking
- Goal achievement status

### **Employee Analytics**
- Personal task completion rate
- Time tracking statistics
- Skill development progress
- Achievement milestones

## 🚦 **Status Indicators**

### **Employee Status**
- 🟢 **Available** (พร้อมรับงาน)
- 🟡 **Away** (ไม่อยู่ที่โต๊ะ)  
- 🔴 **Busy** (ไม่ว่าง)

### **Task Priority**
- 🔴 **High** (สูง)
- 🟡 **Medium** (ปานกลาง)
- 🟢 **Low** (ต่ำ)

### **Task Status**  
- ⚪ **Todo** (รอดำเนินการ)
- 🔵 **In Progress** (กำลังทำ)
- 🟢 **Completed** (เสร็จแล้ว)
- 🔴 **Overdue** (เกินกำหนด)

## ⌨️ **Keyboard Shortcuts**

- **Ctrl + /** : Focus search box
- **Esc** : Close modals
- **Click KPI Cards** : Animate และแสดงรายละเอียด

## 🔒 **Security Features**

- **Role-Based Access Control** (RBAC)
- **Token-Based Authentication**
- **Rate Limiting** (100 requests/15 minutes)
- **Input Validation**
- **CORS Protection**
- **Helmet Security Headers**

## 📱 **Responsive Design**

- **Desktop** (1400px+): Full layout แบบ 3 columns
- **Tablet** (768px-1400px): Adaptive layout  
- **Mobile** (<768px): Stack layout, sidebar ข้างล่าง

## 🐛 **Troubleshooting**

### **Common Issues**

#### **1. Port 777 already in use**
```bash
# หาและหยุด process ที่ใช้ port 777
lsof -ti:777 | xargs kill -9

# หรือเปลี่ยน port ใน .env
PORT=8080
```

#### **2. Dependencies installation fails**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules และ install ใหม่
rm -rf node_modules package-lock.json
npm install
```

#### **3. Cannot access from other devices**
```bash
# เปลี่ยน APP_URL ใน .env
APP_URL=http://0.0.0.0:777

# หรือใช้ IP address
APP_URL=http://192.168.1.100:777
```

## 🔄 **การอัพเกรดจากระบบเก่า**

### **Backup Current System**
```bash
# สำรองไฟล์เก่า
cp index.html index_legacy_backup.html
cp backend.js backend_legacy_backup.js
```

### **Switch to TaskFlow Pro**
```bash
# ใช้ระบบใหม่
./start_taskflow_pro.sh

# หรือกลับไปใช้ระบบเก่า
node backend.js
```

## 📞 **Support & Contact**

- **Developer**: Teerayut Yeerahem
- **Email**: yterayut@gmail.com
- **Version**: 3.0.0-taskflow-pro
- **License**: MIT

## 🎯 **Roadmap**

### **Phase 1** ✅ (Completed)
- Role-based authentication
- Interactive dashboards
- Task management
- Team overview

### **Phase 2** 🚧 (In Progress)
- Real database integration
- Advanced reporting
- Email notifications
- Mobile app

### **Phase 3** 📋 (Planned)
- ClickUp full integration  
- Video conferencing
- AI-powered insights
- Multi-language support

---

## 🚀 **Quick Start Guide**

```bash
# 1. Clone หรือเข้าไปในโฟลเดอร์
cd /Users/teerayutyeerahem/team-workload

# 2. รันระบบ
./start_taskflow_pro.sh

# 3. เปิดเว็บไซต์
open http://localhost:777

# 4. เลือก role ที่ต้องการทดสอบ
# Manager -> ประยุทธ์ ผู้จัดการ
# Team Lead -> สมศักดิ์ หัวหน้าทีม  
# Employee -> กิตติพงษ์ พนักงาน

# 5. สำรวจ features ต่างๆ
# - KPI Cards (คลิกเพื่อ animate)
# - Team/Employee Cards (คลิกเพื่อดูรายละเอียด)
# - Add Task/Employee buttons
# - Notifications (🔔)
# - Search functionality
```

**🎉 ยินดีต้อนรับสู่ TaskFlow Pro!** 

ระบบจัดการทีมงานที่ทันสมัย พร้อมระบบ Role-Based ที่จะช่วยให้การทำงานของทีมเป็นระเบียบและมีประสิทธิภาพมากขึ้น!