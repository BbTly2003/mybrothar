#!/bin/sh
# MyBrothar — arranque en Linux / Mac
cd "$(dirname "$0")" || exit 1
export NODE_ENV=production
export DATABASE_URL="file:$PWD/db/custom.db"
export PORT="${PORT:-3000}"
export HOSTNAME="0.0.0.0"

echo ""
echo "  ===================================="
echo "   🎲  MYBROTHAR — dominó para 4"
echo "  ===================================="
echo "   Abre  http://localhost:$PORT  en tu navegador"
echo "   (Ctrl + C para salir)"
echo ""
node server.js
