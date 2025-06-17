#!/bin/bash
# deploy-app.sh

set -e

echo "🚀 Deploying TaskFlow Application..."

APP_DIR="/opt/taskflow/app"
BACKUP_DIR="/opt/taskflow/backups"
SCRIPTS_DIR="/opt/taskflow/scripts"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please run this script as a regular user (not root)"
    exit 1
fi

# Check if TaskFlow is installed
if [ ! -d "/opt/taskflow" ]; then
    echo "❌ TaskFlow not installed. Please run install-taskflow-isolated.sh first"
    exit 1
fi

# Create backup
echo "📦 Creating backup..."
BACKUP_NAME="deploy-backup-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP_DIR/$BACKUP_NAME"

# Backup current version if exists
if [ -f "$APP_DIR/backend/taskflow-backend" ]; then
    sudo cp "$APP_DIR/backend/taskflow-backend" "$BACKUP_DIR/$BACKUP_NAME/" 2>/dev/null || true
fi

if [ -d "$APP_DIR/frontend" ] && [ "$(ls -A $APP_DIR/frontend 2>/dev/null)" ]; then
    sudo cp -r "$APP_DIR/frontend" "$BACKUP_DIR/$BACKUP_NAME/" 2>/dev/null || true
fi

# Stop services gracefully
echo "⏹️ Stopping services..."
if [ -f "$SCRIPTS_DIR/stop-all.sh" ]; then
    sudo -u taskflow "$SCRIPTS_DIR/stop-all.sh" || true
else
    sudo systemctl stop taskflow-nginx taskflow-frontend taskflow-backend 2>/dev/null || true
fi

# Deploy method selection
echo "📥 Select deployment method:"
echo "1. Deploy sample/demo application"
echo "2. Deploy from local source code"
echo "3. Deploy from Git repository"
read -p "Choose option (1-3): " DEPLOY_METHOD

case $DEPLOY_METHOD in
    1)
        echo "🎯 Deploying sample application..."
        
        # Create simple Go backend
        echo "🔧 Creating sample Go backend..."
        sudo mkdir -p "$APP_DIR/backend"
        
        # Set Go environment
        export PATH=$PATH:/usr/local/go/bin
        export GOPATH=/opt/taskflow/go
        
        # Create simple backend
        sudo tee "$APP_DIR/backend/main.go" > /dev/null <<GOBACKEND
package main

import (
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "os"
    "time"
    
    "github.com/gin-contrib/cors"
    "github.com/gin-gonic/gin"
)

