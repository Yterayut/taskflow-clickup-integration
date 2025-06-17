# 📊 TaskFlow - ClickUp Integration Dashboard

![Version](https://img.shields.io/badge/version-1.0.0--baseline-blue)
![Node.js](https://img.shields.io/badge/node.js-18+-green)
![React](https://img.shields.io/badge/react-18+-blue)
![ClickUp](https://img.shields.io/badge/ClickUp-API-orange)

TaskFlow เป็นระบบจัดการทีมงานที่เชื่อมต่อกับ ClickUp API เพื่อแสดงข้อมูลจริงของทีมงาน งาน และประสิทธิภาพการทำงาน

## ✨ Features

- 🔗 **ClickUp Integration**: เชื่อมต่อกับ ClickUp API แบบ OAuth2
- 📊 **Real-time Dashboard**: แสดงข้อมูลจริงจาก ClickUp
- 🔄 **Auto-sync**: ซิงค์ข้อมูลอัตโนมัติทุก 30 นาที
- 👥 **Team Management**: จัดการสมาชิกทีมและ workload
- 📈 **Analytics**: กราฟและสถิติประสิทธิภาพ
- 🌙 **Dark Mode**: รองรับธีมมืดและสว่าง
- 📱 **Responsive**: ใช้งานได้ทุกอุปกรณ์

## 🏗️ Architecture

```
TaskFlow/
├── backend.js              # Express.js API server
├── services/
│   ├── clickupService.js    # ClickUp API integration
│   ├── authService.js       # Authentication & JWT
│   └── dataSyncService.js   # Data synchronization
├── public/
│   └── index.html          # React frontend (Single file)
└── docs/
    └── DEVELOPMENT_LOG.md   # Complete development history
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- ClickUp Account และ API credentials
- Redis (optional, for session storage)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Yterayut/taskflow-clickup-integration.git
cd taskflow-clickup-integration
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Setup**
```bash
cp .env.example .env
# แก้ไข .env ด้วย ClickUp credentials ของคุณ
```

4. **ClickUp App Configuration**
- ไปที่ ClickUp → Settings → Apps
- สร้าง new app หรือใช้ existing app
- ตั้งค่า redirect URI: `http://your-server:777/api/v1/auth/clickup/callback`
- คัดลอก Client ID และ Client Secret ใส่ใน .env

5. **Start the server**
```bash
npm start
```

## 🔧 Configuration

### Environment Variables

ตัวอย่างการกำหนดค่าใน `.env`:

```env
# ClickUp API Configuration
CLICKUP_CLIENT_ID=your_clickup_client_id_here
CLICKUP_CLIENT_SECRET=your_clickup_client_secret_here
CLICKUP_REDIRECT_URI=http://your-server:777/api/v1/auth/clickup/callback

# Security Configuration
JWT_SECRET=your-super-secret-jwt-key-here

# Server Configuration
BASE_URL=http://your-server:777
PORT=777
```

### ClickUp OAuth Setup

1. ไปที่ [ClickUp Apps](https://app.clickup.com/settings/apps)
2. คลิก "Create an App"
3. กรอกข้อมูล:
   - **App Name**: TaskFlow Integration
   - **Redirect URL**: `http://your-server:777/api/v1/auth/clickup/callback`
4. บันทึก Client ID และ Client Secret

## 📖 API Documentation

### Authentication Endpoints

```
GET  /api/v1/auth/clickup/authorize    # เริ่ม OAuth flow
GET  /api/v1/auth/clickup/callback     # OAuth callback
GET  /api/v1/auth/status               # ตรวจสอบสถานะ authentication
POST /api/v1/auth/logout               # Logout
```

### Data Endpoints

```
GET  /api/v1/test/clickup-data         # ดึงข้อมูลจาก ClickUp
POST /api/v1/sync                      # Manual sync
GET  /api/v1/dashboard                 # Dashboard data
GET  /api/v1/tasks                     # Tasks data
GET  /api/v1/team                      # Team data
```

## 🎯 Usage

### 1. เริ่มใช้งาน

1. เปิดเบราว์เซอร์ไปที่ `http://localhost:777`
2. คลิก "เชื่อมต่อ ClickUp"
3. Login ด้วย ClickUp account
4. อนุญาตให้ TaskFlow เข้าถึงข้อมูล

### 2. Dashboard Features

- **📊 KPI Cards**: สถิติรวมงาน เสร็จแล้ว กำลังทำ เกินกำหนด
- **👥 Team Grid**: สมาชิกทีมพร้อม workload status
- **📈 Performance Chart**: กราฟแสดงประสิทธิภาพรายวัน
- **🥧 Workload Pie Chart**: สัดส่วนการกระจายงาน
- **🔔 Activities**: กิจกรรมล่าสุดของทีม

### 3. Sync Features

- **Auto-sync**: ระบบซิงค์อัตโนมัติทุก 30 นาที
- **Manual sync**: กดปุ่ม 🔄 เพื่อซิงค์ทันที
- **Sync status**: แสดงเวลาซิงค์ล่าสุดและครั้งถัดไป

## 🛠️ Development

### Project Structure

```
src/
├── backend.js                 # Main server file
├── services/
│   ├── clickupService.js      # ClickUp API wrapper
│   ├── authService.js         # JWT & session management
│   └── dataSyncService.js     # Background sync
├── public/
│   └── index.html            # Single-page React app
└── docs/
    └── DEVELOPMENT_LOG.md     # Complete development guide
```

### Development Setup

```bash
# Development mode
npm run dev

# Production mode
npm run start

# Run tests
npm test

# Build for production
npm run build
```

### Code Style

- **ES6+**: Modern JavaScript features
- **Async/Await**: For API calls
- **Error Handling**: Comprehensive try-catch blocks
- **Security**: JWT, CORS, rate limiting
- **Logging**: Structured logging with timestamps

## 🔒 Security

### Authentication Flow

1. **OAuth2**: ClickUp standard OAuth flow
2. **JWT Tokens**: Secure session management
3. **Token Encryption**: AES-256 encryption for sensitive data
4. **Rate Limiting**: 100 requests per 15 minutes
5. **CORS Protection**: Configured for production domains

### Security Features

- ✅ Environment variables for secrets
- ✅ JWT token expiration
- ✅ Input validation
- ✅ Error sanitization
- ✅ Rate limiting
- ✅ HTTPS-ready

## 📊 Data Flow

```
ClickUp API → Backend Services → Frontend Dashboard
     ↓              ↓                    ↓
   OAuth2      Data Transform      Real-time UI
   Tokens      Rate Limiting       Auto-refresh
   Teams       Error Handling      Dark Mode
   Tasks       Caching            Responsive
```

## 🚀 Deployment

### Production Setup

1. **Server Requirements**
   - Node.js 18+
   - 2GB RAM minimum
   - SSL certificate (recommended)

2. **Environment Configuration**
```bash
NODE_ENV=production
PORT=777
```

3. **Process Management**
```bash
# Using PM2
pm2 start backend.js --name taskflow

# Using systemd
sudo systemctl start taskflow
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 777
CMD ["npm", "start"]
```

## 📈 Performance

### Benchmarks

- **API Response Time**: < 2 seconds
- **Dashboard Load**: < 3 seconds  
- **Memory Usage**: ~50MB
- **Concurrent Users**: 100+

### Optimization

- **Caching**: Redis for session storage
- **Rate Limiting**: Prevents API abuse
- **Compression**: Gzip for responses
- **Minification**: Production assets

## 🎨 Screenshots

### Light Mode Dashboard
![Dashboard Light](docs/screenshots/dashboard-light.png)

### Dark Mode Dashboard  
![Dashboard Dark](docs/screenshots/dashboard-dark.png)

### Team Management
![Team Management](docs/screenshots/team-view.png)

## 📝 Changelog

### v1.0.0-baseline (2025-06-17)
- ✅ Initial ClickUp OAuth2 integration
- ✅ Real-time data synchronization
- ✅ Auto-sync every 30 minutes
- ✅ Complete dashboard with charts
- ✅ Dark mode support
- ✅ Responsive design
- ✅ Production deployment

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Development Guidelines

- Follow existing code style
- Add tests for new features
- Update documentation
- Ensure security best practices

## 📚 Documentation

- [📋 Development Log](DEVELOPMENT_LOG.md) - Complete development history
- [🚀 Deployment Guide](DEPLOYMENT_LOG.md) - Production deployment
- [🔧 API Reference](docs/api.md) - API documentation
- [🎨 UI Components](docs/components.md) - Frontend components

## 🐛 Troubleshooting

### Common Issues

1. **OAuth Redirect Error**
   - ตรวจสอบ redirect URI ใน ClickUp app settings
   - ตรวจสอบ PORT และ BASE_URL ใน .env

2. **API Rate Limiting**  
   - ClickUp API มี rate limit
   - ใช้ auto-sync แทน manual sync บ่อย ๆ

3. **Token Expiration**
   - ClickUp tokens หมดอายุ
   - ต้อง re-authenticate ใหม่

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👏 Acknowledgments

- **ClickUp** - สำหรับ API และ OAuth support
- **React Community** - Frontend framework
- **Node.js Community** - Backend runtime
- **Open Source Contributors** - Third-party libraries

## 📞 Support

- **Email**: yterayut@gmail.com
- **GitHub Issues**: [Create an issue](https://github.com/Yterayut/taskflow-clickup-integration/issues)
- **Documentation**: [Wiki](https://github.com/Yterayut/taskflow-clickup-integration/wiki)

---

**Built with ❤️ by [Yterayut](https://github.com/Yterayut)**  
**Powered by ClickUp API & Claude Code**