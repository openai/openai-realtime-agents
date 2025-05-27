#!/usr/bin/env bash
set -euo pipefail

NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \ . "$NVM_DIR/nvm.sh"
nvm use 18

npm ci

if [ ! -f .env.local ] && [ -f .env.example ]; then
  cp .env.example .env.local
fi

npm test || true
npm run lint || true
