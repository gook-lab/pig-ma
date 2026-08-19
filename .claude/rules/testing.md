# Testing Rules

> Applies to: `tests/**/*.ts`

## Framework

**Playwright** for E2E testing.

## Test Server

```bash
npx playwright test   # webServer가 포트 5006 테스트 서버를 자동 기동
```

**Important:** 테스트 서버는 5006 (playwright.config.ts `webServer`가 자동
기동 — 수동으로 띄우지 않는다), 개발 서버는 3874.

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
    await page.goto("/"); // baseURL 상대경로 — 포트 하드코딩 금지
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
