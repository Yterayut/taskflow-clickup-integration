#!/bin/bash

# TaskFlow Pro - Compare Checkpoints Script
# Compares two checkpoints to show differences

echo "🔍 TaskFlow Pro - Compare Checkpoints"
echo "====================================="
echo ""

# Check if checkpoint names provided
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "❌ Error: Please provide two checkpoint names to compare"
    echo ""
    echo "Usage: $0 <checkpoint1> <checkpoint2>"
    echo ""
    echo "📋 Available checkpoints:"
    ./list_checkpoints.sh 2>/dev/null | grep "📦" | head -10
    exit 1
fi

CHECKPOINT1="$1"
CHECKPOINT2="$2"

# Configuration
SERVER_USER="one-climate"
SERVER_HOST="192.168.20.10"
SERVER_PASSWORD="U8@1v3z#14"
SERVER_PATH="/home/one-climate/team-workload"

echo "📋 Comparison Configuration:"
echo "  Server: $SERVER_USER@$SERVER_HOST"
echo "  Checkpoint 1: $CHECKPOINT1"
echo "  Checkpoint 2: $CHECKPOINT2"
echo ""

# Function to run SSH commands
run_ssh_command() {
    sshpass -p "$SERVER_PASSWORD" ssh "$SERVER_USER@$SERVER_HOST" "$1"
}

# Verify both checkpoints exist
echo "🔍 Verifying checkpoints exist..."

CHECKPOINT1_EXISTS=$(run_ssh_command "cd $SERVER_PATH && [ -d checkpoints/$CHECKPOINT1 ] && echo 'YES' || echo 'NO'")
CHECKPOINT2_EXISTS=$(run_ssh_command "cd $SERVER_PATH && [ -d checkpoints/$CHECKPOINT2 ] && echo 'YES' || echo 'NO'")

if [ "$CHECKPOINT1_EXISTS" != "YES" ]; then
    echo "❌ Error: Checkpoint '$CHECKPOINT1' not found"
    exit 1
fi

if [ "$CHECKPOINT2_EXISTS" != "YES" ]; then
    echo "❌ Error: Checkpoint '$CHECKPOINT2' not found"
    exit 1
fi

echo "✅ Both checkpoints found"
echo ""

# Create comparison report
COMPARISON_REPORT="comparison_${CHECKPOINT1}_vs_${CHECKPOINT2}_$(date +%Y%m%d_%H%M%S).txt"

cat > "$COMPARISON_REPORT" << EOF
TaskFlow Pro - Checkpoint Comparison Report
===========================================
Comparison Date: $(date)
Server: $SERVER_HOST:$SERVER_PATH
Checkpoint 1: $CHECKPOINT1
Checkpoint 2: $CHECKPOINT2

EOF

# Compare checkpoint metadata
echo "📊 Comparing checkpoint metadata..."

# Get checkpoint info
CHECKPOINT1_INFO=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$CHECKPOINT1 && [ -f checkpoint_info.txt ] && cat checkpoint_info.txt || echo 'No info available'")
CHECKPOINT2_INFO=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$CHECKPOINT2 && [ -f checkpoint_info.txt ] && cat checkpoint_info.txt || echo 'No info available'")

# Get creation dates
CHECKPOINT1_DATE=$(echo "$CHECKPOINT1_INFO" | grep "Created:" | cut -d':' -f2- | xargs 2>/dev/null || echo "Unknown")
CHECKPOINT2_DATE=$(echo "$CHECKPOINT2_INFO" | grep "Created:" | cut -d':' -f2- | xargs 2>/dev/null || echo "Unknown")

# Get sizes
CHECKPOINT1_SIZE=$(run_ssh_command "cd $SERVER_PATH/checkpoints && du -sh $CHECKPOINT1 2>/dev/null | cut -f1 || echo 'Unknown'")
CHECKPOINT2_SIZE=$(run_ssh_command "cd $SERVER_PATH/checkpoints && du -sh $CHECKPOINT2 2>/dev/null | cut -f1 || echo 'Unknown'")

echo "📅 Checkpoint 1 ($CHECKPOINT1):"
echo "   Created: $CHECKPOINT1_DATE"
echo "   Size: $CHECKPOINT1_SIZE"
echo ""
echo "📅 Checkpoint 2 ($CHECKPOINT2):"
echo "   Created: $CHECKPOINT2_DATE"
echo "   Size: $CHECKPOINT2_SIZE"
echo ""

