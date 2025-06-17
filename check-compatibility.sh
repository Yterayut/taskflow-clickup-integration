#!/bin/bash
# check-compatibility.sh

echo "🔍 Checking system compatibility..."

# Check existing ports
check_port() {
    if netstat -tuln | grep -q ":$1 "; then
        echo "❌ Port $1 is already in use"
        netstat -tuln | grep ":$1 "
        return 1
    else
        echo "✅ Port $1 is available"
        return 0
    fi
}

# Check required ports
PORTS=(555 666 777 27777 6777)
ALL_AVAILABLE=true

for port in "${PORTS[@]}"; do
    if ! check_port $port; then
        ALL_AVAILABLE=false
    fi
done

# Check existing services
echo ""
echo "🔍 Checking for service conflicts..."

if systemctl list-units --type=service | grep -q "nginx"; then
    echo "⚠️ Nginx service detected - we'll use custom instance"
fi

if systemctl list-units --type=service | grep -q "mongod"; then
    echo "⚠️ MongoDB service detected - we'll create separate instance"
fi

if systemctl list-units --type=service | grep -q "redis"; then
    echo "⚠️ Redis service detected - we'll create separate instance"
fi

# Check disk space
AVAILABLE_SPACE=$(df /opt 2>/dev/null | awk 'NR==2{print $4}' || df / | awk 'NR==2{print $4}')
REQUIRED_SPACE=5242880  # 5GB in KB

if [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
    echo "❌ Insufficient disk space. Required: 5GB, Available: $((AVAILABLE_SPACE/1024/1024))GB"
    ALL_AVAILABLE=false
else
    echo "✅ Sufficient disk space available"
fi

if [ "$ALL_AVAILABLE" = true ]; then
    echo ""
    echo "✅ All compatibility checks passed!"
    echo "🚀 Ready to install TaskFlow"
    exit 0
else
    echo ""
    echo "❌ Compatibility issues found. Please resolve before installation."
    exit 1
fi
