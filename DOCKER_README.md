# Docker Setup voor Transit Project APIs

Dit project bevat Docker-configuratie voor alle 3 APIs en PostgreSQL database.

## Bestanden

- **auth_api/Dockerfile** - Image voor Authentication API (port 5000)
- **employee_api/Dockerfile** - Image voor Employee API (port 4000)
- **transit_api/Dockerfile** - Image voor Transit API (port 5001)
- **docker-compose.yml** - Orchestratie van alle services
- **.dockerignore** - Bestanden die niet in Docker images opgenomen worden
- **.env.example** - Template voor environment variabelen

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
# Start alle services (database + alle APIs)
docker-compose up -d

# Of build en start tegelijk (als je code hebt aangepast)
docker-compose up -d --build
```

### 3. Logs bekijken

```bash
# Alle logs
docker-compose logs -f

# Logs van specifieke service
docker-compose logs -f auth_api
docker-compose logs -f employee_api
docker-compose logs -f transit_api
docker-compose logs -f db
```

## Beschikbare Services

| Service | Port | Database | Beschrijving |
|---------|------|----------|--------------|
| auth_api | 5000 | PostgreSQL | Authentication endpoints |
| employee_api | 4000 | PostgreSQL | Employee management endpoints |
| transit_api | 5001 | PostgreSQL | Transit schedule endpoints |
| db | 5432 | - | PostgreSQL database server |

## Commando's

### Services beheren

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

# Build specifieke image
docker-compose build auth_api

# Logs van specifieke service
docker-compose logs -f transit_api
```

### Database commando's

```bash
# Verbinding met database
docker-compose exec db psql -U transit_user -d transit_db

# Database backup
docker-compose exec db pg_dump -U transit_user transit_db > backup.sql

# Database restore
docker-compose exec -T db psql -U transit_user transit_db < backup.sql
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
