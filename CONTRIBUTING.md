# Contributing to This Project

First off, thank you for considering contributing to this project! It's people like you that make open source such a great community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Pull Requests](#pull-requests)
- [Development Setup](#development-setup)
- [Style Guidelines](#style-guidelines)
  - [Git Commit Messages](#git-commit-messages)
  - [Code Style](#code-style)
- [Branch Naming Convention](#branch-naming-convention)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

**Bug Report Template:**

- **Title**: Clear and descriptive title
- **Description**: Detailed description of the issue
- **Steps to Reproduce**:
  1. Go to '...'
  2. Click on '...'
  3. See error
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Screenshots**: If applicable
- **Environment**:
  - OS: [e.g., Windows 10, macOS 12]
  - Browser: [e.g., Chrome 96, Firefox 95]
  - Version: [e.g., 1.0.0]

### Suggesting Features

Feature suggestions are welcome! Please provide:

- **Clear title** describing the feature
- **Detailed description** of the proposed functionality
- **Use case**: Why this feature would be useful
- **Possible implementation**: If you have ideas on how to implement it

Before suggesting, please check if:

- The feature already exists
- There's an open issue for this feature
- It aligns with the project's goals

### Pull Requests

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create a branch** for your feature or fix
4. **Make your changes** following our style guidelines
5. **Test** your changes thoroughly
6. **Commit** your changes with clear messages
7. **Push** to your fork
8. **Open a Pull Request**

**Pull Request Checklist:**

- [ ] Code follows the project's style guidelines
- [ ] Self-review of the code completed
- [ ] Comments added for complex logic
- [ ] Documentation updated (if needed)
- [ ] No new warnings or errors introduced
- [ ] Tests added/updated (if applicable)

## Development Setup

### Prerequisites

Make sure you have the following installed:

- Git
- A code editor (VS Code recommended)
- Required runtime/dependencies for the project

### Local Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/REPOSITORY_NAME.git

# Navigate to project directory
cd REPOSITORY_NAME

# Install dependencies (if applicable)
# npm install / pip install -r requirements.txt / etc.

# Start development server (if applicable)
# npm start / python app.py / etc.
```

## Style Guidelines

### Git Commit Messages

We follow semantic commit messages:

| Prefix      | Description                           |
| ----------- | ------------------------------------- |
| `feat:`     | New feature                           |
| `fix:`      | Bug fix                               |
| `docs:`     | Documentation changes                 |
| `style:`    | Code style changes (formatting, etc.) |
| `refactor:` | Code refactoring                      |
| `test:`     | Adding or updating tests              |
| `chore:`    | Maintenance tasks                     |

**Examples:**

```
feat: add user authentication
fix: resolve login redirect issue
docs: update installation instructions
style: format code with prettier
refactor: simplify validation logic
```

**Commit Message Rules:**

- Use imperative mood ("add" not "added")
- Keep first line under 72 characters
- Separate subject from body with blank line
- Use body to explain _what_ and _why_, not _how_

### Code Style

- Use consistent indentation (2 or 4 spaces)
- Use meaningful variable and function names
- Write comments for complex logic
- Keep functions small and focused
- Follow DRY (Don't Repeat Yourself) principle
- Remove unused code and imports

## Branch Naming Convention

Use descriptive branch names with prefixes:

| Prefix      | Use Case         | Example                   |
| ----------- | ---------------- | ------------------------- |
| `feature/`  | New features     | `feature/user-auth`       |
| `fix/`      | Bug fixes        | `fix/login-error`         |
| `hotfix/`   | Urgent fixes     | `hotfix/security-patch`   |
| `docs/`     | Documentation    | `docs/api-guide`          |
| `refactor/` | Code refactoring | `refactor/database-layer` |

## Questions?

Feel free to open an issue with your question or contact the maintainer directly.

---

Thank you for contributing!
