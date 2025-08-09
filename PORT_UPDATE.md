# 🔄 TaskFlow Port Update

## New Configuration (2025-06-21)

**Frontend URL**: http://192.168.20.10:8080 ✅  
**Backend URL**: http://192.168.20.10:777 ✅

## Port Issues Resolved:
- Port 555: 502 Bad Gateway (service conflict)
- Port 556: Browser blocking non-standard ports  
- Port 8080: ✅ Working correctly

## Update Commands Used:
```bash
# Change nginx config to port 8080
listen 8080;
sudo systemctl reload nginx
```

**Status**: ✅ Ready for OAuth testing on port 8080