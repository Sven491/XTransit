# GitHub Actions → Docker Registry → Portainer Deployment

Automatisch Docker images bouwen via GitHub en deployen op Portainer.

## 📋 Setup Stappen

### 1. GitHub Repository voorbereiding

```bash
# Push je code naar GitHub (met .github/workflows/docker-build.yml)
git add .
git commit -m "Add Docker build workflow"
git push origin main
```

**Controleer:** https://github.com/YOUR_USERNAME/YOUR_REPO/actions

### 2. GitHub Container Registry inschakelen

✅ Automatisch als je private repo hebt. Voor public repos:

1. Ga naar GitHub repo → **Settings → Packages and registries**
2. Of gewoon eerste push doen → workflow doet dit automatisch

### 3. GitHub Token configureren (optioneel)

Standaard gebruikt GitHub Actions je `GITHUB_TOKEN` (automatisch).

Voor meer controle, maak Personal Access Token (PAT):
1. GitHub → **Settings → Developer settings → Personal access tokens**
2. New token → Scopes: `write:packages`, `read:packages`
3. Token kopieren

### 4. Docker Login op Portainer Server

```bash
# Op je remote server waar Portainer draait
docker login ghcr.io
# Username: je GitHub username
# Password: GITHUB_TOKEN of PAT token
```

---

## 🚀 Image Bouwen & Pushen

### Automatisch (via GitHub Actions)

1. **Je code pushen naar main/develop:**
   ```bash
   git push origin main
   ```

2. **GitHub Actions bouwt automatisch:**
   - ✅ Checkout code
   - ✅ Build Docker images
   - ✅ Push naar ghcr.io
   - ✅ Tags: `latest`, branch name, git SHA

3. **Bekijk workflow:**
   - GitHub → **Actions tab** → Zie voortgang
   - Logs klikken voor debug info

### Images checken in registry

```bash
# List available images/tags
docker pull ghcr.io/YOUR_USERNAME/YOUR_REPO/auth_api:latest --dry-run

# of via GitHub CLI:
gh api user/packages --jq '.[] | select(.package_type=="container")'
```

---

## 🐳 Portainer Deployment

### Methode 1: Via Docker Compose (aanbevolen)

**Op je Portainer server:**

