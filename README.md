# Transit Project

Dit repository bevat een suite van drie Node.js microservices (APIs) en bijbehorende tooling:

- `auth_api` — Authenticatie en token-uitgifte (standaard port 5000)
- `employee_api` — Employee onboarding / management (standaard port 4000)
- `transit_api` — Transit/schedule endpoints (standaard port 5001)
- `error_log_api` — Centrale foutlogging en viewer (standaard port 5003)

Er is ook een GitHub Actions workflow aanwezig die Docker images bouwt en pusht naar GitHub Container Registry (GHCR).

Belangrijk: deze README bevat geen wachtwoorden of andere gevoelige gegevens. Sla secrets altijd buiten versiebeheer op (environment variables, secret managers, Portainer secrets, etc.).

---

## Security & Private Files

**⚠️ Important:** This repository excludes private documentation and setup instructions from Git and Docker builds. See [SECURITY_PRIVATE_FILES.md](SECURITY_PRIVATE_FILES.md) for details on:

- What files are kept private and why
- How `.gitignore` and `.dockerignore` protect sensitive information
- Best practices for handling deployment documentation
- Guidelines for adding new private files

**Private files are excluded** (not in git/docker):
- `GETTING_STARTED.md` - Internal setup guide
- `ADMIN_DEPLOYMENT_SUMMARY.md` - Deployment status
- `CI_CD_PORTAINER_GUIDE.md` - Infrastructure docs
- `DEPLOYMENT.md` - Deployment procedures
- Custom instruction files (`.instructions.md`, etc.)

---

## Overzicht van inhoud

- `auth_api/` — source voor auth service
- `employee_api/` — source voor employee service
- `transit_api/` — source voor transit service
- `.github/workflows/docker-build.yml` — CI: bouw en push images naar GHCR
- `docker-compose.yml` — compose file die (in deze workspace-versie) images trekt van `ghcr.io/...` en verwacht dat je een externe PostgreSQL hebt draaien
- `.env.example` — voorbeeld environment variabelen
- `DOCKER_README.md` & `CI_CD_PORTAINER_GUIDE.md` — extra docs voor Docker/CI

---

## Vereisten

- Git
- Docker (20.10+)
- Docker Compose (v2+ of `docker compose`)
- (Optioneel) een remote omgeving met Portainer
- (Optioneel) Een GitHub account met rechten om images naar GHCR te publiceren

---

## Veiligheid — belangrijke reminders

- Plaats geen secrets in git. Gebruik een `.env`-bestand lokaal (dat je in `.gitignore` houdt) of een secret manager.
- JWT secrets, database wachtwoorden en andere credentials moeten via environment variables of Portainer secrets geleverd worden.

---

## Environment variabelen (voorbeeld)

Je `docker-compose.yml` verwacht environment variabelen die de database-verbinding en JWT secret definiëren.
Maak een local `.env` bestand in de projectroot (NIET commiten). Gebruik deze variabelen als leidraad:

```
# Database (externe Postgres)
POSTGRES_HOST=your.db.host.or.ip
POSTGRES_PORT=5432
POSTGRES_DB=transit_db

# Per-service DB-credentials (optioneel: kun ook één DB-user gebruiken per DB)
POSTGRES_USER_AUTH=auth_user
POSTGRES_PASSWORD_AUTH=strong_password_auth
POSTGRES_USER_EMPLOYEE=employee_user
POSTGRES_PASSWORD_EMPLOYEE=strong_password_employee
POSTGRES_USER_TRANSIT=transit_user
POSTGRES_PASSWORD_TRANSIT=strong_password_transit
POSTGRES_USER_ERROR_LOG=error_logger
POSTGRES_PASSWORD_ERROR_LOG=strong_password_error_log

# JWT secret voor services die JWT gebruiken
JWT_SECRET=super_secret_jwt_key_here

# Optioneel: centraal error log endpoint voor clients/services
ERROR_LOG_API_URL=http://error_log_api:5003/error_log
```

Opmerking: de exacte variabelen worden gelezen door `docker-compose.yml`. Pas de namen/waarden aan naar jouw omgeving.

---

## Lokale ontwikkeling (zonder Docker)

1. Zorg dat je een PostgreSQL instance hebt draaien (lokal of remote).
2. Kopieer per API een `.env` of export de benodigde vars.

Voorbeeld: run de `auth_api` lokaal

```bash
cd auth_api
# installeer dependencies
npm install
# export env vars (voorbeeld):
export DB_HOST=your.db.host
export DB_PORT=5432
export DB_NAME=transit_db
export DB_USER=auth_user
export DB_PASSWORD=...
export JWT_SECRET=...

npm start
```

