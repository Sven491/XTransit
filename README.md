# Transit Project

Dit repository bevat een suite van drie Node.js microservices (APIs) en bijbehorende tooling:

- `auth_api` — Authenticatie en token-uitgifte (standaard port 5000)
- `employee_api` — Employee onboarding / management (standaard port 4000)
- `transit_api` — Transit/schedule endpoints (standaard port 5001)

Er is ook een GitHub Actions workflow aanwezig die Docker images bouwt en pusht naar GitHub Container Registry (GHCR).

Belangrijk: deze README bevat geen wachtwoorden of andere gevoelige gegevens. Sla secrets altijd buiten versiebeheer op (environment variables, secret managers, Portainer secrets, etc.).

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

# JWT secret voor services die JWT gebruiken
JWT_SECRET=super_secret_jwt_key_here
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

Als je wilt, kan ik deze README nog aanpassen met specifieke voorbeelden van database schema's of exacte environment-variabele namen voor lokaal draaien. Zeg welke details je wil toevoegen (bijv. example SQL voor `workers` schema).