#!/bin/bash
# Quick deployment helper script
# Usage: ./scripts/deploy.sh [start|stop|restart|logs|status]

set -e

COMMAND=${1:-status}

case $COMMAND in
  start)
    echo "🚀 Starting XTransit services..."
    docker-compose up -d
    echo "✅ Services started!"
    echo ""
    echo "📋 Service URLs:"
    echo "   Admin UI:     http://localhost:5174"
    echo "   Auth API:     http://localhost:5000"
    echo "   Transit API:  http://localhost:5001"
    echo "   Employee API: http://localhost:4000"
    ;;
  
  stop)
    echo "⏹️  Stopping XTransit services..."
    docker-compose down
    echo "✅ Services stopped!"
    ;;
  
  restart)
    echo "🔄 Restarting XTransit services..."
    docker-compose restart
    echo "✅ Services restarted!"
    ;;
  
  logs)
    SERVICE=${2:-admin_ui}
    echo "📋 Logs for $SERVICE (last 100 lines):"
    docker-compose logs --tail=100 -f $SERVICE
    ;;
  
  status)
    echo "📊 XTransit Services Status:"
    docker-compose ps
    ;;
  
  build)
    echo "🔨 Building all services..."
    docker-compose build
    echo "✅ Build complete!"
    ;;
  
  clean)
    echo "🧹 Cleaning up containers and volumes..."
    docker-compose down -v
    echo "✅ Cleanup complete!"
    ;;
  
  *)
    echo "Usage: $0 [start|stop|restart|logs|status|build|clean]"
    echo ""
    echo "Commands:"
    echo "  start         - Start all services"
    echo "  stop          - Stop all services"
    echo "  restart       - Restart all services"
    echo "  logs [svc]    - View logs (optional service name)"
    echo "  status        - Show service status"
    echo "  build         - Build all Docker images locally"
    echo "  clean         - Remove containers and volumes"
    exit 1
    ;;
esac
