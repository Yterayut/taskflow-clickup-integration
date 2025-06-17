set -e  # หยุดการทำงานเมื่อเกิดข้อผิดพลาด

echo "🚀 TaskFlow System Recovery Starting..."
echo "========================================"

# สีสำหรับแสดงผล
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ฟังก์ชันสำหรับแสดงข้อความ
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# ขั้นตอนที่ 1: หยุดทุก services ก่อน
echo ""
log_info "Step 1: Stopping all TaskFlow services..."
./stop-all.sh || true
sleep 3

# ขั้นตอนที่ 2: แก้ไขปัญหา permissions และ configuration
echo ""
log_info "Step 2: Fixing permissions and configuration..."
