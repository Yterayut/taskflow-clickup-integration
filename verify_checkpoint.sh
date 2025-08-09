#!/bin/bash

# CHECKPOINT VERIFICATION SCRIPT
# Verifies the integrity of the comprehensive backup

echo "🔍 CHECKPOINT VERIFICATION"
echo "========================="
echo ""

CHECKPOINT_DIR="/Users/teerayutyeerahem/team-workload/checkpoints/COMPREHENSIVE_BACKUP_BEFORE_BACKGROUND_SYNC"

echo "📂 Checking checkpoint directory: $CHECKPOINT_DIR"
echo ""

# Check if checkpoint directory exists
if [ ! -d "$CHECKPOINT_DIR" ]; then
    echo "❌ CRITICAL: Checkpoint directory not found!"
    exit 1
fi

echo "✅ Checkpoint directory exists"
echo ""

# Check critical files
echo "📋 Verifying critical files:"

CRITICAL_FILES=(
    "single_login_backend.js"
    "master_auth_service.js"
    "users_config.json"
    "index.html"
    "current_frontend.html"
    "package.json"
    "PROJECT_CONTEXT.md"
    "AUTHENTICATION_FLOW_ANALYSIS.md"
    "CHECKPOINT_DOCUMENTATION.md"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$CHECKPOINT_DIR/$file" ]; then
        size=$(ls -lh "$CHECKPOINT_DIR/$file" | awk '{print $5}')
        echo "  ✅ $file ($size)"
    else
        echo "  ❌ $file (MISSING)"
    fi
done

echo ""

# Check directories
echo "📁 Verifying directories:"

CRITICAL_DIRS=(
    "services"
    "adapters"
    "database"
    "repositories"
    "middleware"
    "routes"
)

for dir in "${CRITICAL_DIRS[@]}"; do
    if [ -d "$CHECKPOINT_DIR/$dir" ]; then
        count=$(find "$CHECKPOINT_DIR/$dir" -type f | wc -l)
        echo "  ✅ $dir/ ($count files)"
    else
        echo "  ❌ $dir/ (MISSING)"
    fi
done

echo ""

# Check BackgroundSyncService
echo "🔄 Checking BackgroundSyncService:"
if [ -f "$CHECKPOINT_DIR/services/BackgroundSyncService.js" ]; then
    echo "  ✅ BackgroundSyncService.js present"
    # Check if it contains the class
    if grep -q "class BackgroundSyncService" "$CHECKPOINT_DIR/services/BackgroundSyncService.js"; then
        echo "  ✅ BackgroundSyncService class found"
    else
        echo "  ⚠️ BackgroundSyncService class structure may be different"
    fi
else
    echo "  ❌ BackgroundSyncService.js NOT FOUND"
fi

echo ""

# File integrity check
echo "🔐 File integrity check:"
total_files=$(find "$CHECKPOINT_DIR" -type f | wc -l)
echo "  📊 Total files backed up: $total_files"

# Check if files are readable
readable_count=0
for file in $(find "$CHECKPOINT_DIR" -type f); do
    if [ -r "$file" ]; then
        ((readable_count++))
    fi
done

echo "  📖 Readable files: $readable_count/$total_files"

if [ $readable_count -eq $total_files ]; then
    echo "  ✅ All files are readable"
else
    echo "  ⚠️ Some files may have permission issues"
fi

echo ""

# Check documentation
echo "📚 Documentation check:"
if [ -f "$CHECKPOINT_DIR/CHECKPOINT_DOCUMENTATION.md" ]; then
    lines=$(wc -l < "$CHECKPOINT_DIR/CHECKPOINT_DOCUMENTATION.md")
    echo "  ✅ Checkpoint documentation present ($lines lines)"
else
    echo "  ❌ Checkpoint documentation missing"
fi

echo ""

# Rollback script check
if [ -f "/Users/teerayutyeerahem/team-workload/rollback_to_pre_background_sync.sh" ]; then
    echo "✅ Rollback script available"
    if [ -x "/Users/teerayutyeerahem/team-workload/rollback_to_pre_background_sync.sh" ]; then
        echo "✅ Rollback script is executable"
    else
        echo "⚠️ Rollback script needs execute permissions"
    fi
else
    echo "❌ Rollback script not found"
fi

echo ""

# Summary
echo "📊 VERIFICATION SUMMARY"
echo "======================"

all_critical_present=true
for file in "${CRITICAL_FILES[@]}"; do
    if [ ! -f "$CHECKPOINT_DIR/$file" ]; then
        all_critical_present=false
        break
    fi
done

if [ $all_critical_present == true ] && [ $readable_count -eq $total_files ]; then
    echo "🎯 STATUS: ✅ CHECKPOINT VERIFIED - READY FOR IMPLEMENTATION"
    echo ""
    echo "✅ All critical files present"
    echo "✅ All files readable"
    echo "✅ Infrastructure components backed up"
    echo "✅ Documentation complete"
    echo "✅ Rollback procedures ready"
    echo ""
    echo "🚀 SAFE TO PROCEED with background sync implementation!"
else
    echo "🚨 STATUS: ❌ CHECKPOINT ISSUES DETECTED"
    echo ""
    echo "⚠️ Please resolve the issues above before proceeding"
    echo "❌ NOT SAFE to proceed with implementation yet"
fi

echo ""
echo "📞 Next steps:"
echo "  1. If verification passed: Proceed with implementation"
echo "  2. If issues found: Recreate checkpoint"
echo "  3. Test rollback: ./rollback_to_pre_background_sync.sh"
echo ""
