#\!/bin/bash
echo "Deploying TaskFlow Pro to remote server..."

# Try SCP first
scp -o ConnectTimeout=10 public/index.html root@192.168.20.10:/var/www/html/ 2>/dev/null && {
    echo "✅ Deployment successful via SCP"
    exit 0
}

# If SCP fails, try wget from our temporary server
ssh -o ConnectTimeout=10 root@192.168.20.10 "wget -O /var/www/html/index.html http://192.168.222.120:9999/public/index.html" 2>/dev/null && {
    echo "✅ Deployment successful via wget"
    exit 0
}

echo "❌ Deployment failed - trying alternative method"
