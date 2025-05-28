# Contributing

Thank you for your interest in improving this project! To keep track of changes over time, please follow these guidelines when submitting a pull request.

## Document your changes

Whenever you make a significant modification to any source code or tests, add a short entry under the **O que mudou recentemente** section in [`AGENTS.md`](AGENTS.md). The entry should briefly describe what was changed and the month/year.

## Continuous integration check

The workflow [`check-agents.yml`](.github/workflows/check-agents.yml) verifies that `AGENTS.md` was updated whenever files inside `src/` or `__tests__/` change. If you forget to update the file, your pull request will fail this check with a message reminding you to document your changes.

Run the existing tests and linter with `npm test` and `npm run lint` before opening a PR.


## Optional pre-commit hook

A script is available at `scripts/git-hooks/pre-commit` that runs `npm test` and `npm run lint`, the same checks executed in CI. To have it run automatically before each commit, create a symbolic link:

```
ln -s ../../scripts/git-hooks/pre-commit .git/hooks/pre-commit
```

This step is optional but recommended for frequent contributors.