Herhaal voor `employee_api` en `transit_api` met de juiste env keys/poorten.

Tip: tijdens development kun je één Postgres instance gebruiken en schema/rollen configureren.

---

## Docker / Portainer — deployment (met externe Postgres)

Deze repository bevat `docker-compose.yml` die images vanuit GHCR trekt. De compose is aangepast om een externe Postgres te gebruiken.

Voordat je start:
- Zorg dat je `.env` met database credentials en `JWT_SECRET` klaar staat op de server.
- Zorg dat de host waar je compose draait netwerk-connectiviteit heeft naar de Postgres host.

Stappen om te deployen (server/Portainer host):

```bash
# 1. Zet .env op server (NIET in git)
scp .env user@server:/path/to/project/.env
# of maak lokaal op de server

# 2. Login bij GHCR (om private images te kunnen pullen)
# Username = je GitHub-gebruikersnaam
# Password = PAT met 'write:packages'/'read:packages' scopes of je GITHUB_TOKEN
docker login ghcr.io

# 3. Start stack
docker-compose --env-file .env up -d
# of met compose V2:
docker compose --env-file .env up -d
```

Als je Portainer gebruikt kun je `docker-compose.yml` ook als "Stack" in de Portainer UI plakken en deployment via de UI uitvoeren. Voeg de environment variabelen in Portainer toe of verwijs naar een server-side `.env`.

Opmerking over `depends_on` in `docker-compose.yml`: omdat je een externe DB gebruikt, verwijst de compose soms nog naar een non-existent `db` service. Je kunt die `depends_on` regels veilig verwijderen of negeren, zolang je database beschikbaar is voordat de services de verbinding proberen te maken.

---

## GitHub Actions & Container Registry (CI)

Het project bevat een workflow in `.github/workflows/docker-build.yml` die bij push naar `main`/`develop` de volgende stappen uitvoert:

- Checkout
- Build Docker images per API (met BuildKit/Buildx)
- Login naar de Container Registry (GHCR) en push images
- Genereert tags (`latest`, branch/sha, semver als aanwezig)

Om GHCR te gebruiken op je server:
1. Maak een Personal Access Token (PAT) met `read:packages` (en `write:packages` indien je zelf ook wilt pushen).
2. Login op de server: `docker login ghcr.io` (gebruik PAT als wachtwoord).

Image naam voorbeeld:
```
ghcr.io/<github-username>/<repo>/auth_api:latest
```

---

## Health checks, endpoints en debugging

Enkele nuttige endpoints (voorbeeld):

- `GET /health` — (beschikbaar in `employee_api`) controleert reachability
- `POST /login` — (`auth_api`) authenticatie
- `GET /schedule/daily?date=YYYY-MM-DD` — (`transit_api`) vereist auth

Logs bekijken:

```bash
# Logs van service
docker-compose logs -f auth_api

# Of via container id
docker logs -f auth_api
```

Problemen met DB-verbinding:
- Controleer netwerkconnectiviteit naar `POSTGRES_HOST`
- Controleer users/permissions in Postgres
- Controleer dat de juiste schema (zoals `workers`) bestaat als de queries die verwachten

---

## Veelvoorkomende taken & commando's

```bash
# Build & run (pull images van GHCR)
docker-compose --env-file .env up -d

# Pull latest images
docker-compose pull

# Recreate containers
docker-compose up -d --force-recreate

# Stop and remove containers
docker-compose down

# Login to GHCR
docker login ghcr.io
```

---

## Migraties & Database schema

Database schema en migraties zitten niet in deze repository. Zorg dat je:
- de juiste schema's (`workers`, `routes`, etc.) aanmaakt
- gebruikers en rechten configureert voor de verschillende services

### Error logging schema

Voor de centrale foutlogging maak je schema `data` en tabel `data.errors` aan:

```sql
CREATE SCHEMA IF NOT EXISTS data;

CREATE TABLE IF NOT EXISTS data.errors (
	id BIGSERIAL PRIMARY KEY,
	"date" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	"service" TEXT NOT NULL,
	"partOfService" TEXT,
	"error" TEXT NOT NULL
);
```

Gebruik een aparte gebruiker met minimale rechten, bijvoorbeeld `error_logger`:

```sql
CREATE ROLE error_logger LOGIN PASSWORD 'strong_password_error_log';
GRANT USAGE ON SCHEMA data TO error_logger;
GRANT INSERT, SELECT ON data.errors TO error_logger;
```

Als je nog geen database hebt, kun je lokaal een Postgres container gebruiken (development):

