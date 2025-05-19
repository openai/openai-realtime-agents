# Repository Guidelines

This project is a Next.js 15 application written in TypeScript. It demonstrates voice agent flows using the OpenAI Realtime API and includes simulation utilities for loan offers. The codebase is meant for Node.js **18** and uses npm as the package manager.

## Requirements

- Node.js 18 (`.nvmrc` specifies the version).
- npm (installed with Node).
- An OpenAI API key for both server and client use.
- Optional: face recognition models placed under `public/models` for `/api/face-verify`.

## Initial Setup

1. Install Node 18 (or activate via `nvm use`).
2. Run `npm install` to fetch dependencies.
3. Copy `.env.example` to `.env.local` and fill in:
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_OPENAI_API_KEY`
   - `NEXT_PUBLIC_USE_LLM_BACKEND` (set `true` to use the LLM backend for loan data).
4. Start the dev server with `npm run dev` and open `http://localhost:3000`.

## Testing and Linting

- `npm test` runs the Jest test suite located in `__tests__/`.
- `npm run lint` executes ESLint using the configuration in `eslint.config.mjs`.
- The CI workflow (`.github/workflows/ci.yml`) mirrors these commands.

## Build & Production

- Build the application with `npm run build`.
- Start the production server using `npm start`.

## Directory Overview

- `src/app/agentConfigs` – predefined agent sets and helper utilities.
- `src/app/api` – Next.js API routes (`/session`, `/loan`, `/chat`, etc.).
- `src/app/simple` – self‑contained demo UI components and contexts.
- `src/app/loanSimulator` – logic used when simulating loan offers.
- `public/` – static assets and face recognition models.
- `__tests__/` – Jest unit tests for key modules.

## Useful Scripts

- `create_structure.sh` – scaffolds the `src/app/simple` folder structure.
- `setup.sh` (see below) – installs dependencies and prepares the environment.

## Adding or Modifying Agents

Agent behaviour is defined under `src/app/agentConfigs`. Update
`index.ts` to register new agent sets or change `defaultAgentSetKey` to
switch the default scenario.

## Contribution Notes

- Use TypeScript for all new code.
- Keep functions small and document complex logic with comments.
- Run the tests and linter before committing.
- Large assets (such as additional face recognition models) should be placed in `public/models` and referenced from the `/api/face-verify` route.

---

## setup.sh

```bash
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
```
