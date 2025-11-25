# Docker Deployment Guide

Complete guide for deploying the Next.js Web Terminal using Docker.

## 📋 Prerequisites

- Docker installed (20.10+)
- Docker Compose installed (2.0+)
- Basic knowledge of Docker

## 🚀 Quick Start with Docker Compose

### 1. Generate Secure Keys

```bash
# Generate SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ENCRYPTION_KEY (run again for different key)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Configure Environment

Create `.env` file in the project root:

```bash
cp .env.docker .env
nano .env  # Edit with your secure keys
```

Update these values:
```env
SESSION_SECRET=<paste-generated-key-1>
ENCRYPTION_KEY=<paste-generated-key-2>
WEB_USERNAME=admin
WEB_PASSWORD=<your-secure-password>
```

### 3. Build and Run

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down

# Stop and remove volumes (WARNING: deletes database)
docker-compose down -v
```

### 4. Access the Terminal

Open your browser and navigate to:
- **Local**: http://localhost:3000
- **Remote**: http://your-server-ip:3000

Login with the credentials from your `.env` file.

---

## 🐳 Manual Docker Commands

If you prefer not to use Docker Compose:

### Build Image

```bash
docker build -t nextjs-web-terminal .
```

### Run Container

```bash
docker run -d \
  --name web-terminal \
  -p 3000:3000 \
  -e SESSION_SECRET="your-session-secret" \
  -e ENCRYPTION_KEY="your-encryption-key" \
  -e WEB_USERNAME="admin" \
  -e WEB_PASSWORD="your-password" \
  -v terminal-data:/app/data \
  --restart unless-stopped \
  nextjs-web-terminal
```

### Manage Container

```bash
# View logs
docker logs -f web-terminal

# Stop container
docker stop web-terminal

# Start container
docker start web-terminal

# Remove container
docker rm web-terminal

# Access container shell
docker exec -it web-terminal sh
```

---

## 📦 Deploy to Various Platforms

### **Railway.app** (Recommended - Has Free Tier)

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login and deploy:
```bash
railway login
railway init
railway up
```

3. Add environment variables in Railway dashboard
4. Your app will be live with auto-SSL!

**Pros:**
- ✅ Free $5/month credit
- ✅ Auto-scaling
- ✅ Built-in CI/CD
- ✅ Free SSL certificates

---

### **DigitalOcean App Platform**

1. Connect your GitHub repo
2. Select "Docker" as build type
3. Set environment variables
4. Deploy!

**Cost:** $5/month minimum

---

### **Render.com** (Has Free Tier)

1. Create new "Web Service"
2. Connect GitHub repo
3. Select "Docker" as environment
4. Set environment variables
5. Deploy

**Note:** Free tier spins down after inactivity

---

### **AWS ECS (Fargate)**

1. Push image to ECR:
```bash
aws ecr create-repository --repository-name web-terminal

# Get login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag nextjs-web-terminal:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/web-terminal:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/web-terminal:latest
```

2. Create ECS service with Fargate
3. Configure task definition with environment variables
4. Deploy

---

### **Traditional VPS (DigitalOcean, Linode, Vultr)**

SSH to your VPS and run:

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone your repo
git clone <your-repo-url>
cd nextjs-web-terminal

# Configure environment
cp .env.docker .env
nano .env  # Edit with your values

# Start with Docker Compose
docker-compose up -d

# Setup Nginx reverse proxy (optional but recommended)
# See NGINX_SETUP.md
```

---

## 🔐 Production Best Practices

### 1. Use Strong Secrets

Never use default values in production:
```bash
# Generate cryptographically secure keys
openssl rand -hex 32  # For SESSION_SECRET
openssl rand -hex 32  # For ENCRYPTION_KEY
```

### 2. Setup Reverse Proxy (Nginx)

Create `/etc/nginx/sites-available/terminal`:

```nginx
server {
    listen 80;
    server_name terminal.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

Enable site and get SSL:
```bash
sudo ln -s /etc/nginx/sites-available/terminal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Install Certbot for free SSL
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d terminal.yourdomain.com
```

### 3. Regular Backups

Backup your database volume:
```bash
# Create backup
docker run --rm \
  -v terminal-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/terminal-backup-$(date +%Y%m%d).tar.gz /data

# Restore backup
docker run --rm \
  -v terminal-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/terminal-backup-YYYYMMDD.tar.gz -C /
```

### 4. Resource Limits

Add to `docker-compose.yml`:
```yaml
services:
  web-terminal:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 5. Monitoring

```bash
# View container stats
docker stats web-terminal

# Check health
docker inspect --format='{{.State.Health.Status}}' web-terminal
```

---

## 🔧 Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs web-terminal

# Verify environment variables
docker-compose config
```

### Database permission issues

```bash
# Fix volume permissions
docker-compose down
docker volume rm nextjs-web-terminal_terminal-data
docker-compose up -d
```

### WebSocket connection fails

- Ensure reverse proxy forwards WebSocket correctly
- Check firewall allows port 3000
- Verify `Upgrade` header is set in proxy config

### Out of disk space

```bash
# Clean up Docker
docker system prune -a
docker volume prune
```

---

## 📊 Volume Management

### View volumes

```bash
docker volume ls
```

### Inspect volume

```bash
docker volume inspect nextjs-web-terminal_terminal-data
```

### Backup to host

```bash
docker cp web-terminal:/app/data ./backup-data
```

### Restore from host

```bash
docker cp ./backup-data/. web-terminal:/app/data
```

---

## 🔄 Updates

### Update to latest version

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Zero-downtime updates (using multiple replicas)

Requires orchestration like Kubernetes or Docker Swarm.

---

## 📈 Scaling

For high-traffic scenarios:

1. **Use external database** (PostgreSQL instead of SQLite)
2. **Load balancer** with multiple container instances
3. **Redis** for session storage
4. **Kubernetes** for orchestration

---

## 🆘 Support

For issues specific to Docker deployment, check:
- Container logs: `docker-compose logs -f`
- Docker daemon logs: `journalctl -u docker`
- Application logs inside container: `docker exec -it web-terminal cat /app/.next/server/app/error.log`

---

**Author:** MiniMax Agent  
**Version:** 3.0.0  
**Last Updated:** 2025-11-25