```bash
docker run --name transit-db -e POSTGRES_DB=transit_db -e POSTGRES_USER=transit_user -e POSTGRES_PASSWORD=pass -p 5432:5432 -d postgres:15-alpine
```

Maar voor je production/Portainer setup volg je je bestaande beheersbeleid en gebruik je een managed DB of beveiligde host.

---

## Deployment tips

- Gebruik verschillende database users per service met minimale rechten
- Gebruik secrets in Portainer of Docker swarm/kubernetes secrets in productie
- Gebruik een reverse proxy (nginx, Traefik) voor TLS/HTTPS
- Stel log aggregatie en monitoring in (Prometheus/Grafana, ELK, etc.)

---

## Contributie

- Maak feature branches en open pull requests
- Push naar `develop` of `main` afhankelijk van je branching policy
- CI zal automatisch images bouwen en pushen voor `main`/`develop`

---

## Waar te vinden

- API code: `auth_api/`, `employee_api/`, `transit_api/`
- CI workflow: `.github/workflows/docker-build.yml`
- Extra docs: `DOCKER_README.md`, `CI_CD_PORTAINER_GUIDE.md`

---

## Admin Control Center

The project includes a **modern React admin dashboard** for fleet and schedule management.

### Features

- **Fleet Management**: Create and manage buses with seat capacity and license plates
- **Transit Lines**: Define bus routes with start/end stops and duration
- **Route Management**: Link stops to bus lines with drag-and-drop reordering
- **Schedule Maker**: Create schedules by assigning vehicles and crew to bus lines with time slots
- **Timetable View**: 24-hour timetable showing scheduled services
- **Delete Operations**: Remove stops, lines, and schedules with confirmation modals

### Admin UI Location

```
admin_ui/
├── src/
│   ├── components/
│   │   ├── StopsManager.jsx      # Create and manage transit stops
│   │   ├── BusLinesManager.jsx   # Manage bus lines and routes
│   │   ├── FleetManager.jsx      # Manage fleet vehicles
│   │   ├── LinkStop.jsx          # Drag-drop route stop assignment
│   │   ├── ScheduleMaker.jsx     # Create and manage schedules
│   │   ├── TimetableViewer.jsx   # Public timetable (reusable)
│   │   └── Login.jsx             # Admin authentication
│   ├── App.jsx                   # Main app component
│   ├── api.js                    # API client with runtime config
│   └── styles.css                # Responsive UI styling
├── docker-entrypoint.sh          # Runtime env config
└── Dockerfile                    # Multi-stage build

```

### Building the Admin UI

```bash
cd admin_ui
npm install
npm run build         # Production build
npm run dev          # Development (Vite)
```

### Docker Deployment

The admin UI is included in `docker-compose.yml` as service `admin_ui` on port 5174.

```bash
docker-compose up admin_ui
# Access at http://localhost:5174
```

### Public Schedule API

The Transit API exposes public (unauthenticated) schedule endpoints:

**Endpoints:**
- `GET /schedules?date=YYYY-MM-DD&lineId=ID` — Get schedules for a date/line
- `GET /schedules/:scheduleId` — Get schedule details
- `GET /schedules/:scheduleId/stops` — Get stops on a schedule's line

**Example:**
```bash
curl http://localhost:5001/schedules?date=2026-05-06
```

**TimetableViewer Component:**
```jsx
import TimetableViewer from './components/TimetableViewer'

<TimetableViewer apiBaseUrl="http://api.transit.local:5001" />
```

### Schedule Maker Documentation

See [admin_ui/SCHEDULE_API.md](admin_ui/SCHEDULE_API.md) for detailed API documentation, usage examples, and UI features.

---

## Authentication

Admin dashboard uses simple JWT-based authentication:

1. **Login** with user code (e.g., `42`)
2. Receive JWT token from `auth_api`
3. Use token for admin operations (`/admin/*` endpoints)

Admin authorization is controlled by `ADMIN_USER_CODES` environment variable configured in the `auth_api` service:

```bash
# Set admin user codes for the auth service (comma-separated)
ADMIN_USER_CODES=42,101,205
```

---

## Development vs Production

### Development Mode

Use `DEV_MOCK=1` to work without a database (in-memory mock storage):

```bash
# For local development set admin codes on the auth_api and start services
ADMIN_USER_CODES=42 DEV_MOCK=1 JWT_SECRET=devsecret npm --prefix ./auth_api start
```

### Production Mode

Set up real PostgreSQL database and provide credentials via environment variables.

---

Als je wilt, kan ik deze README nog aanpassen met specifieke voorbeelden van database schema's of exacte environment-variabele namen voor lokaal draaien. Zeg welke details je wil toevoegen (bijv. example SQL voor `workers` schema).