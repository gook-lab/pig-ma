# Testing Rules

> Applies to: `tests/**/*.ts`

## Framework

**Playwright** for E2E testing.

## Test Server

```bash
npm run dev -- --port 5000  # Start test server
npx playwright test         # Run tests
```

**Important:** Test server uses port 5000, dev server uses 3874.

## Screenshot Storage

| Type | Location |
|------|----------|
| Test captures | `tests/capture/` |
| Debug screenshots | `captures/` |

## Test Structure

```typescript
import { test, expect } from "@playwright/test";

test.describe("Feature Name", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:5000");
  });

  test("should do something", async ({ page }) => {
    // Arrange
    // Act
    // Assert
  });
});
```

## Best Practices

- Use `data-testid` for test selectors
- Avoid `page.waitForTimeout()` - use proper waits
- Keep tests independent (no shared state)
- Use fixtures for common setup
