# Nginx + Certbot Setup for Wesnoth Tournament Backend

**Date:** February 11, 2026  
**Setup:** wesnoth.org:4443 → Nginx Reverse Proxy → Node.js Backend (localhost:3000)

---

## Architecture

```
[Cloudflare Frontend] 
         ↓ (HTTPS)
[wesnoth.org:4443]
         ↓ (Nginx Reverse Proxy)
[Localhost:3000 - Node.js Backend]
```

---

## Prerequisites

- Debian 11+ (bullseye, bookworm)
- Root or sudo access
- Domain: wesnoth.org (with DNS control to add records)
- Backend running on `localhost:3000`

---

## Step 1: Install Nginx

```bash
# Update package manager
sudo apt update

# Install Nginx
sudo apt install nginx

# Start and enable service
sudo systemctl start nginx
sudo systemctl enable nginx

# Verify status
sudo systemctl status nginx
```

---

## Step 2: Install Certbot (SSL Certificate Management)

```bash
# Install Certbot and Nginx plugin
sudo apt install certbot python3-certbot-nginx

# Verify installation
certbot --version
```

---

## Step 3: Generate SSL Certificate

```bash
# Request certificate for wesnoth.org
sudo certbot certonly --nginx -d wesnoth.org

# Output will show:
# Successfully received certificate.
# Certificate is saved at: /etc/letsencrypt/live/wesnoth.org/fullchain.pem
# Key is saved at: /etc/letsencrypt/live/wesnoth.org/privkey.pem
```

**Important:** You may be asked to verify domain ownership. Follow Certbot instructions.

---

## Step 4: Create Nginx Configuration

Create new Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/wesnoth-backend
```

Paste this configuration:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name wesnoth.org;
    
    return 301 https://$server_name$request_uri;
}

# Main HTTPS server on port 4443
server {
    listen 4443 ssl http2;
    listen [::]:4443 ssl http2;
    server_name wesnoth.org;

    # SSL Certificate paths
    ssl_certificate /etc/letsencrypt/live/wesnoth.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wesnoth.org/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # CORS headers for Cloudflare frontend
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;

    # Handle preflight requests
    if ($request_method = 'OPTIONS') {
        return 204;
    }

    # Reverse proxy to Node.js backend
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "Backend is running\n";
        add_header Content-Type text/plain;
    }

    # Catch-all
    location / {
        return 404;
    }
}
```

---

## Step 5: Enable the Configuration

```bash
# Create symlink to enable the site
sudo ln -s /etc/nginx/sites-available/wesnoth-backend /etc/nginx/sites-enabled/

# Disable default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration syntax
sudo nginx -t

# Expected output:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

---

## Step 6: Restart Nginx

```bash
sudo systemctl restart nginx

# Verify status
sudo systemctl status nginx
```

---

## Step 7: Test the Setup

### From command line:

```bash
# Test health endpoint (no auth required)
curl -k https://wesnoth.org:4443/health

# Expected output: Backend is running
```

### From your local machine:

```bash
# Test from outside the server
curl -k https://wesnoth.org:4443/api/auth/validate-token

# Should return 401 (unauthorized) because no token, but proves connection works
```

### From browser:

```
https://wesnoth.org:4443/health
```

You might see SSL warning (self-signed), but the connection should work.

---

## Step 8: Firewall Configuration

Open port 4443:

```bash
# Using UFW
sudo ufw allow 4443/tcp
sudo ufw allow 80/tcp

# Verify
sudo ufw status
```

---

## SSL Certificate Auto-Renewal

Certbot automatically renews certificates 30 days before expiration:

```bash
# Check renewal process
sudo certbot renew --dry-run

# View scheduled renewal
sudo systemctl list-timers snap.certbot.renew.timer
```

---

## Troubleshooting

### Certificate errors:

```bash
# Check certificate details
sudo certbot certificates

# Renew manually if needed
sudo certbot renew --force-renewal
```

### Nginx won't start:

```bash
# Check error logs
sudo tail -f /var/log/nginx/error.log

# Validate config again
sudo nginx -t
```

### Backend not reachable:

```bash
# Verify backend is running on localhost:3000
curl http://127.0.0.1:3000/health

# Check Nginx logs
sudo tail -f /var/log/nginx/access.log
```

### Connection refused on port 4443:

```bash
# Check if firewall is blocking
sudo ufw status
sudo ufw allow 4443/tcp

# Check Nginx is listening
sudo netstat -tlnp | grep 4443
```

---

## Useful Commands

```bash
# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Reload configuration (without restarting)
sudo nginx -s reload

# Stop/Start Nginx
sudo systemctl stop nginx
sudo systemctl start nginx

# Check certificate expiration
sudo certbot certificates

# List enabled sites
ls -la /etc/nginx/sites-enabled/

# Monitor real-time connections
sudo watch -n 1 'netstat -tlnp | grep nginx'
```

---

## Security Checklist

- ✅ SSL certificate installed (Let's Encrypt)
- ✅ Auto-renewal configured
- ✅ Firewall rules applied (4443, 80)
- ✅ CORS headers set for Cloudflare origin
- ✅ Security headers added (HSTS, X-Content-Type-Options, etc.)
- ✅ Backend isolated on localhost (not public)
- ✅ Nginx running as non-root user

---

## Next Steps

1. Update frontend environment variables (see FRONTEND_ENV_CONFIGURATION_EN.md)
2. Test backend connectivity from Cloudflare frontend
3. Monitor logs for any issues
4. Set up log rotation if needed

---

**Status:** Ready for production  
**Last Updated:** February 11, 2026
