#!/bin/bash

# TaskFlow Pro Phase 3 - Pre-deployment Testing Script
# Test all systems before production deployment

echo "🧪 TaskFlow Pro Phase 3 - Pre-deployment Testing"
echo "================================================="
echo "Testing local system before production deployment"
echo "Date: $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "🔍 Testing $test_name... "
    
    result=$(eval $test_command 2>/dev/null)
    
    if echo "$result" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo "   Expected: $expected_pattern"
        echo "   Got: $result"
        return 1
    fi
}

echo "📊 System Health Tests"
echo "---------------------"

# Test 1: Backend Health
run_test "Backend Health" "curl -s http://localhost:7812/health | jq -r '.status'" "OK"

# Test 2: Backend Version
run_test "Backend Version" "curl -s http://localhost:7812/health | jq -r '.version'" "7.0.0-phase3-realtime"

# Test 3: Background Sync
run_test "Background Sync" "curl -s http://localhost:7812/health | jq -r '.background_sync.isRunning'" "true"

echo ""
echo "🚀 Phase 3 Services Tests"
echo "-------------------------"

# Test 4: Phase 3 Health
run_test "Phase 3 Health" "curl -s http://localhost:7812/api/v3/health | jq -r '.status'" "healthy"

# Test 5: WebSocket Service
run_test "WebSocket Service" "curl -s http://localhost:7812/api/v3/websocket/status | jq -r '.success'" "true"

# Test 6: Real-time Analytics
run_test "Real-time Analytics" "curl -s http://localhost:7812/api/v3/analytics/realtime | jq -r '.success'" "true"

# Test 7: Advanced Cache
run_test "Advanced Cache" "curl -s http://localhost:7812/api/v3/cache/advanced/status | jq -r '.success'" "true"

echo ""
echo "🔐 Authentication Tests"
echo "-----------------------"

# Test 8: Authentication Endpoint
run_test "Auth Endpoint" "curl -s -X POST http://localhost:7812/api/v2/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"chaiwutwck@gmail.com\",\"password\":\"12345\"}' | jq -r '.success'" "true"

# Test 9: Dashboard Analytics  
AUTH_COOKIE=$(curl -s -c /tmp/test_cookies.txt -X POST http://localhost:7812/api/v2/auth/login -H 'Content-Type: application/json' -d '{"email":"chaiwutwck@gmail.com","password":"12345"}' > /dev/null 2>&1)
run_test "Dashboard Analytics" "curl -s -b /tmp/test_cookies.txt http://localhost:7812/api/v2/dashboard/analytics | jq -r '.success'" "true"

echo ""
echo "📡 Real-time Features Tests"
echo "---------------------------"

# Test 10: Phase 3 Dashboard Access
run_test "Phase 3 Dashboard" "curl -s -I http://localhost:7812/phase3 | head -1" "200 OK"

# Test 11: Socket.IO Library
run_test "Socket.IO Library" "curl -s -I http://localhost:7812/socket.io/socket.io.js | head -1" "200 OK"

echo ""
echo "⚡ Performance Tests"
echo "-------------------"

# Test 12: API Response Time
start_time=$(date +%s%3N)
curl -s http://localhost:7812/health > /dev/null
end_time=$(date +%s%3N)
response_time=$((end_time - start_time))

TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo -n "🔍 Testing API Response Time... "
if [ $response_time -lt 100 ]; then
    echo -e "${GREEN}✅ PASS${NC} (${response_time}ms)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️ SLOW${NC} (${response_time}ms)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""
echo "🔄 Background Services Tests"  
echo "----------------------------"

# Test 13: Sync Status
run_test "Sync Service Status" "curl -s http://localhost:7812/api/v2/sync/status | jq -r '.success'" "true"

# Test 14: Manual Sync Trigger
run_test "Manual Sync" "curl -s -X POST http://localhost:7812/api/v2/sync/manual | jq -r '.success'" "true"

echo ""
echo "📊 Test Results Summary"
echo "======================"

echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
echo "Success Rate: $SUCCESS_RATE%"

echo ""
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED - READY FOR PRODUCTION DEPLOYMENT!${NC}"
    echo ""
    echo "✅ System Status: EXCELLENT"
    echo "✅ Phase 3 Services: OPERATIONAL"  
    echo "✅ Authentication: WORKING"
    echo "✅ Performance: OPTIMAL"
    echo "✅ Real-time Features: FUNCTIONAL"
    echo ""
    echo "🚀 Ready to run: ./deploy_phase3_production.sh"
    exit 0
elif [ $FAILED_TESTS -le 2 ]; then
    echo -e "${YELLOW}⚠️ MINOR ISSUES DETECTED - DEPLOYMENT POSSIBLE WITH CAUTION${NC}"
    echo ""
    echo "⚠️ $FAILED_TESTS tests failed, but system is largely functional"
    echo "📋 Review failed tests before deployment"
    echo "🚀 Consider deployment with monitoring"
    exit 1
else
    echo -e "${RED}❌ MULTIPLE FAILURES - DEPLOYMENT NOT RECOMMENDED${NC}"
    echo ""
    echo "❌ $FAILED_TESTS tests failed - significant issues detected"
    echo "🔧 Fix issues before attempting deployment"
    echo "📞 Review system logs and configuration"
    exit 2
fi

# Cleanup
rm -f /tmp/test_cookies.txt