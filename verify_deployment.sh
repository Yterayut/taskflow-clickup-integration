#!/bin/bash
echo "🔍 TaskFlow Pro - Deployment Verification"
echo "========================================"
echo ""

echo "📡 Testing server connectivity..."
if ping -c 1 192.168.20.10 >/dev/null 2>&1; then
    echo "✅ Server reachable"
else
    echo "❌ Server unreachable"
    exit 1
fi

echo ""
echo "🔧 Testing backend service..."
BACKEND_STATUS=$(curl -s "http://192.168.20.10:7812/health" | jq -r '.status // "error"' 2>/dev/null || echo "unreachable")
if [ "$BACKEND_STATUS" = "healthy" ] || [ "$BACKEND_STATUS" = "ok" ]; then
    echo "✅ Backend: $BACKEND_STATUS"
    
    # Test authentication endpoint
    AUTH_TEST=$(curl -s -w "%{http_code}" "http://192.168.20.10:7812/api/v2/auth/profile" -o /dev/null)
    if [ "$AUTH_TEST" = "401" ] || [ "$AUTH_TEST" = "200" ]; then
        echo "✅ Authentication endpoint: responding ($AUTH_TEST)"
    else
        echo "⚠️ Authentication endpoint: unexpected response ($AUTH_TEST)"
    fi
else
    echo "❌ Backend: $BACKEND_STATUS"
fi

echo ""
echo "🌐 Testing frontend service..."
FRONTEND_STATUS=$(curl -s -w "%{http_code}" "http://192.168.20.10:8888/" -o /dev/null 2>/dev/null || echo "000")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✅ Frontend: accessible (HTTP $FRONTEND_STATUS)"
else
    echo "❌ Frontend: inaccessible (HTTP $FRONTEND_STATUS)"
fi

echo ""
echo "📊 System Status Summary:"
if [ "$BACKEND_STATUS" = "healthy" ] && [ "$FRONTEND_STATUS" = "200" ]; then
    echo "🎉 ✅ ALL SYSTEMS OPERATIONAL"
    echo ""
    echo "🔗 Access URLs:"
    echo "   Frontend: http://192.168.20.10:8888/"
    echo "   Backend API: http://192.168.20.10:7812/"
    echo "   Health Check: http://192.168.20.10:7812/health"
else
    echo "🚨 ❌ SYSTEM ISSUES DETECTED"
    echo "   Check server status and redeploy if necessary"
fi
