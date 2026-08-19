import { test, expect } from "@playwright/test";

/**
 * TextBox 편집 진입 시 불필요한 줄바꿈이 생기지 않는지 회귀 테스트.
 * (구버전은 포트 하드코딩 + textarea 기반이라 재작성, 2026-08-19)
 */

const EDITOR = ".tiptap-editor [contenteditable='true']";

test.describe("TextBox 줄바꿈 회귀", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("편집 종료 → 재진입 시 문단 수가 유지된다 (선행 줄바꿈 없음)", async ({
    page,
  }) => {
    // TextBox 생성 + 더블클릭으로 편집 진입
    await page.keyboard.press("t");
    await page.waitForTimeout(150);
    await page.mouse.click(500, 300);
    await page.waitForTimeout(300);
    await page.mouse.dblclick(540, 315);
    await page.waitForTimeout(400);

    const editor = page.locator(EDITOR);
    await expect(editor).toBeVisible();
    await page.keyboard.type("single line");
    expect(await editor.locator("p").count()).toBe(1);

    // 편집 종료 후 더블클릭으로 재진입
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.mouse.dblclick(540, 310);
    await page.waitForTimeout(400);

    await expect(editor).toBeVisible();
    await expect(editor).toContainText("single line");
    // 재진입 시 문단이 늘어나 있으면(선행 줄바꿈) 회귀
    expect(await editor.locator("p").count()).toBe(1);
    const text = (await editor.textContent()) ?? "";
    expect(text.startsWith("\n")).toBe(false);
  });
});
