# VPS Deployment Guide for Creative-Audio-Forge

This guide will help you deploy Creative-Audio-Forge on a Linux VPS (Ubuntu/Debian).

## Prerequisites

- Ubuntu 20.04+ or Debian 11+
- At least 1GB RAM
- At least 10GB disk space
- SSH access to your VPS

## Quick Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url> creative-audio-forge
cd creative-audio-forge
```

### 2. Run the Setup Script

```bash
chmod +x scripts/setup-vps.sh
./scripts/setup-vps.sh
```

This will install:
- Node.js 20.x
- FFmpeg
- Python3 & pip
- yt-dlp (latest version)
- Deno (optional, for better YouTube support)

### 3. Install Dependencies

```bash
npm install
```

### 4. Build the Application

```bash
npm run build
```

### 5. Configure Environment

Create a `.env` file if needed:

```bash
PORT=5000
NODE_ENV=production
```

### 6. Start the Server

For development:
```bash
npm run dev
```

For production:
```bash
npm run start:prod
```

## Running with PM2 (Recommended for Production)

PM2 keeps your app running and restarts it if it crashes.

### Install PM2

```bash
npm install -g pm2
```

### Start with PM2

```bash
pm2 start dist/index.cjs --name "creative-audio-forge" -i max
```

### PM2 Commands

```bash
pm2 status              # Check status
pm2 logs                # View logs
pm2 restart all         # Restart all
pm2 save                # Save process list
pm2 startup             # Auto-start on reboot
```

## Health Check

After starting the server, verify everything is working:

```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "dependencies": {
    "ytdlp": { "installed": true },
    "ffmpeg": { "installed": true },
    "deno": { "installed": true },
    "cookies": { "configured": false }
  }
}
```

## YouTube Authentication (Optional but Recommended)

To avoid "Sign in to confirm you're not a bot" errors:

### 1. Export Cookies from Your Browser

Use a browser extension to export cookies:
- **Chrome**: [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
- **Firefox**: [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)

### 2. Create cookies.txt

1. Log into YouTube in your browser
2. Use the extension to export cookies for `youtube.com`
3. Save as `cookies.txt` in the project root:

```bash
nano cookies.txt
# Paste your cookies content
# Save with Ctrl+X, Y, Enter
```

### 3. Verify Cookies

```bash
curl http://localhost:5000/api/health | jq '.dependencies.cookies'
```

Should show: `"configured": true`

## Nginx Reverse Proxy (Optional)

For production with SSL:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # For WebSocket support
        proxy_read_timeout 86400;
    }

    # Increase max upload size for large files
    client_max_body_size 2G;
}
```

### Install Nginx & SSL

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## Troubleshooting

### yt-dlp Not Found

```bash
pip3 install --user yt-dlp
export PATH="$HOME/.local/bin:$PATH"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### FFmpeg Not Found

```bash
sudo apt install ffmpeg
```

### Deno Not Found

```bash
curl -fsSL https://deno.land/install.sh | sh
export PATH="$HOME/.deno/bin:$PATH"
echo 'export PATH="$HOME/.deno/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### YouTube Bot Detection Errors

1. Update yt-dlp: `pip3 install --upgrade yt-dlp`
2. Add fresh cookies.txt from a logged-in YouTube session
3. Install Deno for better JS challenge solving

### Permission Errors

```bash
sudo chown -R $USER:$USER /path/to/creative-audio-forge
chmod -R 755 downloads/ uploads/ output/
```

### Port Already in Use

```bash
# Find process using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>
```

## Updating

```bash
# Pull latest code
git pull

# Update yt-dlp
pip3 install --upgrade yt-dlp

# Reinstall dependencies
npm install

# Rebuild
npm run build

# Restart (if using PM2)
pm2 restart creative-audio-forge
```

## Directory Structure

```
creative-audio-forge/
├── downloads/       # Downloaded media files (auto-cleaned)
├── uploads/         # Uploaded files for conversion
├── output/          # Converted output files
├── cookies.txt      # YouTube authentication (optional)
├── dist/            # Built production files
└── scripts/
    └── setup-vps.sh # VPS setup script
```

## Support

If you encounter issues:
1. Check the health endpoint: `/api/health`
2. Check PM2 logs: `pm2 logs`
3. Ensure all dependencies are installed
4. Update yt-dlp to the latest version
