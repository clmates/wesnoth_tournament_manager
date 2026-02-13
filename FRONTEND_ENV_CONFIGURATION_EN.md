# Frontend Environment Configuration for Wesnoth Backend

**Date:** February 11, 2026  
**Purpose:** Configure Vite frontend to communicate with backend via wesnoth.org:4443  
**Frontend Location:** Cloudflare  
**Backend Location:** wesnoth.org:4443 (Nginx Reverse Proxy → localhost:3000)

---

## Quick Overview

```
Frontend (Cloudflare) 
    ↓ HTTPS request
    ↓ https://wesnoth.org:4443/api/...
    ↓
Nginx (4443) - Reverse Proxy
    ↓
Node.js Backend (localhost:3000)
    ↓ Response
Frontend
```

---

## Environment Variables Setup

### 1. Create Environment Files

Navigate to your frontend root directory:

```bash
cd frontend
```

Create environment files:

#### `.env.development` (Local development)
```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_NAME=Wesnoth Tournament Manager
VITE_LOG_LEVEL=debug
```

#### `.env.production` (Cloudflare deployment)
```env
VITE_API_BASE_URL=https://wesnoth.org:4443/api
VITE_APP_NAME=Wesnoth Tournament Manager
VITE_LOG_LEVEL=info
```

---

## 2. Update Vite Configuration

File: `frontend/vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.VITE_API_BASE_URL': JSON.stringify(
      process.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
    ),
  },
  server: {
    // Development server
    port: 5173,
    // Optional: Proxy requests to backend
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
    }
  }
})
```

---

## 3. Create API Service

File: `frontend/src/services/api.ts`

```typescript
import axios, { AxiosInstance } from 'axios';

// Get API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Create Axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // For HTTPS with self-signed certificates (development only)
  // httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

/**
 * Interceptor: Add JWT token to requests
 */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Interceptor: Handle 401 responses
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      
      // Redirect to login
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default api;
```

---

## 4. Environment Variables in React Component

File: `frontend/src/config/api.ts`

```typescript
/**
 * API Configuration
 * Values populated from environment variables during build
 */

export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
};

export const API_ENDPOINTS = {
  // Auth
  AUTH_LOGIN: '/auth/login',
  AUTH_VALIDATE_TOKEN: '/auth/validate-token',
  
  // Tournaments
  TOURNAMENTS: '/tournaments',
  TOURNAMENT_BY_ID: '/tournaments/:id',
  
  // Matches
  MATCHES: '/matches',
  MATCH_BY_ID: '/matches/:id',
  
  // Other endpoints
  HEALTH: '/health',
};

export const getFullURL = (endpoint: string): string => {
  return `${API_CONFIG.baseURL}${endpoint}`;
};
```

---

## 5. Build and Deploy for Production

### Build for production:

```bash
# From frontend directory
npm run build

# This will read VITE_API_BASE_URL from .env.production
# and embed it in the production build
```

### Deploy to Cloudflare:

```bash
# Using Wrangler (Cloudflare CLI)
npm run deploy

# Or using npm scripts in package.json:
# "deploy": "wrangler pages deploy dist"
```

---

## 6. Verification Checklist

- [ ] `.env.production` has correct backend URL: `https://wesnoth.org:4443/api`
- [ ] `vite.config.ts` reads environment variables correctly
- [ ] API service has JWT interceptor
- [ ] API service has 401 error handler (redirect to login)
- [ ] Build command includes environment file
- [ ] Frontend deployed to Cloudflare
- [ ] Test login endpoint: Can authenticate?
- [ ] Test token validation: Can validate JWT?
- [ ] Check browser console for CORS errors
- [ ] Check network tab: API requests going to correct URL?

---

## 7. Testing the Connection

### 1. Test from browser console:

```javascript
// Open DevTools → Console
fetch('https://wesnoth.org:4443/api/health')
  .then(res => res.text())
  .then(data => console.log(data))
  .catch(err => console.error('Error:', err));
```

Expected output: `Backend is running`

### 2. Test login:

