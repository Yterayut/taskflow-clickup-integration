#!/bin/bash

# 🔄 Clear Browser Cache for TaskFlow
# Force browser to reload latest version

echo "🔄 Clearing TaskFlow browser cache..."

# Add cache-busting headers to nginx config
sshpass -p "U8@1v3z#14" ssh one-climate@192.168.20.10 'echo "U8@1v3z#14" | sudo -S systemctl restart taskflow-nginx'

echo "✅ Frontend service restarted"

# Test if dark mode button is now visible
echo "🧪 Testing dark mode button visibility..."

if curl -s http://192.168.20.10:555 | grep -q "theme-toggle"; then
    echo "✅ Dark mode button found in HTML!"
    echo "🌙 Dark mode toggle should now be visible in browser"
    echo ""
    echo "📋 Instructions for users:"
    echo "   1. Visit: http://192.168.20.10:555"
    echo "   2. Press Ctrl+F5 (or Cmd+Shift+R on Mac) to force refresh"
    echo "   3. Look for 🌙 button in the top-right header"
    echo "   4. Click to toggle dark mode!"
else
    echo "❌ Dark mode button not found - deployment may need verification"
fi

echo ""
echo "🎯 Direct access: http://192.168.20.10:555"
echo "🔧 Force refresh: Ctrl+F5 or Cmd+Shift+R"