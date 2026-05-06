#!/bin/bash
# Build and push Docker images to registry
# Usage: ./scripts/build-and-push.sh [registry-url]

set -e

REGISTRY=${1:-ghcr.io/sven491/xtransit}
VERSION=${2:-latest}

echo "🔨 Building Docker images..."

# Build auth_api
echo "  Building auth_api..."
docker build -t ${REGISTRY}/auth_api:${VERSION} ./auth_api

# Build transit_api
echo "  Building transit_api..."
docker build -t ${REGISTRY}/transit_api:${VERSION} ./transit_api

# Build employee_api
echo "  Building employee_api..."
docker build -t ${REGISTRY}/employee_api:${VERSION} ./employee_api

# Build admin_ui
echo "  Building admin_ui..."
docker build -t ${REGISTRY}/admin_ui:${VERSION} ./admin_ui

echo "✅ Build complete!"
echo ""
echo "🚀 Pushing images to registry: $REGISTRY"

docker push ${REGISTRY}/auth_api:${VERSION}
echo "  ✓ Pushed auth_api:${VERSION}"

docker push ${REGISTRY}/transit_api:${VERSION}
echo "  ✓ Pushed transit_api:${VERSION}"

docker push ${REGISTRY}/employee_api:${VERSION}
echo "  ✓ Pushed employee_api:${VERSION}"

docker push ${REGISTRY}/admin_ui:${VERSION}
echo "  ✓ Pushed admin_ui:${VERSION}"

echo ""
echo "✅ All images pushed successfully!"
echo ""
echo "Update docker-compose.yml with:"
echo "  image: ${REGISTRY}/auth_api:${VERSION}"
echo "  image: ${REGISTRY}/transit_api:${VERSION}"
echo "  image: ${REGISTRY}/employee_api:${VERSION}"
echo "  image: ${REGISTRY}/admin_ui:${VERSION}"
