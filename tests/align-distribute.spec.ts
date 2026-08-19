import { test, expect, type Page } from "@playwright/test";
import fs from "fs";

/**
 * 정렬/분배 E2E — 다중 선택 시 옵션바 표시, 정렬 결과는
 * .pigma 저장 파일의 좌표로 검증한다 (store 직접 접근 없이).
 */

async function createShape(page: Page, x: number, y: number) {
  await page.keyboard.press("r");
  await page.waitForTimeout(150);
  await page.mouse.click(x, y);
  await page.waitForTimeout(250);
  // 생성 직후 텍스트 편집 모드가 켜져 다음 키 입력을 삼킨다 — 편집 종료
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
}

/** Cmd+A 전체 선택 (편집 모드 종료 후) */
async function selectAll(page: Page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  await page.keyboard.press("v");
  await page.waitForTimeout(100);
  await page.keyboard.press("ControlOrMeta+a");
  await page.waitForTimeout(300);
}

/** 현재 캔버스를 .pigma 로 저장해 현재 페이지 objects 를 얻는다 */
async function saveAndGetObjects(page: Page) {
  await page.getByRole("button", { name: "File" }).click();
  await page.waitForTimeout(150);
  const downloadPromise = page.waitForEvent("download");
  await page.getByText("Save as file").click();
  const download = await downloadPromise;
  const json = JSON.parse(fs.readFileSync((await download.path())!, "utf-8"));
  const currentPage = json.pages.find(
    (p: { id: string }) => p.id === json.currentPageId,
  );
  return currentPage.objects as { x: number; y: number; type: string }[];
}

test.describe("Align & Distribute", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("2개 미만 선택 시 정렬 옵션바가 없다", async ({ page }) => {
    await createShape(page, 400, 300);
    await page.keyboard.press("v");
    await page.mouse.click(400, 300);
    await page.waitForTimeout(200);

    // "Distribute horizontally" 는 AlignOptionsBar 에만 존재하는 라벨
    await expect(page.getByLabel("Distribute horizontally")).toHaveCount(0);
  });

  test("다중 선택 시 옵션바 표시, Align top 으로 y 가 정렬된다", async ({
    page,
  }) => {
    await createShape(page, 350, 280);
    await createShape(page, 620, 360);
    await createShape(page, 900, 460);
    await selectAll(page);

    const alignTop = page.getByLabel("Align top");
    await expect(alignTop).toBeVisible();
    await alignTop.click();
    await page.waitForTimeout(200);

    const objects = await saveAndGetObjects(page);
    const shapes = objects.filter((o) => o.type === "shape");
    expect(shapes.length).toBe(3);
    const ys = shapes.map((s) => s.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.5);
  });

  test("3개 선택 시 등간격 분배가 동작한다", async ({ page }) => {
    // x 간격이 불균등한 3개 도형.
    // 주의: R 키는 좌측 Shapes 패널(~270px)을 함께 열므로 x>300 에 클릭해야 하고,
    // 기존 도형과 겹치는 지점 클릭은 생성되지 않으므로 충분히 벌린다.
    await createShape(page, 350, 250);
    await createShape(page, 620, 250);
    await createShape(page, 1080, 250);
    await selectAll(page);

    const distribute = page.getByLabel("Distribute horizontally");
    await expect(distribute).toBeEnabled();
    await distribute.click();
    await page.waitForTimeout(200);

    const objects = await saveAndGetObjects(page);
    const xs = objects
      .filter((o) => o.type === "shape")
      .map((s) => s.x)
      .sort((a, b) => a - b);
    expect(xs.length).toBe(3);
    const gap1 = xs[1] - xs[0];
    const gap2 = xs[2] - xs[1];
    expect(Math.abs(gap1 - gap2)).toBeLessThan(0.5);
  });

  test("2개 선택 시 분배 버튼은 비활성화", async ({ page }) => {
    await createShape(page, 350, 300);
    await createShape(page, 700, 400);
    await selectAll(page);

    await expect(page.getByLabel("Align top")).toBeVisible();
    await expect(page.getByLabel("Distribute horizontally")).toBeDisabled();
  });
});
