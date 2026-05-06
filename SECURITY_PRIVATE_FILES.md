# Security: Private Files Exclusion

This document explains which files are kept private and why.

## Files Excluded from Git & Docker

### Deployment Documentation (Private)
- `ADMIN_DEPLOYMENT_SUMMARY.md` - Internal deployment status and setup details
- `CI_CD_PORTAINER_GUIDE.md` - Private CI/CD and Portainer configuration
- `DEPLOYMENT.md` - Deployment procedures and configuration guidance
- `GETTING_STARTED.md` - Internal setup instructions
- `INTERNAL_*.md` - Any file prefixed with INTERNAL_ (pattern-based exclusion)
- `SETUP_*.md` - Any file prefixed with SETUP_ (pattern-based exclusion)
- `DEPLOY_*.md` - Any file prefixed with DEPLOY_ (pattern-based exclusion)

### Custom Instruction Files (Private)
- `.instructions.md` - GitHub Copilot custom instructions
- `.prompt.md` - Custom prompt templates
- `.agent.md` - Custom agent definitions
- `SKILL.md` - Custom skill definitions
- `copilot-instructions.md` - Extended Copilot instructions
- `AGENTS.md` - Agent configuration

These are kept private to prevent exposure of:
- Development workflow details
- Copilot customization strategies
- Internal coding guidelines and preferences
- Prompt engineering techniques

### Private Scripts
- `scripts/private/` - Directory for private deployment scripts
- `scripts/*.local.*` - Local-specific script configurations

## Files Included in Public Repo

### Public Documentation
- `README.md` - Main project documentation
- `DOCKER_README.md` - Docker usage documentation
- `admin_ui/README.md` - Admin UI documentation
- `admin_ui/SCHEDULE_API.md` - Public API documentation
- `transit_api/README.md` - API documentation
- `bus_terminal/README.md` - Flutter app documentation

### Configuration
- `.env.example` - Environment variable template (no secrets)
- `.gitignore` - Git exclusion rules
- `.dockerignore` - Docker build exclusion rules
- `docker-compose.yml` - Service composition
- `Dockerfile` files - Container definitions

### Code & Configuration
- All source code in `auth_api/`, `transit_api/`, `employee_api/`, `admin_ui/`, `bus_terminal/`
- `package.json` files (no secrets, only dependencies)
- GitHub Actions workflows in `.github/workflows/`

## Environment Variables - NEVER Commit

Always keep the following OUT of git:
- `.env` - Local environment variables (in `.gitignore`)
- Database credentials
- JWT secrets
- API keys and tokens
- Private configuration files

Use `.env.example` as a template and create local `.env` files for development.

## Docker Build Security

All `.dockerignore` files (root and per-service) ensure that:
1. Sensitive documentation never enters Docker images
2. Private scripts and configs are excluded from builds
3. Only necessary source code and dependencies are included
4. Build artifacts don't leak internal information

## GitHub Actions Security

The CI/CD workflow in `.github/workflows/docker-build.yml`:
- Only builds from specific service directories (auth_api, transit_api, etc.)
- Respects `.dockerignore` rules
- Uses GitHub secrets for credentials (never hardcoded)
- Does not include workspace documentation in pushed images

## Best Practices

1. **Before committing**: Check that `.env` is in `.gitignore` and local files are not staged
2. **Before building Docker**: Verify `.dockerignore` files exclude private docs
3. **Before pushing images**: Confirm no sensitive data is present (`docker inspect --format=...`)
4. **Deployment**: Always use environment variables or secrets managers, never embed credentials
5. **Documentation**: Keep public docs in `*.md` files, private docs in separately excluded files

## Adding New Private Files

To keep new private files out of the repo and Docker:

1. Add pattern to `.gitignore`:
   ```
   MYFILE_*.md
   new_private_thing.*
   ```

2. Add pattern to `.dockerignore` (root and per-service):
   ```
   /MYFILE_*.md
   /new_private_thing.*
   ```

3. Verify with:
   ```bash
   git check-ignore -v MYFILE_something.md
   ```
