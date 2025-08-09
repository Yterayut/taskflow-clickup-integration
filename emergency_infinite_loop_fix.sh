#!/bin/bash
# EMERGENCY FIX FOR INFINITE LOOP
# Target: /var/www/taskflow/index.html line 2699

echo "🚨 EMERGENCY INFINITE LOOP FIX - Starting..."

# BACKUP ORIGINAL
ssh one-climate@192.168.20.10 "cp /var/www/taskflow/index.html /var/www/taskflow/index.html.backup-emergency-$(date +%Y%m%d_%H%M%S)"

# FIX INFINITE LOOP: Comment out recursive loadComponentData call
ssh one-climate@192.168.20.10 "sed -i '2699s/.*/            \/\/ EMERGENCY FIX: Prevent infinite loop - REMOVED loadComponentData(currentView);/' /var/www/taskflow/index.html"

# VERIFY FIX APPLIED
ssh one-climate@192.168.20.10 "sed -n '2695,2705p' /var/www/taskflow/index.html"

echo "✅ EMERGENCY FIX APPLIED - Infinite loop stopped"
echo "🔄 Browser refresh required to take effect"
echo "⚠️  Note: Full circuit breaker implementation needed next"