#!/usr/bin/env bash
set -euo pipefail

# Start from the script directory so relative paths work
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure Node 18 using nvm
if [ -f ".nvmrc" ]; then
  NODE_VERSION="$(cat .nvmrc)"
else
  NODE_VERSION="18"
fi

if ! command -v nvm >/dev/null 2>&1; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi

nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"

# Install dependencies
npm install

# Prepare environment file
if [ ! -f .env.local ] && [ -f .env.example ]; then
  cp .env.example .env.local
  echo "Edit .env.local with your API keys." >&2
fi

# Run checks
npm test
npm run lint

echo "Setup complete. Run 'npm run dev' to start the dev server."
