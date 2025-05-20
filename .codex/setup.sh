#!/usr/bin/env bash
set -euo pipefail

NODE_VERSION=18

if ! command -v node >/dev/null || ! node -v | grep -q "^v$NODE_VERSION"; then
  echo "Installing Node.js $NODE_VERSION..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
fi

npm install
npm test || true
npm run lint || true
