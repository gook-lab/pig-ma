import { test, expect, type Page } from "@playwright/test";
import fs from "fs";

/**
 * 스티키노트/텍스트박스 텍스트 편집 E2E — Tiptap 오버레이 기준.
 * (구버전은 hidden textarea 기반이라 전면 재작성, 2026-08-19)
 *
 * 노하우: 객체 생성 직후 편집 모드가 자동으로 켜진다. R/S/T 키는
 * 좌측 패널을 열 수 있으므로 클릭은 x>300 영역에서 한다.
 */

const EDITOR = ".tiptap-editor [contenteditable='true']";

/** 스티키노트 생성 + 더블클릭으로 편집 진입 (생성만으론 편집 모드가 아님) */
async function createStickyNote(page: Page, x: number, y: number) {
  await page.keyboard.press("s");
  await page.waitForTimeout(150);
  await page.mouse.click(x, y);
  await page.waitForTimeout(300);
  await page.mouse.dblclick(x + 60, y + 60);
  await page.waitForTimeout(400);
}

/** 텍스트박스 생성 + 더블클릭으로 편집 진입 */
async function createTextBox(page: Page, x: number, y: number) {
  await page.keyboard.press("t");
  await page.waitForTimeout(150);
  await page.mouse.click(x, y);
  await page.waitForTimeout(300);
  await page.mouse.dblclick(x + 40, y + 15);
  await page.waitForTimeout(400);
}

/** 현재 캔버스를 .pigma 로 저장해 현재 페이지 objects 를 얻는다 */
async function saveAndGetObjects(page: Page) {
  await page.getByRole("button", { name: "파일" }).click();
  await page.waitForTimeout(150);
  const downloadPromise = page.waitForEvent("download");
  await page.getByText("파일로 저장").click();
  const download = await downloadPromise;
  const json = JSON.parse(fs.readFileSync((await download.path())!, "utf-8"));
  return json.pages.find((p: { id: string }) => p.id === json.currentPageId)
    .objects as { type: string; text?: string; tiptapContent?: unknown }[];
}

test.describe("텍스트 편집 (Tiptap 오버레이)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("스티키노트 편집 모드에서 여러 줄 입력이 된다", async ({ page }) => {
    await createStickyNote(page, 500, 300);

    const editor = page.locator(EDITOR);
    await expect(editor).toBeVisible();

    await page.keyboard.type("첫째 줄");
    await page.keyboard.press("Enter");
    await page.keyboard.type("둘째 줄");
    await page.keyboard.press("Enter");
    await page.keyboard.type("셋째 줄");
    await page.waitForTimeout(200);

    await expect(editor).toContainText("첫째 줄");
    await expect(editor).toContainText("셋째 줄");
    expect(await editor.locator("p").count()).toBe(3);
  });

  test("에디터 안 Cmd+A 는 텍스트만 선택한다 (캔버스 전체 선택 아님)", async ({
    page,
  }) => {
    await createStickyNote(page, 500, 300);
    await page.keyboard.type("hello world");
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("replaced");
    await page.waitForTimeout(200);

    const editor = page.locator(EDITOR);
    await expect(editor).toContainText("replaced");
    await expect(editor).not.toContainText("hello");
  });

  test("Bold/Strikethrough 서식이 에디터 HTML 에 반영된다", async ({
    page,
  }) => {
    await createStickyNote(page, 500, 300);
    await page.keyboard.type("format me");
    await page.keyboard.press("ControlOrMeta+a");

    await page.getByTitle("Bold (Cmd+B)").click();
    await page.waitForTimeout(200);
    const editor = page.locator(EDITOR);
    expect(await editor.locator("strong").count()).toBeGreaterThan(0);

    await page.getByTitle("Strikethrough (Cmd+S)").click();
    await page.waitForTimeout(200);
    expect(await editor.locator("s").count()).toBeGreaterThan(0);
    // 서식 적용 후에도 편집 모드 유지
    await expect(editor).toBeVisible();
  });

  test("Escape 로 편집이 종료되고 텍스트가 저장된다", async ({ page }) => {
    await createStickyNote(page, 500, 300);
    await page.keyboard.type("persist me");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await expect(page.locator(EDITOR)).not.toBeVisible();

    const objects = await saveAndGetObjects(page);
    const note = objects.find((o) => o.type === "stickyNote")!;
    expect(JSON.stringify(note.tiptapContent ?? note.text)).toContain(
      "persist me",
    );
  });

  test("더블클릭으로 재편집 진입 시 기존 텍스트가 유지된다", async ({
    page,
  }) => {
    await createStickyNote(page, 500, 300);
    await page.keyboard.type("first pass");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await page.mouse.dblclick(560, 360); // 노트 내부
    await page.waitForTimeout(400);

    const editor = page.locator(EDITOR);
    await expect(editor).toBeVisible();
    await expect(editor).toContainText("first pass");
  });

  test("텍스트박스 기본 입력 후 저장까지 반영된다", async ({ page }) => {
    await createTextBox(page, 500, 300);

    const editor = page.locator(EDITOR);
    await expect(editor).toBeVisible();
    await page.keyboard.type("textbox contents");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    const objects = await saveAndGetObjects(page);
    const box = objects.find((o) => o.type === "textBox")!;
    expect(JSON.stringify(box.tiptapContent ?? box.text)).toContain(
      "textbox contents",
    );
  });
});