1. **Clone repo of kopie bestand:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
   cd YOUR_REPO
   ```

2. **Login bij registry:**
   ```bash
   docker login ghcr.io
   # Credentials: GitHub username + token
   ```

3. **Start via docker-compose:**
   ```bash
   docker-compose -f docker-compose.portainer.yml up -d
   ```

### Methode 2: Via Portainer UI

1. **Portainer Web Dashboard → Stacks**
2. **"Add Stack" → "Compose"**
3. **Paste inhoud van `docker-compose.portainer.yml`**
4. **Voeg environment vars toe:**
   - `POSTGRES_PASSWORD=...`
   - `JWT_SECRET=...`
5. **Deploy**

### Methode 3: Private Registry in Portainer

1. **Portainer → Registries → Add Registry**
   - **Provider:** GitHub Container Registry
   - **URL:** `ghcr.io`
   - **Username:** je GitHub username
   - **Password:** GITHUB_TOKEN

2. **In docker-compose, images gebruiken:**
   ```yaml
   image: ghcr.io/YOUR_USERNAME/YOUR_REPO/auth_api:latest
   ```

---

## 🔄 Workflow Overzicht

```
┌─────────────────┐
│  Push to GitHub │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────┐
│  GitHub Actions Workflow:    │
│  - Checkout                  │
│  - Build images              │
│  - Push to ghcr.io           │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  ghcr.io Registry            │
│  - auth_api:latest           │
│  - employee_api:latest       │
│  - transit_api:latest        │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Portainer (Remote Server)   │
│  docker-compose pull & up    │
└──────────────────────────────┘
```

---

## 📝 Image Tags Automatisering

GitHub Actions genereert automatisch tags:

| Event | Tag |
|-------|-----|
| Push naar main | `latest`, `main-{SHA}` |
| Push naar develop | `develop-{SHA}` |
| Release/Tag | `v1.0.0`, `1.0`, `1` |

**Voorbeeld:**
```
ghcr.io/sven/transit_project/auth_api:latest
ghcr.io/sven/transit_project/auth_api:main-a1b2c3d
ghcr.io/sven/transit_project/auth_api:v1.0.0
```

---

## ⚙️ Configuratie

### docker-compose.portainer.yml aanpassen

1. **Vervang dit:**
   ```
   ghcr.io/YOUR_USERNAME/YOUR_REPO/auth_api:latest
   ```
   
2. **Met jouw gegevens:**
   ```
   ghcr.io/sven/transit_project/auth_api:latest
   ```

3. **Voor private image, pull policy toevoegen:**
   ```yaml
   auth_api:
     image: ghcr.io/sven/transit_project/auth_api:latest
     pull_policy: always
   ```

### Environment variabelen

**Maak .env file op Portainer server:**
```bash
POSTGRES_DB=transit_db
POSTGRES_USER=transit_user
POSTGRES_PASSWORD=super_secure_password
JWT_SECRET=your_secret_key_here
```

**Dan starten:**
```bash
docker-compose --env-file .env -f docker-compose.portainer.yml up -d
```

---

## 🔐 Veiligheid

### GitHub Token limieten
- Standaard `GITHUB_TOKEN` werkt goed
- Verloopt na 60 minuten (genoeg voor build)

### Private Registry
Als je Portainer server geen internet heeft:
- Use **Portainer Registry Mirror**
- Of **Private Registry** (Harbor, Nexus)

### Credentials in Portainer
**Nooit credentials in docker-compose zetten!**

✅ Juist: Environment file
```bash
docker-compose --env-file .env up -d
```

❌ Fout:
```yaml
environment:
  POSTGRES_PASSWORD: password123  # DON'T DO THIS
```

---

## 🐛 Troubleshooting

### "Image not found"
```bash
# Check of image in registry staat
docker pull ghcr.io/USERNAME/REPO/auth_api:latest

# Kijk in GitHub Actions logs
# Check je IMAGE naam in workflow
```

### "Unauthorized: authentication required"
```bash
# Login opnieuw
docker login ghcr.io

# Check token permissies (scope: write:packages)
```

### "Connection refused" naar database
```bash
# Check Docker network
docker network ls
docker network inspect YOUR_NETWORK

# Check database running
docker ps | grep postgres
```

### Logs bekijken
```bash
# Via docker
docker logs auth_api

# Via Portainer: Containers → Select → Logs
```

---

## 📚 Nuttige Commando's

```bash
# Check beschikbare images/tags
curl -s -H "Authorization: Bearer TOKEN" \
  https://ghcr.io/v2/USERNAME/REPO/auth_api/tags/list | jq

# Manual image build (als je workflow debug)
docker build -t ghcr.io/USERNAME/REPO/auth_api:test ./auth_api
docker push ghcr.io/USERNAME/REPO/auth_api:test

# Pull latest images
docker-compose -f docker-compose.portainer.yml pull

# Recreate containers (na pull)
docker-compose -f docker-compose.portainer.yml up -d --force-recreate
```

---

## 🎯 Samenvatting

| Stap | Wat | Waar |
|------|-----|------|
| 1 | Code pushen | GitHub |
| 2 | Images bouwen | GitHub Actions |
| 3 | Images pushen | ghcr.io registry |
| 4 | Images pullen | Portainer server |
| 5 | Containers starten | Docker Compose |

**Voordelen:**
- ✅ Volledig geautomatiseerd
- ✅ Versiebeheer via git tags
- ✅ Makkelijk rollback
- ✅ Geen lokale builds nodig
- ✅ CI/CD best practices

