const { execSync } = require('child_process');

const BASE_BRANCH = 'origin/main';

try {
  execSync(`git fetch origin main`, { stdio: 'inherit' });
} catch (err) {
  console.warn('Could not fetch origin/main:', err.message);
}

let baseExists = true;
try {
  execSync(`git rev-parse --verify ${BASE_BRANCH}`, { stdio: 'ignore' });
} catch {
  baseExists = false;
}

if (!baseExists) {
  console.warn(`${BASE_BRANCH} not found. Skipping AGENTS.md check.`);
  process.exit(0);
}

const diffFiles = execSync(`git diff --name-only ${BASE_BRANCH}`, {
  encoding: 'utf8'
})
  .split('\n')
  .filter(Boolean);

const sourcePatterns = [/^src\//, /^__tests__\//];
const sourceChanged = diffFiles.some((file) =>
  sourcePatterns.some((pattern) => pattern.test(file))
);

const agentsUpdated = diffFiles.includes('AGENTS.md');

if (sourceChanged && !agentsUpdated) {
  console.error('Source files changed but AGENTS.md not updated.');
  console.error('Please document your changes in AGENTS.md.');
  process.exit(1);
} else {
  console.log('AGENTS.md updated or no relevant source file changes detected.');
}
