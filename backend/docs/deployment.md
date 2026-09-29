# SharpKode VPS Deployment Guide

Target stack: Ubuntu LTS, Nginx, Node.js LTS, PM2, local MongoDB single-node replica set, local upload storage, HTTPS.

## 1. System packages

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx curl tar gzip
```

Install Node.js LTS and PM2:

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 2. MongoDB local replica set

Install MongoDB Community Server for your Ubuntu LTS version using MongoDB's official repository.

Enable replica set in `/etc/mongod.conf`:

```yaml
replication:
  replSetName: rs0
```

Restart and initialize:

```bash
sudo systemctl enable mongod
sudo systemctl restart mongod
mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
mongosh --eval 'rs.status()'
```

Use this URI:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/sharpkode?replicaSet=rs0
```

Transactions require the replica set URI in production.

## 3. Upload storage

```bash
sudo mkdir -p /var/www/sharpkode/uploads/{attendance,business-visits,profile,corrections}
sudo chown -R $USER:www-data /var/www/sharpkode
sudo chmod -R 750 /var/www/sharpkode/uploads
```

The app writes local uploads to `UPLOAD_ROOT=/var/www/sharpkode/uploads`. Nginx serves `/uploads` directly.

Retention policy:

- Attendance selfies: `ATTENDANCE_SELFIE_RETENTION_DAYS=7` by default; cleanup runs daily at 2 AM and clears image paths only.
- Business visit images: `BUSINESS_VISIT_RETENTION_DAYS=3650` by default.
- Profile images: permanent; replaced profile images are deleted when a new one is uploaded.

## 4. Environment

Copy and edit:

```bash
cp backend/.env.example backend/.env
```

Production essentials:

```bash
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/sharpkode?replicaSet=rs0
CLIENT_ORIGINS=https://sharpkode.com,https://www.sharpkode.com
UPLOAD_ROOT=/var/www/sharpkode/uploads
JWT_SECRET=<64+ random chars>
JWT_REFRESH_SECRET=<different 64+ random chars>
```

## 5. Build and indexes

```bash
cd backend
npm ci
npm run migrate:indexes
cd ../client
npm ci
npm run build
```

## 6. PM2

```bash
cd /var/www/sharpkode/app/backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd
```

Health checks:

```bash
curl https://api.sharpkode.com/health
curl https://api.sharpkode.com/ready
```

## 7. Nginx

Copy `backend/deploy/nginx-api.sharpkode.com.conf` to `/etc/nginx/sites-available/api.sharpkode.com` and symlink it:

```bash
sudo ln -s /etc/nginx/sites-available/api.sharpkode.com /etc/nginx/sites-enabled/api.sharpkode.com
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d api.sharpkode.com
```

## 8. Backups

Daily backup example:

```bash
sudo mkdir -p /var/backups/sharpkode
MONGODB_URI='mongodb://127.0.0.1:27017/sharpkode?replicaSet=rs0' \
UPLOAD_ROOT=/var/www/sharpkode/uploads \
BACKUP_ROOT=/var/backups/sharpkode \
bash backend/scripts/backup-vps.sh
```

Cron at 1:30 AM:

```cron
30 1 * * * cd /var/www/sharpkode/app && MONGODB_URI='mongodb://127.0.0.1:27017/sharpkode?replicaSet=rs0' UPLOAD_ROOT=/var/www/sharpkode/uploads BACKUP_ROOT=/var/backups/sharpkode bash backend/scripts/backup-vps.sh >> /var/log/sharpkode-backup.log 2>&1
```

Restore:

```bash
bash backend/scripts/restore-vps.sh /var/backups/sharpkode/sharpkode-YYYYMMDD-HHMMSS.tar.gz
```

## 9. Final deployment checks

```bash
cd backend
npm run lint
npm test
npm audit --audit-level=moderate
npm run migrate:indexes
cd ../client
npm run lint
npm run build
npm audit --audit-level=moderate
```

Manual smoke test after deployment:

- Admin login
- Employee login
- Punch In with selfie
- Punch Out with selfie
- Field Work GPS tracking
- Business Visit upload
- Profile image replacement
- Leave request and approval
- Correction request and approval
- `/uploads/...` image URL served by Nginx
- `/ready` returns 200
