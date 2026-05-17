# Quick Start Guide - XTransit Admin Control Center

## 🚀 5-Minute Setup

### Step 1: Initial Setup
```bash
# From the project root
./scripts/init.sh
```

This will:
- Check Docker and Docker Compose installation
- Create `.env` file from template
- Build all Docker images
- Prompt you to configure database credentials

### Step 2: Configure Database Connection

Edit `.env` with your database details:
```env
POSTGRES_HOST=your-db-host.com
POSTGRES_USER_AUTH=transitAUTH
POSTGRES_PASSWORD_AUTH=your_password
POSTGRES_USER_TRANSIT=transitAPI
POSTGRES_PASSWORD_TRANSIT=your_password
JWT_SECRET=your-secure-secret
# ADMIN_USER_CODES should be set in auth_api/.env (comma-separated admin user codes)
```

### Step 3: Start Services
```bash
./scripts/deploy.sh start
```

### Step 4: Access Admin UI
```
http://localhost:5174
```

Log in with your real user code and password.

## 📱 Admin UI Features

### Stops Management
- Create new transit stops
- Set geolocation (latitude, longitude)
- View all stops
- Link stops to bus lines

### Bus Lines
- Create new bus routes
- Define start and end stops
- Set estimated travel time
- Assign stops to lines with order

### Fleet
- View fleet vehicles (read-only)
- See vehicle details

## 🐳 Docker Services

| Port | Service | URL |
|------|---------|-----|
| 5174 | Admin UI | http://localhost:5174 |
| 5000 | Auth API | http://localhost:5000 |
| 5001 | Transit API | http://localhost:5001 |
| 4000 | Employee API | http://localhost:4000 |

## 🔧 Common Commands

```bash
# View service status
./scripts/deploy.sh status

# Restart all services
./scripts/deploy.sh restart

# View logs
./scripts/deploy.sh logs admin_ui
./scripts/deploy.sh logs transit_api

# Stop services
./scripts/deploy.sh stop

# Clean up containers and volumes
./scripts/deploy.sh clean
```

### Authentication

Use the real login flow with user code and password.

### Production
- Keep `DEV_BYPASS=0` and `DEV_MOCK=0`
- Configure proper admin user codes in `ADMIN_USER_CODES`
- Ensure JWTs include the `userCode` claim

## 📝 Configuration Files

- **docker-compose.yml** - All service definitions
- **.env** - Database and API credentials
- **DEPLOYMENT.md** - Comprehensive deployment guide
- **DOCKER_README.md** - Docker-specific documentation

## ⚠️ Troubleshooting

### "Address already in use"
```bash
# Find and stop the process using the port
lsof -i :5174  # Find process on port 5174
kill -9 <PID>  # Kill the process
```

### "Cannot connect to database"
```bash
# Check database credentials in .env
# Verify database is accessible from your machine
# Ensure database user exists and has proper permissions
```

### "Admin UI not loading"
```bash
# Check container is running
docker-compose ps admin_ui

# View logs
docker-compose logs -f admin_ui

# Restart service
docker-compose restart admin_ui
```

### "Permission denied" errors
The transit API user needs proper database permissions:
```sql
-- Grant permissions to transitAPI user
GRANT CONNECT ON DATABASE "XTransit" TO transitAPI;
GRANT USAGE ON SCHEMA public TO transitAPI;
GRANT SELECT, INSERT, UPDATE ON all tables IN SCHEMA public TO transitAPI;
```

## 📚 For More Information

- **DEPLOYMENT.md** - Full deployment guide for production
- **DOCKER_README.md** - Docker and container information  
- **admin_ui/README.md** - Admin UI specific details

## 🎯 Next Steps

1. ✅ Run initial setup script
2. ✅ Configure database credentials
3. ✅ Start services
4. ✅ Access Admin UI at http://localhost:5174
5. ✅ Create test stops and bus lines
6. ✅ Test the admin interface

For production deployment, see **DEPLOYMENT.md** for security and configuration best practices.