# Add metadata to report
cat >> "$COMPARISON_REPORT" << EOF
Checkpoint Metadata Comparison:
==============================

Checkpoint 1 ($CHECKPOINT1):
- Created: $CHECKPOINT1_DATE
- Size: $CHECKPOINT1_SIZE

Checkpoint 2 ($CHECKPOINT2):
- Created: $CHECKPOINT2_DATE
- Size: $CHECKPOINT2_SIZE

EOF

# Compare file lists
echo "📁 Comparing file lists..."

CHECKPOINT1_FILES=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$CHECKPOINT1 && ls -la | tail -n +2")
CHECKPOINT2_FILES=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$CHECKPOINT2 && ls -la | tail -n +2")

echo "Files in $CHECKPOINT1:" >> "$COMPARISON_REPORT"
echo "$CHECKPOINT1_FILES" >> "$COMPARISON_REPORT"
echo "" >> "$COMPARISON_REPORT"
echo "Files in $CHECKPOINT2:" >> "$COMPARISON_REPORT"
echo "$CHECKPOINT2_FILES" >> "$COMPARISON_REPORT"
echo "" >> "$COMPARISON_REPORT"

# Compare specific files
echo "🔧 Comparing specific files..."
echo ""

# Compare backend files
echo "Backend Comparison:" >> "$COMPARISON_REPORT"
echo "==================" >> "$COMPARISON_REPORT"

BACKEND1_EXISTS=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$CHECKPOINT1 && [ -f backend_comprehensive_enhanced.js ] && echo 'YES' || [ -f backend*.js ] && echo 'DIFFERENT' || echo 'NO'")
BACKEND2_EXISTS=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$CHECKPOINT2 && [ -f backend_comprehensive_enhanced.js ] && echo 'YES' || [ -f backend*.js ] && echo 'DIFFERENT' || echo 'NO'")

echo "🔧 Backend Files:"
echo "  $CHECKPOINT1: $([ "$BACKEND1_EXISTS" = "YES" ] && echo "✅ backend_comprehensive_enhanced.js" || [ "$BACKEND1_EXISTS" = "DIFFERENT" ] && echo "⚠️ Different backend file" || echo "❌ No backend file")"
echo "  $CHECKPOINT2: $([ "$BACKEND2_EXISTS" = "YES" ] && echo "✅ backend_comprehensive_enhanced.js" || [ "$BACKEND2_EXISTS" = "DIFFERENT" ] && echo "⚠️ Different backend file" || echo "❌ No backend file")"

if [ "$BACKEND1_EXISTS" = "YES" ] && [ "$BACKEND2_EXISTS" = "YES" ]; then
    # Compare backend file sizes and modification times
    BACKEND1_INFO=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$CHECKPOINT1 && ls -la backend_comprehensive_enhanced.js")
    BACKEND2_INFO=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$CHECKPOINT2 && ls -la backend_comprehensive_enhanced.js")
    
    echo "  Size & Date Comparison:"
    echo "    $CHECKPOINT1: $(echo "$BACKEND1_INFO" | awk '{print $5, $6, $7, $8}')"
    echo "    $CHECKPOINT2: $(echo "$BACKEND2_INFO" | awk '{print $5, $6, $7, $8}')"
    
    # Check if files are identical
    BACKEND_DIFF=$(run_ssh_command "cd $SERVER_PATH/checkpoints && diff $CHECKPOINT1/backend_comprehensive_enhanced.js $CHECKPOINT2/backend_comprehensive_enhanced.js | wc -l")
    
    if [ "$BACKEND_DIFF" = "0" ]; then
        echo "  📄 Content: ✅ Identical"
        echo "Backend files: Identical" >> "$COMPARISON_REPORT"
    else
        echo "  📄 Content: ⚠️ Different ($BACKEND_DIFF lines differ)"
        echo "Backend files: Different ($BACKEND_DIFF lines differ)" >> "$COMPARISON_REPORT"
    fi
fi

echo ""

# Compare frontend files
echo "🌐 Frontend Files:"
FRONTEND1_EXISTS=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$CHECKPOINT1 && [ -f index.html ] && echo 'YES' || echo 'NO'")
FRONTEND2_EXISTS=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$CHECKPOINT2 && [ -f index.html ] && echo 'YES' || echo 'NO'")

echo "  $CHECKPOINT1: $([ "$FRONTEND1_EXISTS" = "YES" ] && echo "✅ index.html" || echo "❌ No index.html")"
echo "  $CHECKPOINT2: $([ "$FRONTEND2_EXISTS" = "YES" ] && echo "✅ index.html" || echo "❌ No index.html")"

