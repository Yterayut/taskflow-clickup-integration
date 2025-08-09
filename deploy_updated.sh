#!/bin/bash
echo "Deploying updated TaskFlow Pro to remote server..."

# Copy the updated file
sshpass -p 'U8@1v3z#14' scp public/index.html one-climate@192.168.20.10:/tmp/taskflow_updated.html 2>/dev/null && {
    echo "✅ File uploaded to /tmp/"
    # Move file to web directory
    sshpass -p 'U8@1v3z#14' ssh one-climate@192.168.20.10 "cp /tmp/taskflow_updated.html /var/www/html/index.html" 2>/dev/null && {
        echo "✅ Deployment successful"
        exit 0
    }
}

echo "❌ Deployment failed"