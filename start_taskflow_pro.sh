#!/bin/bash

# TaskFlow Pro Startup Script
echo "🚀 Starting TaskFlow Pro..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Checking dependencies...${NC}"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📥 Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📝 Creating .env file...${NC}"
    cat > .env << EOL
# TaskFlow Pro Configuration
PORT=777
NODE_ENV=development

# App Configuration
APP_URL=http://localhost:777

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_REQUESTS=100

# ClickUp Integration (Optional)
CLICKUP_CLIENT_ID=your_clickup_client_id
CLICKUP_CLIENT_SECRET=your_clickup_client_secret
CLICKUP_REDIRECT_URI=http://localhost:777/api/v1/auth/clickup/callback

# Redis Configuration (Optional)
# REDIS_URL=redis://localhost:6379
# REDIS_PASSWORD=your_redis_password

# Security
JWT_SECRET=your_jwt_secret_key_here
ENCRYPTION_KEY=your_encryption_key_here
EOL
    echo -e "${GREEN}✅ .env file created${NC}"
fi

# Stop any existing server on port 777
echo -e "${YELLOW}🔍 Checking for existing server on port 777...${NC}"
if lsof -ti:777 > /dev/null 2>&1; then
    echo -e "${YELLOW}🛑 Stopping existing server on port 777...${NC}"
    lsof -ti:777 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Function to start server
start_server() {
    local backend_file=$1
    local description=$2
    
    echo -e "${BLUE}🚀 Starting $description...${NC}"
    echo -e "${BLUE}📡 Server will be available at: http://localhost:777${NC}"
    echo -e "${BLUE}💻 TaskFlow Pro Interface: http://localhost:777/${NC}"
    echo -e "${BLUE}🔙 Legacy Interface: http://localhost:777/legacy${NC}"
    echo -e "${BLUE}🏥 Health Check: http://localhost:777/health${NC}"
    echo ""
    echo -e "${GREEN}Press Ctrl+C to stop the server${NC}"
    echo ""
    
    # Start the server
    node $backend_file
}

# Check which backend file to use
if [ -f "backend_taskflow_pro.js" ]; then
    start_server "backend_taskflow_pro.js" "TaskFlow Pro Backend"
elif [ -f "backend.js" ]; then
    echo -e "${YELLOW}⚠️  TaskFlow Pro backend not found, using legacy backend...${NC}"
    start_server "backend.js" "Legacy Backend"
else
    echo -e "${RED}❌ No backend file found!${NC}"
    echo -e "${YELLOW}Available options:${NC}"
    echo "  - backend_taskflow_pro.js (TaskFlow Pro)"
    echo "  - backend.js (Legacy)"
    exit 1
fi