```javascript
fetch('https://wesnoth.org:4443/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    username: 'your_wesnoth_username',
    password: 'your_password'
  })
})
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error('Error:', err));
```

Should return: `{ token, userId, username }`

### 3. Network tab inspection:

- Open DevTools → Network tab
- Perform login action
- Check requests:
  - URL: `https://wesnoth.org:4443/api/auth/login` ✓
  - Status: 200 (success) or 401 (invalid credentials) ✓
  - Headers: Has `Authorization: Bearer ...` in requests ✓

---

## 8. CORS Issues Resolution

If you see CORS errors in console:

### Browser error example:
```
Access to XMLHttpRequest from origin 'https://cloudflare-url' has been blocked 
by CORS policy
```

### Solution: Nginx already has CORS headers

In `NGINX_CERTBOT_SETUP_EN.md`, CORS headers are already configured:

```nginx
add_header Access-Control-Allow-Origin "*" always;
add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
```

If issues persist:

1. **Check Nginx configuration is correct** (see NGINX_CERTBOT_SETUP_EN.md)
2. **Restart Nginx:** `sudo systemctl restart nginx`
3. **Check browser network requests** in DevTools
4. **Try with credentials:** Add to fetch request:
   ```javascript
   fetch(url, {
     credentials: 'include',  // Include cookies
     ...
   })
   ```

---

## 9. Build Environment Variables Reference

### Available in frontend code:

```typescript
import.meta.env.VITE_API_BASE_URL    // Backend URL
import.meta.env.VITE_APP_NAME        // App name
import.meta.env.VITE_LOG_LEVEL       // Log level
import.meta.env.MODE                 // 'development' or 'production'
import.meta.env.DEV                  // true if development
import.meta.env.PROD                 // true if production
```

### Example usage:

```typescript
const isDev = import.meta.env.DEV;
const apiUrl = import.meta.env.VITE_API_BASE_URL;

if (isDev) {
  console.debug('Development mode, API:', apiUrl);
}
```

---

## 10. Production Deployment Steps

```bash
# 1. Update .env.production with correct backend URL
echo "VITE_API_BASE_URL=https://wesnoth.org:4443/api" > frontend/.env.production

# 2. Build for production
cd frontend
npm run build

# 3. Verify build output
ls -la dist/

# 4. Deploy to Cloudflare
npm run deploy

# 5. Test in production
# Open https://cloudflare-url
# Try to login with Wesnoth credentials
# Check browser console for errors
```

---

## Troubleshooting

### Problem: API returns 404

**Solution:**
- Verify Nginx is running: `sudo systemctl status nginx`
- Check URL in browser: `https://wesnoth.org:4443/health`
- Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`

### Problem: CORS errors in browser

**Solution:**
- Verify Nginx config has CORS headers (see step above)
- Restart Nginx: `sudo systemctl restart nginx`
- Clear browser cache: Ctrl+Shift+Delete

### Problem: SSL certificate error

**Solution:**
- In development, you may see warnings - this is normal
- For production, Certbot should provide valid certificate
- Check certificate: `sudo certbot certificates`

### Problem: 401 Unauthorized on login

**Solution:**
- Verify Wesnoth credentials are correct
- Check backend is running: `curl http://127.0.0.1:3000/health`
- Check Wesnoth database connection in backend logs

---

## Environment Variables Summary

| Variable | Value | Where Used |
|----------|-------|-----------|
| `VITE_API_BASE_URL` | `https://wesnoth.org:4443/api` | Frontend API calls |
| `VITE_APP_NAME` | `Wesnoth Tournament Manager` | App title |
| `VITE_LOG_LEVEL` | `info` or `debug` | Logging |

---

## Next Steps

1. ✅ Configure environment files (.env.production, .env.development)
2. ✅ Update API service with correct base URL
3. ✅ Build frontend: `npm run build`
4. ✅ Deploy to Cloudflare
5. ✅ Test login and API calls
6. ✅ Monitor browser console for errors
7. ✅ Check Nginx logs if issues occur

---

**Status:** Ready for production  
**Last Updated:** February 11, 2026