type HealthResponse struct {
    Status    string    \`json:"status"\`
    Service   string    \`json:"service"\`
    Version   string    \`json:"version"\`
    Port      string    \`json:"port"\`
    Timestamp time.Time \`json:"timestamp"\`
}

type TaskResponse struct {
    Tasks []Task \`json:"tasks"\`
    Total int    \`json:"total"\`
}

type Task struct {
    ID          string    \`json:"id"\`
    Title       string    \`json:"title"\`
    Description string    \`json:"description"\`
    Status      string    \`json:"status"\`
    Priority    string    \`json:"priority"\`
    Assignee    string    \`json:"assignee"\`
    CreatedAt   time.Time \`json:"createdAt"\`
    DueDate     *time.Time \`json:"dueDate,omitempty"\`
}

func main() {
    // Set Gin mode
    if os.Getenv("GIN_MODE") == "" {
        gin.SetMode(gin.ReleaseMode)
    }
    
    router := gin.Default()
    
    // CORS middleware
    router.Use(cors.New(cors.Config{
        AllowOrigins:     []string{"http://localhost:666", "http://localhost:555"},
        AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
        ExposeHeaders:    []string{"Content-Length"},
        AllowCredentials: true,
        MaxAge:          12 * time.Hour,
    }))
    
    // Health check endpoint
    router.GET("/health", func(c *gin.Context) {
        c.JSON(http.StatusOK, HealthResponse{
            Status:    "OK",
            Service:   "TaskFlow Backend",
            Version:   "1.0.0-demo",
            Port:      os.Getenv("PORT"),
            Timestamp: time.Now(),
        })
    })
    
    // API routes
    api := router.Group("/api/v1")
    {
        // Sample tasks endpoint
        api.GET("/tasks", func(c *gin.Context) {
            sampleTasks := []Task{
                {
                    ID:          "1",
                    Title:       "ออกแบบ Dashboard UI",
                    Description: "สร้าง Dashboard สำหรับแสดงข้อมูลทีม",
                    Status:      "in_progress",
                    Priority:    "high",
                    Assignee:    "นภัสสร จันทร์เพ็ญ",
                    CreatedAt:   time.Now().AddDate(0, 0, -2),
                },
                {
                    ID:          "2", 
                    Title:       "พัฒนา API สำหรับ User Management",
                    Description: "สร้าง REST API สำหรับจัดการข้อมูลผู้ใช้",
                    Status:      "completed",
                    Priority:    "medium",
                    Assignee:    "กิตติพงษ์ สมศรี",
                    CreatedAt:   time.Now().AddDate(0, 0, -5),
                },
                {
                    ID:          "3",
                    Title:       "ทดสอบระบบ Authentication",
                    Description: "ทดสอบการเข้าสู่ระบบและสิทธิ์การใช้งาน",
                    Status:      "pending",
                    Priority:    "low",
                    Assignee:    "มานี เก่งมาก",
                    CreatedAt:   time.Now().AddDate(0, 0, -1),
                },
            }
            
            c.JSON(http.StatusOK, TaskResponse{
                Tasks: sampleTasks,
                Total: len(sampleTasks),
            })
        })
        
        // Sample team endpoint
        api.GET("/team", func(c *gin.Context) {
            teamData := map[string]interface{}{
                "members": []map[string]interface{}{
                    {
                        "id":       "1",
                        "name":     "กิตติพงษ์ สมศรี", 
                        "position": "Senior Developer",
                        "currentTasks": 7,
                        "maxTasks":    10,
                        "status":      "available",
                    },
                    {
                        "id":       "2",
                        "name":     "นภัสสร จันทร์เพ็ญ",
                        "position": "UI/UX Designer", 
                        "currentTasks": 4,
                        "maxTasks":    8,
                        "status":      "busy",
                    },
                    {
                        "id":       "3",
                        "name":     "มานี เก่งมาก",
                        "position": "QA Tester",
                        "currentTasks": 6,
                        "maxTasks":    8, 
                        "status":      "available",
                    },
                },
                "total": 3,
            }
            
            c.JSON(http.StatusOK, teamData)
        })
    }
    
    port := os.Getenv("PORT")
    if port == "" {
        port = "777"
    }
    
    fmt.Printf("🚀 TaskFlow Backend starting on port %s\n", port)
    log.Fatal(router.Run(":" + port))
}
GOBACKEND

        # Create go.mod
        sudo tee "$APP_DIR/backend/go.mod" > /dev/null <<GOMOD
module taskflow-backend

go 1.21

require (
    github.com/gin-contrib/cors v1.4.0
    github.com/gin-gonic/gin v1.9.1
)
GOMOD

        # Build backend
        echo "🔨 Building Go backend..."
        cd "$APP_DIR/backend"
        sudo -u taskflow bash -c 'export PATH=$PATH:/usr/local/go/bin && export GOPATH=/opt/taskflow/go && go mod tidy && go build -o taskflow-backend main.go'
        
        # Create React frontend server
        echo "🎨 Creating sample React frontend..."
        sudo mkdir -p "$APP_DIR/frontend"
        
        # Create package.json
        sudo tee "$APP_DIR/frontend/package.json" > /dev/null <<PACKAGEJSON
{
  "name": "taskflow-frontend",
  "version": "1.0.0",
  "description": "TaskFlow Frontend Server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
PACKAGEJSON

        # Install npm dependencies
        cd "$APP_DIR/frontend"
        sudo -u taskflow npm install

        # Create simple frontend server
        sudo tee "$APP_DIR/frontend/server.js" > /dev/null <<FRONTENDSERVER
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 666;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/frontend-health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'TaskFlow Frontend', 
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// API proxy for development
app.get('/api/*', (req, res) => {
  res.json({
    message: 'API request should be handled by backend on port 777',
    path: req.path,
    backend: 'http://localhost:777' + req.path
  });
});

// Handle React routing (serve index.html for all routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(\`🎨 TaskFlow Frontend running on port \${PORT}\`);
});
FRONTENDSERVER

        # Create simple HTML frontend
        sudo mkdir -p "$APP_DIR/frontend/public"
        sudo tee "$APP_DIR/frontend/public/index.html" > /dev/null <<HTMLFRONTEND
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TaskFlow - Team Task Tracker</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 { color: #667eea; font-size: 2.5rem; margin-bottom: 10px; }
        .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .status-card {
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .status-card h3 { color: #667eea; margin-bottom: 15px; }
        .status-indicator { 
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .status-ok { background: #10b981; }
        .status-error { background: #ef4444; }
        .btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            margin: 5px;
            transition: transform 0.2s;
        }
        .btn:hover { transform: translateY(-2px); }
        .api-response {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 15px;
            margin-top: 15px;
            font-family: monospace;
            font-size: 14px;
            max-height: 300px;
            overflow-y: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 TaskFlow</h1>
            <p>Team Task Tracker - Demo Version</p>
            <p><strong>Installation Successful!</strong></p>
        </div>

        <div class="status-grid">
            <div class="status-card">
                <h3>🏥 System Health</h3>
                <div id="health-status">
                    <p><span class="status-indicator status-ok"></span>Frontend: Running on port 666</p>
                    <p><span class="status-indicator" id="backend-status"></span>Backend: <span id="backend-text">Checking...</span></p>
                </div>
                <button class="btn" onclick="checkHealth()">Check Health</button>
                <div id="health-response" class="api-response" style="display: none;"></div>
            </div>

            <div class="status-card">
                <h3>📋 Sample Tasks</h3>
                <p>Demo task management functionality</p>
                <button class="btn" onclick="loadTasks()">Load Tasks</button>
                <div id="tasks-response" class="api-response" style="display: none;"></div>
            </div>

            <div class="status-card">
                <h3>👥 Team Data</h3>
                <p>Sample team information</p>
                <button class="btn" onclick="loadTeam()">Load Team</button>
                <div id="team-response" class="api-response" style="display: none;"></div>
            </div>

            <div class="status-card">
                <h3>🔧 System Information</h3>
                <p><strong>Ports:</strong></p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Nginx: 555 (Public)</li>
                    <li>Frontend: 666 (Internal)</li>
                    <li>Backend: 777 (Internal)</li>
                    <li>MongoDB: 27777 (Internal)</li>
                    <li>Redis: 6777 (Internal)</li>
                </ul>
                <p><strong>Access:</strong> http://your-server:555</p>
            </div>
        </div>

        <div class="status-card">
            <h3>📚 Next Steps</h3>
            <ol style="margin: 15px 0; padding-left: 25px; line-height: 1.6;">
                <li>Check all services are running: <code>./status.sh</code></li>
                <li>Run health check: <code>./health-check.sh</code></li>
                <li>View logs: <code>tail -f /opt/taskflow/logs/app/backend.log</code></li>
                <li>Access the application at: <strong>http://your-server-ip:555</strong></li>
                <li>Deploy your custom code by replacing the demo application</li>
            </ol>
        </div>
    </div>

    <script>
        async function checkHealth() {
            const healthDiv = document.getElementById('health-response');
            const backendStatus = document.getElementById('backend-status');
            const backendText = document.getElementById('backend-text');
            
            healthDiv.style.display = 'block';
            healthDiv.innerHTML = 'Checking backend health...';
            
            try {
                const response = await fetch('/api/v1/health', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    backendStatus.className = 'status-indicator status-ok';
                    backendText.textContent = \`Running on port \${data.port}\`;
                    healthDiv.innerHTML = \`<strong>✅ Backend Health:</strong>\\n\${JSON.stringify(data, null, 2)}\`;
                } else {
                    throw new Error(\`HTTP \${response.status}\`);
                }
            } catch (error) {
                backendStatus.className = 'status-indicator status-error';
                backendText.textContent = 'Connection failed';
                healthDiv.innerHTML = \`<strong>❌ Backend Error:</strong>\\n\${error.message}\`;
            }
        }

        async function loadTasks() {
            const tasksDiv = document.getElementById('tasks-response');
            tasksDiv.style.display = 'block';
            tasksDiv.innerHTML = 'Loading tasks...';
            
            try {
                const response = await fetch('/api/v1/tasks');
                const data = await response.json();
                tasksDiv.innerHTML = \`<strong>📋 Tasks (\${data.total}):</strong>\\n\${JSON.stringify(data, null, 2)}\`;
            } catch (error) {
                tasksDiv.innerHTML = \`<strong>❌ Error:</strong>\\n\${error.message}\`;
            }
        }

        async function loadTeam() {
            const teamDiv = document.getElementById('team-response');
            teamDiv.style.display = 'block';
            teamDiv.innerHTML = 'Loading team data...';
            
            try {
                const response = await fetch('/api/v1/team');
                const data = await response.json();
                teamDiv.innerHTML = \`<strong>👥 Team (\${data.total} members):</strong>\\n\${JSON.stringify(data, null, 2)}\`;
            } catch (error) {
                teamDiv.innerHTML = \`<strong>❌ Error:</strong>\\n\${error.message}\`;
            }
        }

        // Auto-check health on load
        window.onload = function() {
            setTimeout(checkHealth, 1000);
        };
    </script>
</body>
</html>
HTMLFRONTEND
        ;;
        
    2)
        echo "📁 Deploying from local source code..."
        echo "Please ensure your source code is in the current directory with:"
        echo "  - backend/ (Go source code)"
        echo "  - frontend/ (React source code)"
        read -p "Continue? (y/n): " confirm
        
        if [ "$confirm" != "y" ]; then
            echo "Deployment cancelled"
            exit 1
        fi
        
        if [ -d "backend" ]; then
            echo "🔧 Building Go backend..."
            cd backend
            export PATH=$PATH:/usr/local/go/bin
            export GOPATH=/opt/taskflow/go
            go mod tidy
            go build -o "../taskflow-backend" cmd/server/main.go || go build -o "../taskflow-backend" main.go
            sudo cp "../taskflow-backend" "$APP_DIR/backend/"
            cd ..
        else
            echo "❌ backend/ directory not found"
            exit 1
        fi
        
        if [ -d "frontend" ]; then
            echo "🎨 Building React frontend..."
            cd frontend
            npm ci
            npm run build
            sudo cp -r dist/* "$APP_DIR/frontend/public/"
            cd ..
        else
            echo "❌ frontend/ directory not found"
            exit 1
        fi
        ;;
        
    3)
        echo "📦 Deploying from Git repository..."
        read -p "Enter Git repository URL: " REPO_URL
        
        if [ -z "$REPO_URL" ]; then
            echo "❌ Repository URL required"
            exit 1
        fi
        
        echo "📥 Cloning repository..."
        cd /tmp
        rm -rf taskflow-source
        git clone "$REPO_URL" taskflow-source
        cd taskflow-source
        
        # Build backend
        if [ -d "backend" ]; then
            echo "🔧 Building Go backend..."
            cd backend
            export PATH=$PATH:/usr/local/go/bin
            export GOPATH=/opt/taskflow/go
            go mod tidy
            go build -o taskflow-backend cmd/server/main.go || go build -o taskflow-backend main.go
            sudo cp taskflow-backend "$APP_DIR/backend/"
            cd ..
        fi
        
        # Build frontend
        if [ -d "frontend" ]; then
            echo "🎨 Building React frontend..."
            cd frontend
            npm ci
            npm run build
            sudo mkdir -p "$APP_DIR/frontend/public"
            sudo cp -r dist/* "$APP_DIR/frontend/public/"
            cd ..
        fi
        ;;
        
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

# Set permissions
echo "🔒 Setting permissions..."
sudo chown -R taskflow:taskflow "$APP_DIR"
sudo chmod +x "$APP_DIR/backend/taskflow-backend" 2>/dev/null || true

# Start services
echo "▶️ Starting services..."
if [ -f "$SCRIPTS_DIR/start-all.sh" ]; then
    sudo -u taskflow "$SCRIPTS_DIR/start-all.sh"
else
    sudo systemctl start taskflow-mongodb
    sudo systemctl start taskflow-redis
    sleep 5
    sudo systemctl start taskflow-backend
    sudo systemctl start taskflow-frontend
    sudo systemctl start taskflow-nginx
fi

# Health check
echo "🏥 Running health check..."
sleep 10

for i in {1..5}; do
    if curl -f http://localhost:555 > /dev/null 2>&1; then
        echo "✅ Application is responding"
        break
    else
        echo "⏳ Waiting for application... ($i/5)"
        sleep 10
    fi
done

# Clean old backups (keep last 5)
find "$BACKUP_DIR" -type d -name "deploy-backup-*" | sort | head -n -5 | xargs rm -rf 2>/dev/null || true

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "🌐 Access URLs:"
echo "  Main Application: http://$(hostname -I | awk '{print $1}'):555"
echo "  Health Check: http://localhost:777/health"
echo ""
echo "📊 Check status with: ./status.sh"
echo "🏥 Health check with: ./health-check.sh"
echo "📝 View logs: tail -f /opt/taskflow/logs/app/backend.log"
