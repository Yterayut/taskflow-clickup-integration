#!/bin/bash
# fix-sudo.sh - Fix sudo permission issues on remote server

REMOTE_SERVER="one-climate@192.168.20.10"
REMOTE_PASSWORD="U8@1v3z#14"

echo "🔧 Fixing sudo permission issues on remote server..."

# Method 1: Try to run deploy with SUDO_ASKPASS
sshpass -p "$REMOTE_PASSWORD" ssh "$REMOTE_SERVER" "
    echo '#!/bin/bash' > /tmp/askpass.sh
    echo 'echo \"$REMOTE_PASSWORD\"' >> /tmp/askpass.sh
    chmod +x /tmp/askpass.sh
    export SUDO_ASKPASS=/tmp/askpass.sh
    
    cd ~/team-workload
    echo 'Testing sudo access...'
    echo '$REMOTE_PASSWORD' | sudo -S echo 'Sudo test successful' || echo 'Sudo test failed'
"

echo "✅ Sudo permission fix attempted"