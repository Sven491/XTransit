# Transit Admin Control Center

Modern React + Vite web application for comprehensive transit system administration.

## Features

✅ **Stop Management** - Create and manage transit stops with geolocation
✅ **Bus Lines** - Define routes with start/end stops and estimated durations
✅ **Fleet Management** - Monitor and view fleet vehicles
✅ **Stop Linking** - Assign stops to bus lines with order and ETA
✅ **JWT Authentication** - Secure authentication with role-based access
✅ **Production Ready** - Docker containerized with runtime env configuration
✅ **Error Log Viewer** - Inspect centralized error logs from all services

## Local Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup

```bash
cd admin_ui
npm install
```

### Environment Configuration

Create a `.env` file in the `admin_ui` directory:

```env
VITE_AUTH_API=http://localhost:5000
VITE_TRANSIT_API=http://localhost:5001
VITE_ERROR_LOG_API=http://localhost:5003
```

### Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

This creates a production bundle in the `dist/` directory.

## Docker Deployment

### Build Docker Image

```bash
docker build -t xtransit/admin_ui:latest .
```

### Run with Docker

```bash
docker run -p 5174:80 \
  -e VITE_AUTH_API=/api/auth \
  -e VITE_TRANSIT_API=/api/transit \
  xtransit/admin_ui:latest
```

### Using Docker Compose

The admin UI is integrated into the main `docker-compose.yml` at the project root.

From the project root:

```bash
# Start all services including admin UI
docker-compose up -d

# Access the admin UI
http://localhost:5174
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_AUTH_API` | Auth API URL (same-origin path recommended in Docker) | http://localhost:5000 |
| `VITE_TRANSIT_API` | Transit API URL (same-origin path recommended in Docker) | http://localhost:5001 |

### Runtime Configuration

When running in Docker, environment variables are injected at runtime via `docker-entrypoint.sh` which creates `/usr/share/nginx/html/env-config.js`. This allows configuration without rebuilding the image.

## Architecture

### Technology Stack
- **Frontend**: React 18.2 + Vite 5.0
- **HTTP Client**: Axios 1.4
- **Server**: Nginx (Alpine Linux)
- **Build**: Multi-stage Docker build for optimized image size

### Component Structure

- `App.jsx` - Main app router, session management
- `Login.jsx` - Authentication with dev token helper
- `StopsManager.jsx` - Create/list transit stops
- `BusLinesManager.jsx` - Create/list bus routes
- `FleetManager.jsx` - View fleet vehicles
- `LinkStop.jsx` - Link stops to bus lines
- `ErrorLogViewer.jsx` - Central error log viewer

### API Integration

The app communicates with:
- **Auth API** (/login, /me)
- **Transit API** (/admin/stops, /admin/bus-lines, /admin/fleet/buses)
- **Error Log API** (/error_log)

All requests include JWT Bearer token for authentication.

## Authentication

### Login Flow

1. User enters user code and password
2. Client calls POST `/login`
3. Receives JWT token with `userId` and `userCode`
4. JWT is stored in localStorage
5. All API requests include `Authorization: Bearer <token>`

### Admin Authorization

Users must have a `userCode` in their JWT and, for admin access, the `isAdmin` flag set by the `auth_api` based on the `ADMIN_USER_CODES` environment variable.

### Production Setup

1. Remove dev token button from Login.jsx
2. Implement real authentication system (OAuth/SAML)
3. Configure proper JWT generation in auth_api
4. Set strong `JWT_SECRET` environment variable
5. Configure `ADMIN_USER_CODES` with actual admin user IDs
6. Configure `VITE_ERROR_LOG_API` if you use a custom logging endpoint

## Troubleshooting

### Issue: "Admin UI not loading"
- Verify container is running: `docker ps`
- Check logs: `docker-compose logs admin_ui`
- Clear browser cache (Ctrl+Shift+R)

### Issue: "API connection refused"
- Ensure auth_api and transit_api are running
- Check environment variables are set correctly
- Verify network connectivity between containers

### Issue: "Permission denied" on admin operations
- Verify JWT token includes valid `userCode`
- Check `ADMIN_USER_CODES` environment variable
- Ensure database user has appropriate permissions

## Deployment

See [DEPLOYMENT.md](../DEPLOYMENT.md) for comprehensive deployment guide.

### Production Checklist

- [ ] Remove development authentication helpers
- [ ] Set strong JWT_SECRET
- [ ] Configure proper ADMIN_USER_CODES
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS for production domain
- [ ] Set up monitoring and logging
- [ ] Configure database backups
- [ ] Document admin procedures

## Support

For issues or questions:
1. Check service logs: `docker-compose logs admin_ui`
2. Verify API connectivity: Visit API URLs directly
3. Check browser console for client-side errors
4. Review DEPLOYMENT.md for troubleshooting

## License

Part of the XTransit project

