#!/bin/bash
# XTransit Project - Initial Setup Script
# This script prepares the environment for local development or deployment

set -e

echo "🚀 XTransit Transit Project - Setup Script"
echo "=========================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker."
    exit 1
fi
echo "✅ Docker found: $(docker --version)"

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose."
    exit 1
fi
echo "✅ Docker Compose found: $(docker-compose --version)"

echo ""
echo "📝 Setting up configuration..."

# Create .env if it doesn't exist
if [ -f .env ]; then
    echo "⚠️  .env file already exists, skipping creation"
else
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env created. Please edit it with your database credentials."
    echo ""
    echo "Required values to set:"
    echo "  - POSTGRES_HOST: Your PostgreSQL server hostname"
    echo "  - POSTGRES_PORT: PostgreSQL port (default: 5432)"
    echo "  - POSTGRES_DB: Database name (default: XTransit)"
    echo "  - POSTGRES_USER_AUTH: Auth API database user"
    echo "  - POSTGRES_PASSWORD_AUTH: Auth API database password"
    echo "  - POSTGRES_USER_TRANSIT: Transit API database user"
    echo "  - POSTGRES_PASSWORD_TRANSIT: Transit API database password"
    echo "  - POSTGRES_USER_EMPLOYEE: Employee API database user"
    echo "  - POSTGRES_PASSWORD_EMPLOYEE: Employee API database password"
    echo "  - JWT_SECRET: JWT signing secret"
    echo "  - ADMIN_USER_CODES: Comma-separated admin user codes"
    echo ""
    echo "✏️  Edit .env file now? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        ${EDITOR:-nano} .env
    fi
fi

echo ""
echo "📦 Building Docker images..."
docker-compose build

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Review and update .env with your database credentials"
echo "  2. Start services: ./scripts/deploy.sh start"
echo "  3. Access Admin UI: http://localhost:5174"
echo ""
echo "Available commands:"
echo "  ./scripts/deploy.sh start       - Start all services"
echo "  ./scripts/deploy.sh stop        - Stop all services"
echo "  ./scripts/deploy.sh logs        - View logs"
echo "  ./scripts/deploy.sh status      - Show service status"
echo ""
echo "Documentation:"
echo "  - DEPLOYMENT.md - Comprehensive deployment guide"
echo "  - DOCKER_README.md - Docker specific instructions"
echo "  - admin_ui/README.md - Admin UI documentation"