if [ "$FRONTEND1_EXISTS" = "YES" ] && [ "$FRONTEND2_EXISTS" = "YES" ]; then
    # Compare frontend file sizes
    FRONTEND1_INFO=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$CHECKPOINT1 && ls -la index.html")
    FRONTEND2_INFO=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$CHECKPOINT2 && ls -la index.html")
    
    echo "  Size & Date Comparison:"
    echo "    $CHECKPOINT1: $(echo "$FRONTEND1_INFO" | awk '{print $5, $6, $7, $8}')"
    echo "    $CHECKPOINT2: $(echo "$FRONTEND2_INFO" | awk '{print $5, $6, $7, $8}')"
    
    # Check if files are identical
    FRONTEND_DIFF=$(run_ssh_command "cd $SERVER_PATH/checkpoints && diff $CHECKPOINT1/index.html $CHECKPOINT2/index.html | wc -l")
    
    if [ "$FRONTEND_DIFF" = "0" ]; then
        echo "  📄 Content: ✅ Identical"
        echo "Frontend files: Identical" >> "$COMPARISON_REPORT"
    else
        echo "  📄 Content: ⚠️ Different ($FRONTEND_DIFF lines differ)"
        echo "Frontend files: Different ($FRONTEND_DIFF lines differ)" >> "$COMPARISON_REPORT"
    fi
fi

echo ""

# Compare package.json if exists
echo "📦 Configuration Files:"
PACKAGE1_EXISTS=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$CHECKPOINT1 && [ -f package.json ] && echo 'YES' || echo 'NO'")
PACKAGE2_EXISTS=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$CHECKPOINT2 && [ -f package.json ] && echo 'YES' || echo 'NO'")

echo "  $CHECKPOINT1: $([ "$PACKAGE1_EXISTS" = "YES" ] && echo "✅ package.json" || echo "❌ No package.json")"
echo "  $CHECKPOINT2: $([ "$PACKAGE2_EXISTS" = "YES" ] && echo "✅ package.json" || echo "❌ No package.json")"

if [ "$PACKAGE1_EXISTS" = "YES" ] && [ "$PACKAGE2_EXISTS" = "YES" ]; then
    PACKAGE_DIFF=$(run_ssh_command "cd $SERVER_PATH/checkpoints && diff $CHECKPOINT1/package.json $CHECKPOINT2/package.json | wc -l")
    
    if [ "$PACKAGE_DIFF" = "0" ]; then
        echo "  📄 Content: ✅ Identical"
        echo "Package.json: Identical" >> "$COMPARISON_REPORT"
    else
        echo "  📄 Content: ⚠️ Different ($PACKAGE_DIFF lines differ)"
        echo "Package.json: Different ($PACKAGE_DIFF lines differ)" >> "$COMPARISON_REPORT"
    fi
fi

echo ""

# Compare health check data if available
echo "🏥 Health Check Comparison:"
HEALTH1_EXISTS=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$CHECKPOINT1 && [ -f health_check.json ] && echo 'YES' || echo 'NO'")
HEALTH2_EXISTS=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$CHECKPOINT2 && [ -f health_check.json ] && echo 'YES' || echo 'NO'")

if [ "$HEALTH1_EXISTS" = "YES" ] && [ "$HEALTH2_EXISTS" = "YES" ]; then
    VERSION1=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$CHECKPOINT1 && cat health_check.json | grep -o '\"version\":\"[^\"]*\"' | cut -d':' -f2 | tr -d '\"' || echo 'Unknown'")
    VERSION2=$(run_ssh_command "cd $SERVER_PATH/checkpoints/$CHECKPOINT2 && cat health_check.json | grep -o '\"version\":\"[^\"]*\"' | cut -d':' -f2 | tr -d '\"' || echo 'Unknown'")
    
    echo "  $CHECKPOINT1 Version: $VERSION1"
    echo "  $CHECKPOINT2 Version: $VERSION2"
    
    if [ "$VERSION1" = "$VERSION2" ]; then
        echo "  📊 Versions: ✅ Same ($VERSION1)"
        echo "Versions: Same ($VERSION1)" >> "$COMPARISON_REPORT"
    else
        echo "  📊 Versions: ⚠️ Different ($VERSION1 vs $VERSION2)"
        echo "Versions: Different ($VERSION1 vs $VERSION2)" >> "$COMPARISON_REPORT"
    fi
else
    echo "  ❌ Health check data not available for comparison"
    echo "Health check data: Not available" >> "$COMPARISON_REPORT"
