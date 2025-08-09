#!/bin/bash

# TaskFlow Pro - Auto Start Session Save System
# Run this at the beginning of each Claude session

echo "🚀 TaskFlow Pro - Auto Session Save Startup"
echo "==========================================="

# Set environment variable to help detection
export CLAUDE_CODE_SESSION=true

# Start auto monitor
echo "🤖 Starting automatic session monitoring..."
./auto_session_monitor.sh start

# Show status
echo ""
echo "📊 System Status:"
./auto_session_monitor.sh status

echo ""
echo "✅ Auto Save System Active!"
echo "🔍 The system will automatically:"
echo "   • Monitor context usage"
echo "   • Save session at 85% usage"
echo "   • Create emergency handover message"
echo "   • Show desktop notification"
echo ""
echo "📋 Manual Commands:"
echo "   • Check status: ./auto_session_monitor.sh status"
echo "   • View log: ./auto_session_monitor.sh log"
echo "   • Force save: ./auto_session_monitor.sh force-save"
echo "   • Stop monitor: ./auto_session_monitor.sh stop"
echo ""
echo "🎯 You can now work normally - auto save will handle the rest!"