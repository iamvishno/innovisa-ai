# Contributing to InnoVisa AI

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Set up** the development environment (see README.md)
4. **Create a branch** for your feature or fix

## Development Workflow

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes and test locally

# Commit with a descriptive message
git commit -m "feat: add new feature description"

# Push and create a pull request
git push origin feature/your-feature-name
```

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `style:` formatting, no code change
- `refactor:` code restructuring without feature change
- `test:` adding or updating tests
- `chore:` tooling, CI, dependency updates

## Code Style

### Backend (Python)
- Follow PEP 8
- Use type hints
- Use Pydantic models for request/response validation
- Keep functions focused and under 50 lines where possible

### Frontend (TypeScript/React)
- Use TypeScript strict mode
- Prefer functional components with hooks
- Use TanStack Query for server state
- Follow Tailwind CSS utility-first approach

## Pull Request Guidelines

1. **Describe** what your PR does and why
2. **Link** to any related issues
3. **Test** your changes locally (both frontend and backend)
4. **Keep PRs small** and focused on one change
5. **Update documentation** if you change APIs or features

## Reporting Issues

When reporting bugs, please include:
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS information
- Console errors or logs

## Questions?

Open a GitHub Discussion or create an issue tagged with `question`.
