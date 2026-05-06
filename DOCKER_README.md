# Docker Setup voor Transit Project APIs

Dit project bevat Docker-configuratie voor alle APIs, Admin Control Center en PostgreSQL database.

## Bestanden

- **auth_api/Dockerfile** - Image voor Authentication API (port 5000)
- **employee_api/Dockerfile** - Image voor Employee API (port 4000)
- **transit_api/Dockerfile** - Image voor Transit API (port 5001)
- **admin_ui/Dockerfile** - Image voor Admin Control Center (port 5174)
- **docker-compose.yml** - Orchestratie van alle services
- **.dockerignore** - Bestanden die niet in Docker images opgenomen worden
- **.env.example** - Template voor environment variabelen
- **DEPLOYMENT.md** - Gedetailleerde deployment guide
- **scripts/deploy.sh** - Deployment helper script
- **scripts/build-and-push.sh** - Build en push script voor registry

## Vereisten

- Docker (>=20.10)
- Docker Compose (>=2.0)

## Installatie

### 1. Environment variabelen configureren

```bash
cp .env.example .env
# Bewerk .env met je eigen waarden
```

### 2. Services starten

```bash
# Start alle services (APIs + Admin UI)
docker-compose up -d

# Of build en start tegelijk (als je code hebt aangepast)
docker-compose up -d --build

# Quick start met script
./scripts/deploy.sh start
```

### 3. Logs bekijken

```bash
# Alle logs
docker-compose logs -f

# Logs van specifieke service
docker-compose logs -f auth_api
docker-compose logs -f transit_api
docker-compose logs -f admin_ui

# Via script
./scripts/deploy.sh logs admin_ui
```

## Beschikbare Services

| Service | Port | Beschrijving |
|---------|------|--------------|
| admin_ui | 5174 | Admin Control Center (React + Nginx) |
| auth_api | 5000 | Authentication endpoints |
| employee_api | 4000 | Employee management endpoints |
| transit_api | 5001 | Transit management endpoints |

## Commando's

### Services beheren (Quick way)

```bash
# Via helper script
./scripts/deploy.sh start       # Start alle services
./scripts/deploy.sh stop        # Stop alle services
./scripts/deploy.sh restart     # Herstart alle services
./scripts/deploy.sh status      # Show status
./scripts/deploy.sh logs        # Bekijk logs admin_ui
./scripts/deploy.sh logs transit_api  # Bekijk logs specifieke service
```

### Services beheren (Docker compose)

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Herstart services
docker-compose restart

# Verwijder containers en volumes
docker-compose down -v
```

### Individuele services

```bash
# Herstart specifieke service
docker-compose restart auth_api
docker-compose restart admin_ui

# Build specifieke image
docker-compose build auth_api

# Logs van specifieke service
docker-compose logs -f transit_api
```

### Admin UI

```bash
# Bekijk Admin UI
http://localhost:5174

# Logs
docker-compose logs -f admin_ui

# Shell in container
docker-compose exec admin_ui sh
```

## Troubleshooting

### Port al in gebruik
```bash
# Check welke container de port gebruikt
docker ps

# Verander port in docker-compose.yml (e.g., "5000:5000" naar "5010:5000")
```

### Database connectie fout
```bash
# Check database status
docker-compose logs db

# Herstart database
docker-compose restart db
```

### API start probleem
```bash
# Check logs
docker-compose logs auth_api

# Controleer environment variabelen in .env
# Controleer database connection string
```

### Admin UI niet bereikbaar
```bash
# Check Admin UI container
docker-compose logs admin_ui

# Zorg ervoor dat poort 5174 niet in gebruik is
lsof -i :5174
```

## Admin Control Center

De Admin UI is een modern React + Vite applicatie die alle admin functies biedt.

### Features

- **Authenticatie**: JWT-based login met dev token helper
- **Stops Management**: Create en beheer transit stops met geo-coördinaten
- **Bus Lines**: Define bus routes met start/end stops en reistijd
- **Fleet Management**: Monitor fleet vehicles
- **Stop Linking**: Assign stops aan bus lines met volgorde en ETA

### Toegang

```
URL: http://localhost:5174
```

### Deployment Configuratie

Environment variabelen in docker-compose.yml:
- `VITE_AUTH_API`: URL naar auth_api (standaard: http://auth_api:5000)
- `VITE_TRANSIT_API`: URL naar transit_api (standaard: http://transit_api:5001)

Voor externe toegang, update de URLs naar je deployment domain.

### Build en Deployment

```bash
# Build Admin UI image
docker-compose build admin_ui

# Push naar registry
./scripts/build-and-push.sh ghcr.io/your-org/xtransit latest

# Deploy met updated image
docker-compose up -d
```

## Development

### Wijzigingen doorgevoerd in code

```bash
# Rebuild container
docker-compose build auth_api

# Herstart service
docker-compose restart auth_api
```

### Code reloading (hot reload)

Voor hot reload kunt u volumes toevoegen aan docker-compose.yml:

```yaml
volumes:
  - ./auth_api:/app
```

Dit kan performance beïnvloeden. Alleen gebruiken tijdens development.

## Productie Tips

1. **Veiligheid**: Wijzig alle wachtwoorden en JWT_SECRET in .env
2. **Database**: Gebruik een managed database service in productie
3. **Logging**: Configureer centralized logging (ELK stack, Splunk, etc.)
4. **Backups**: Stel automatische backups in voor de database
5. **Health Checks**: Monitoreer de health endpoints van de APIs
6. **SSL/TLS**: Gebruik reverse proxy (nginx) voor HTTPS

## Netwerking

De services kunnen elkaar bereiken via:
- auth_api: `http://auth_api:5000`
- employee_api: `http://employee_api:4000`
- transit_api: `http://transit_api:5001`
- database: `db:5432`
