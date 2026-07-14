# Contributing to kelly-js

Thanks for your interest in contributing! Here's how to get started.

## Getting Started

1. **Fork** this repo and create your branch from `main`
2. Branch naming: `feat/your-feature`, `fix/your-bug`, or `docs/your-docs`
3. Make your changes with clear, descriptive commits
4. **Test** your changes locally before opening a PR
5. Open a Pull Request — fill out the template and describe your changes

## Development Setup

kelly-js is a single-package TypeScript library with zero runtime dependencies.

```bash
git clone https://github.com/ianalloway/kelly-js
cd kelly-js
npm install
npm test          # run the Jest suite
npm run build     # compile src/index.ts -> dist/ with tsc
```

## Code Style

- TypeScript, zero runtime dependencies — don't add any without discussing it first.
- Run `npm run lint` (type-checks main + test sources) before committing.
- Keep functions small and focused — one job per function.
- Write self-documenting code; add comments only where logic is non-obvious.

## Pull Request Guidelines

- Keep PRs focused — one feature or bug fix per PR
- Include a clear description of **what** and **why**
- Reference related issues with `Closes #123`
- All CI checks must pass before merging
- Be responsive to review feedback

## Reporting Bugs

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md). Include:
- Steps to reproduce
- Expected vs actual behavior
- Environment info (OS, Node/Python version)

## Suggesting Features

Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md). Explain the problem it solves.

## Code of Conduct

Be respectful and constructive. Everyone is welcome here.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

Questions? Open an issue or reach out: **ian@allowayllc.com**
