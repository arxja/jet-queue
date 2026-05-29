# Contributing to JetQueue

Thank you for your interest in contributing!  
JetQueue is an open‑source project and we welcome all contributions.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Please read it before participating.

## How Can I Contribute?

### Reporting Bugs

- Check the [existing issues](https://github.com/arxja/jet-queue/issues) first.
- Use the bug report template (if available) or include:
  - JetQueue version
  - Runtime (Node.js / Bun) and version
  - Clear description of the problem
  - Steps to reproduce
  - Expected vs actual behavior
  - Any relevant error logs

### Suggesting Features

- Open an issue with the label `enhancement`.
- Describe the use‑case and why it would be valuable.
- If you’re willing to implement it, mention that!

### Pull Requests

1. Fork the repository and create your branch from `main`.
2. If you added code, please add tests.
3. Ensure the test suite passes (`bun test`).
4. Make sure your code passes type checking (`bun run --bun tsc --noEmit`).
5. Follow the existing code style.
6. Write a clear commit message (see below).
7. Open a pull request against the `main` branch.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) (latest)
- [Node.js](https://nodejs.org) 20+ (for testing Node compatibility)
- [pnpm](https://pnpm.io) 8+

### Setup

```bash
git clone https://github.com/arxja/jet-queue.git
cd jet-queue
pnpm install
```

### Running Tests

```bash
bun test
```

### Building

```bash
pnpm build
```

### Running the Demo

```bash
# Terminal 1 (Bun)
cd examples/split-screen-demo
bun run server.ts

# Terminal 2 (Next.js)
cd examples/split-screen-demo
npm run dev
```

## Project Structure

```text
jet-queue/
├── packages/
│   ├── core/        # @jet-queue/core (engine)
│   ├── server/      # @jet-queue/server (Bun server)
│   ├── client/      # @jet-queue/client (SDK)
│   ├── cli/         # @jet-queue/cli (terminal dashboard)
│   └── dashboard/   # @jet-queue/dashboard (web UI)
├── examples/
├── docs/
└── scripts/
```

## Commit Message Guidelines

We use [Conventional Commits](https://conventionalcommits.org):

- `feat: add retry backoff strategy`
- `fix: handle job timeout correctly`
- `docs: update server API reference`
- `test: add coverage for priority queue`
- `chore: update dependencies`

## Style Guide

- TypeScript strict mode
- Use `async/await` over raw promises
- Explicit function return types for public API
- Single responsibility per file
- Keep core package zero‑dependencies

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

<br/>
<p align="center">Thank you for helping make JetQueue better!</p>
