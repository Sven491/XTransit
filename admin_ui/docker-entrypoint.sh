#!/bin/sh
set -e

cat > /usr/share/nginx/html/env-config.js <<EOF
window.__ENV__ = {
  AUTH_API: "${AUTH_API:-http://localhost:5000}",
  TRANSIT_API: "${TRANSIT_API:-http://localhost:5001}"
}
EOF

exec nginx -g 'daemon off;'
