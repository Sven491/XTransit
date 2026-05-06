#!/bin/sh
set -e

# Create runtime env-config.js for the static app
cat > /usr/share/nginx/html/env-config.js <<'EOF'
window.__ENV__ = {
  VITE_AUTH_API: "${VITE_AUTH_API:-http://localhost:5000}",
  VITE_TRANSIT_API: "${VITE_TRANSIT_API:-http://localhost:5001}"
}
EOF

exec nginx -g 'daemon off;'
