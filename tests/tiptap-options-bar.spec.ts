import { test, expect, type Page } from "@playwright/test";

/**
 * TextOptionsBar E2E — 옵션바 조작이 편집 모드를 깨지 않고 서식이 적용되는지.
 * (구버전은 hidden textarea + 포트 하드코딩이라 전면 재작성, 2026-08-19)
 */

const EDITOR = ".tiptap-editor [contenteditable='true']";

async function createEditingStickyNote(page: Page) {
  await page.keyboard.press("s");
  await page.waitForTimeout(150);
  await page.mouse.click(500, 300);
  await page.waitForTimeout(300);
  // 생성만으론 편집 모드가 아님 — 더블클릭으로 진입
  await page.mouse.dblclick(560, 360);
  await page.waitForTimeout(400);
  await expect(page.locator(EDITOR)).toBeVisible();
}

test.describe("TextOptionsBar", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("볼드/취소선 버튼 — 서식 적용 + 편집 모드 유지 (기준 테스트)", async ({
    page,
  }) => {
    await createEditingStickyNote(page);
    await page.keyboard.type("styled text");
    await page.keyboard.press("ControlOrMeta+a");

    await page.getByTitle("Bold (Cmd+B)").click();
    await page.getByTitle("Strikethrough (Cmd+S)").click();
    await page.waitForTimeout(200);

    const editor = page.locator(EDITOR);
    await expect(editor).toBeVisible(); // 편집 모드 유지
    expect(await editor.locator("strong").count()).toBeGreaterThan(0);
    expect(await editor.locator("s").count()).toBeGreaterThan(0);
  });

  test("링크 메뉴 클릭 시 에디트 모드 유지", async ({ page }) => {
    await createEditingStickyNote(page);
    await page.keyboard.type("link target");
    await page.keyboard.press("ControlOrMeta+a");

    await page.getByTitle("Link", { exact: true }).click();
    await page.waitForTimeout(300);

    // 링크 입력 UI 가 뜨든 아니든, 편집 오버레이는 살아 있어야 한다
    await expect(page.locator(EDITOR)).toBeVisible();
  });

  test("텍스트 정렬 (왼쪽/가운데/오른쪽) 동작 확인", async ({ page }) => {
    await createEditingStickyNote(page);
    await page.keyboard.type("align me");

    await page.getByTitle("Align Center").click();
    await page.waitForTimeout(200);
    const editor = page.locator(EDITOR);
    await expect(editor.locator('[style*="center"]').first()).toBeVisible();

    await page.getByTitle("Align Right").click();
    await page.waitForTimeout(200);
    await expect(editor.locator('[style*="right"]').first()).toBeVisible();

    await page.getByTitle("Align Left").click();
    await page.waitForTimeout(200);
    await expect(editor).toBeVisible(); // 편집 모드 유지
  });

  test("리스트 버튼 — 불릿 리스트 적용 + 편집 모드 유지", async ({ page }) => {
    await createEditingStickyNote(page);
    await page.keyboard.type("item one");

    await page.getByTitle("Bullet List").click();
    await page.waitForTimeout(200);

    const editor = page.locator(EDITOR);
    await expect(editor).toBeVisible();
    expect(await editor.locator("ul li").count()).toBeGreaterThan(0);
  });
});
