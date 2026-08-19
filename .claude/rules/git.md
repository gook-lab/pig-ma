# Git Conventions

## Commit Message Format

```
<type>: <subject>

<body>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### Types

| Type | Use Case |
|------|----------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change without feature/fix |
| `style` | Formatting, no code change |
| `docs` | Documentation only |
| `test` | Adding/updating tests |
| `chore` | Build, config, dependencies |

### Subject Rules

- Imperative mood: "add" not "added" or "adds"
- No period at end
- Max 50 characters
- Lowercase

### Examples

```
feat: add pie chart style selector

- Support 5 styles: default, donut, 3d, rounded, gradient
- Fix Wedge innerRadius issue by using Arc component

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

## Branch Naming

- `feat/short-description`
- `fix/issue-number-description`
- `refactor/component-name`

## Pre-commit

Always run formatting before commit:
```bash
./scripts/convert-format-code.sh
```