fi

echo ""

# Detailed differences for key files (if requested)
echo "📝 Generating detailed comparison..."

cat >> "$COMPARISON_REPORT" << EOF

Detailed File Comparison:
========================

EOF

# Generate diff for backend files if both exist and are different
if [ "$BACKEND1_EXISTS" = "YES" ] && [ "$BACKEND2_EXISTS" = "YES" ] && [ "$BACKEND_DIFF" != "0" ]; then
    echo "Backend file differences:" >> "$COMPARISON_REPORT"
    run_ssh_command "cd $SERVER_PATH/checkpoints && diff -u $CHECKPOINT1/backend_comprehensive_enhanced.js $CHECKPOINT2/backend_comprehensive_enhanced.js | head -50" >> "$COMPARISON_REPORT"
    echo "" >> "$COMPARISON_REPORT"
fi

# Generate diff for frontend files if both exist and are different
if [ "$FRONTEND1_EXISTS" = "YES" ] && [ "$FRONTEND2_EXISTS" = "YES" ] && [ "$FRONTEND_DIFF" != "0" ]; then
    echo "Frontend file differences:" >> "$COMPARISON_REPORT"
    run_ssh_command "cd $SERVER_PATH/checkpoints && diff -u $CHECKPOINT1/index.html $CHECKPOINT2/index.html | head -50" >> "$COMPARISON_REPORT"
    echo "" >> "$COMPARISON_REPORT"
fi

# Summary and recommendations
echo "💡 Comparison Summary:"
echo "====================="

MAJOR_DIFFERENCES=0

if [ "$BACKEND_DIFF" != "0" ] 2>/dev/null; then
    echo "  ⚠️  Backend files differ"
    MAJOR_DIFFERENCES=$((MAJOR_DIFFERENCES + 1))
fi

if [ "$FRONTEND_DIFF" != "0" ] 2>/dev/null; then
    echo "  ⚠️  Frontend files differ"
    MAJOR_DIFFERENCES=$((MAJOR_DIFFERENCES + 1))
fi

if [ "$VERSION1" != "$VERSION2" ] 2>/dev/null; then
    echo "  ⚠️  Different versions detected"
    MAJOR_DIFFERENCES=$((MAJOR_DIFFERENCES + 1))
fi

if [ "$MAJOR_DIFFERENCES" -eq 0 ]; then
    echo "  ✅ Checkpoints appear to be very similar or identical"
    RECOMMENDATION="Both checkpoints are similar - either can be used for rollback"
else
    echo "  ⚠️  Significant differences detected ($MAJOR_DIFFERENCES areas)"
    if [[ "$CHECKPOINT1_DATE" > "$CHECKPOINT2_DATE" ]] 2>/dev/null; then
        RECOMMENDATION="$CHECKPOINT1 is newer and likely contains more recent features"
    else
        RECOMMENDATION="$CHECKPOINT2 is newer and likely contains more recent features"
    fi
fi

echo ""
echo "📋 Recommendation: $RECOMMENDATION"

# Add summary to report
cat >> "$COMPARISON_REPORT" << EOF

Comparison Summary:
==================
Major Differences: $MAJOR_DIFFERENCES areas
Recommendation: $RECOMMENDATION

Rollback Commands:
- To $CHECKPOINT1: ./rollback_to_checkpoint.sh $CHECKPOINT1
- To $CHECKPOINT2: ./rollback_to_checkpoint.sh $CHECKPOINT2

Report Generated: $(date)
EOF

echo ""
echo "✅ COMPARISON COMPLETED!"
echo "========================"
echo ""
echo "📊 Comparison Results:"
echo "  Checkpoints Compared: $CHECKPOINT1 vs $CHECKPOINT2"
echo "  Major Differences: $MAJOR_DIFFERENCES areas"
echo "  Detailed Report: $COMPARISON_REPORT"
echo ""
echo "💡 Recommendation: $RECOMMENDATION"
echo ""
echo "🛠️  Next Actions:"
echo "  📋 View full report: cat $COMPARISON_REPORT"
echo "  🔄 Rollback to $CHECKPOINT1: ./rollback_to_checkpoint.sh $CHECKPOINT1"
echo "  🔄 Rollback to $CHECKPOINT2: ./rollback_to_checkpoint.sh $CHECKPOINT2"
echo "  📋 List all checkpoints: ./list_checkpoints.sh"
echo ""
echo "🎯 Checkpoint comparison complete! 🎯"