# TaskFlow Pro - Project Context

## 🎯 Project Overview
**TaskFlow Pro** is an enterprise team workload management system with ClickUp integration, designed for efficient task tracking, team analytics, and performance monitoring.

## 🏗️ System Architecture (v6.0)

### **Current Implementation**
- **Frontend**: Nginx (port 8888) serving responsive dashboard
- **Backend**: Node.js Express (port 7812) with Domain-Driven Design
- **Database**: PostgreSQL with local ClickUp data storage
- **Authentication**: JWT + HttpOnly cookies + ClickUp OAuth
- **Integration**: Local-first ClickUp sync with background updates

### **Key Technologies**
- **Backend**: Node.js, Express, PostgreSQL, JWT
- **Frontend**: Vanilla JavaScript, CSS Grid, Responsive Design
- **Database**: PostgreSQL with 12 ClickUp tables + user management
- **Sync Engine**: Custom ClickUp API integration with data conversion
- **Security**: bcrypt hashing, CORS protection, input validation

## 📊 Current Status (v6.0) - Phase 1 Complete

### ✅ **Completed Features**
1. **Authentication System**
   - Multi-role user management (Master, Manager, Team Lead, Employee)
   - ClickUp OAuth integration with permanent token storage
   - Hybrid authentication (password + OAuth)
   - JWT-based session management

2. **ClickUp Integration (Phase 1)**
   - Complete local database synchronization
   - 12 PostgreSQL tables for ClickUp data
   - Robust sync engine with error handling
   - Local data endpoints (5-20x performance improvement)

3. **Role-Based Dashboard**
   - Dynamic component loading based on user role
   - Team analytics and workload visualization
   - Task management with filtering and sorting
   - Responsive design for all devices

4. **Performance Optimization**
   - Local-first data architecture
   - Database queries replace API calls
   - 98% improvement in dashboard load times
   - Offline capability for core features

### 🔄 **Current Phase: Ready for Phase 2**
- **Phase 1**: ✅ Local-first ClickUp sync (COMPLETE)
- **Phase 2**: ⏳ Frontend integration with local endpoints
- **Phase 3**: 📋 Background sync automation
- **Phase 4**: 📋 Advanced features and optimization

## 🗃️ Database Architecture

### **User Management Tables**
- `users` - User accounts and authentication
- `clickup_tokens` - OAuth tokens and metadata
- `system_status` - System operational status

### **ClickUp Sync Tables (12 tables)**
- `clickup_sync_metadata` - Sync status and monitoring
- `clickup_teams` - ClickUp workspaces/teams
- `clickup_spaces` - Spaces within teams
- `clickup_lists` - Lists within spaces
- `clickup_tasks` - Tasks with complete metadata
- `clickup_members` - Team members and users
- `clickup_task_assignees` - Task-member assignments
- `clickup_team_members` - Team-member relationships
- `clickup_workload_stats` - Cached performance statistics
- `clickup_recent_activities` - Activity tracking
- `clickup_sync_jobs` - Background sync job queue

## 🔐 Authentication Flow

### **Master User (yterayut@gmail.com)**
1. Password login → Dashboard access
2. Stored ClickUp OAuth token (permanent)
3. All ClickUp features available
4. System administration capabilities

### **Regular Users**
1. Email/password login → Role-based dashboard
2. No ClickUp integration required
3. Role-specific component visibility
4. Team analytics and task management

## 🚀 Performance Metrics

### **Before Phase 1**
- Dashboard load: ~3900ms
- Data source: ClickUp API (network dependent)
- API rate limits: 10 requests/minute
- Offline capability: None

### **After Phase 1**
- Dashboard load: 20-50ms (98% improvement)
- Data source: Local PostgreSQL
- Rate limits: None
- Offline capability: Full dashboard functionality
- Query speed: 5-20x faster

## 📡 API Architecture

### **Authentication Endpoints**
- `POST /api/v2/auth/login` - User authentication
- `GET /api/v2/auth/profile` - User profile data
- `POST /api/v2/auth/logout` - Session termination

### **ClickUp OAuth Endpoints**
- `GET /auth/clickup` - OAuth initiation
- `GET /auth/clickup/callback` - OAuth callback
- `GET /api/v2/system/status` - System health

### **Local Data Endpoints (Phase 1)**
- `GET /api/v2/local/health` - Sync system health
- `GET /api/v2/local/sync-status` - Current sync status
- `POST /api/v2/local/force-sync` - Manual sync trigger
- `GET /api/v2/local/dashboard-data` - Dashboard data (local)
- `GET /api/v2/local/team-stats` - Team statistics (local)
- `GET /api/v2/local/member-workload` - Member workload (local)
- `GET /api/v2/local/tasks` - Tasks data (local)

## 🎭 User Roles & Permissions

### **👑 Master (yterayut@gmail.com)**
- Full system access
- ClickUp OAuth management
- User administration
- System configuration

### **🧑‍💼 Manager**
- All team visibility
- Employee management
- Analytics and reports
- Team performance tracking

### **👨‍💼 Team Lead (chaiwutwck@gmail.com)**
- Team-specific management
- Team member tasks
- Team analytics
- Limited user management

### **👨‍🔧 Employee (atthakorn.na@ku.th)**
- Personal tasks only
- Profile management
- Attendance tracking
- Basic analytics

## 🔧 Development Workflow

### **Local Development**
1. Edit files in `/Users/teerayutyeerahem/team-workload/`
2. Test locally when possible
3. Deploy to production server
4. Verify functionality
5. Create checkpoint if major changes

### **Production Deployment**
1. SSH to server: `ssh one-climate@192.168.20.10`
2. Deploy backend: `scp` + service restart
3. Deploy frontend: `sudo cp` to `/var/www/taskflow/`
4. Test endpoints and functionality
5. Monitor logs for issues

### **Database Changes**
1. Edit schema files locally
2. Test on development database
3. Deploy to production PostgreSQL
4. Verify data integrity
5. Update documentation

## 🎯 Next Development Priorities

### **Phase 2: Frontend Integration** (Immediate)
- Update dashboard to use `/api/v2/local/*` endpoints
- Implement instant data loading
- Add sync status indicators
- Enhanced offline UX

### **Phase 3: Background Sync** (Next)
- Hourly automatic synchronization
- Conflict resolution strategies
- Sync monitoring and alerting
- Smart sync scheduling

### **Phase 4: Advanced Features** (Future)
- Real-time task updates
- Advanced analytics
- Performance monitoring
- User training and documentation

## 🏷️ Environment Details

### **Production Server**
- Host: `192.168.20.10`
- User: `one-climate`
- Password: `U8@1v3z#14`
- Frontend: `http://192.168.20.10:8888/`
- Backend: `http://192.168.20.10:7812/`

### **Database**
- Host: `localhost`
- Database: `taskflow_pro`
- User: `taskflow_user`
- Password: `TaskFlow2025Secure`

### **ClickUp Integration**
- Client ID: `F9M7XRHB7T6Q78ZVL5077IT2HM89KTK5`
- Redirect URI: `http://192.168.20.10:7812/auth/clickup/callback`
- Token: Stored in `master_clickup_token.json`

---
*Last Updated: 6 July 2025, 18:30 GMT+7*
*Status: Phase 1 Complete - Local-First ClickUp Sync*
*Next: Phase 2 Frontend Integration*