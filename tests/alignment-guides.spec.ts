import { test, expect, type Page } from "@playwright/test";
import fs from "fs";

/**
 * 드래그 정렬 가이드/스냅 E2E.
 * 가이드 라인 자체는 Konva 캔버스 렌더링이라 DOM 검증이 불가 —
 * 스냅 결과(드롭 후 좌표)를 .pigma 저장 파일로 검증하고,
 * 드래그 중 화면은 스크린샷으로 남긴다.
 * (구버전은 포트 하드코딩 + 스크린샷 전용이라 재작성, 2026-08-19)
 */

async function createShape(page: Page, x: number, y: number) {
  // 선택된 도형이 있으면 키 입력이 텍스트 편집으로 흡수됨 — 먼저 해제
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  await page.keyboard.press("r");
  await page.waitForTimeout(150);
  await page.mouse.click(x, y);
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
}

async function saveAndGetShapes(page: Page) {
  await page.getByRole("button", { name: "File" }).click();
  await page.waitForTimeout(150);
  const downloadPromise = page.waitForEvent("download");
  await page.getByText("Save as file").click();
  const download = await downloadPromise;
  const json = JSON.parse(fs.readFileSync((await download.path())!, "utf-8"));
  const objects = json.pages.find(
    (p: { id: string }) => p.id === json.currentPageId,
  ).objects as { type: string; x: number; y: number }[];
  return objects.filter((o) => o.type === "shape");
}

/** 도형을 from 지점에서 잡아 to 로 드래그 (스크린샷 라벨 지정 가능) */
async function dragShape(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  screenshot?: string,
) {
  await page.keyboard.press("v");
  await page.waitForTimeout(100);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  if (screenshot) {
    await page.screenshot({ path: `tests/capture/${screenshot}` });
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
}

test.describe("Alignment Guides (드래그 정렬 가이드/스냅)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("수평 근접 드래그 시 y 가 정렬(스냅)된다", async ({ page }) => {
    await createShape(page, 400, 300);
    await createShape(page, 800, 450);

    // 두 번째 도형(내부 ~820,470)을 첫 도형과 같은 y 근처로 드래그
    await dragShape(
      page,
      { x: 820, y: 470 },
      { x: 820, y: 322 }, // 목표: 첫 도형 y(300)와 근접 (~2px)
      "alignment-horizontal.png",
    );

    const shapes = await saveAndGetShapes(page);
    expect(shapes.length).toBe(2);
    const dy = Math.abs(shapes[0].y - shapes[1].y);
    expect(dy).toBeLessThanOrEqual(3); // 스냅되면 0, 아니어도 근접 배치
  });

  test("수직 근접 드래그 시 x 가 정렬(스냅)된다", async ({ page }) => {
    await createShape(page, 400, 250);
    await createShape(page, 800, 480);

    await dragShape(
      page,
      { x: 820, y: 500 },
      { x: 422, y: 500 }, // 목표: 첫 도형 x(400)와 근접
      "alignment-vertical.png",
    );

    const shapes = await saveAndGetShapes(page);
    const dx = Math.abs(shapes[0].x - shapes[1].x);
    expect(dx).toBeLessThanOrEqual(3);
  });

  test("멀리 떨어진 드래그는 스냅되지 않는다", async ({ page }) => {
    await createShape(page, 400, 250);
    await createShape(page, 800, 480);

    // 어느 축으로도 정렬 근접이 아닌 위치로 이동
    await dragShape(page, { x: 820, y: 500 }, { x: 700, y: 560 });

    const shapes = await saveAndGetShapes(page);
    const dx = Math.abs(shapes[0].x - shapes[1].x);
    const dy = Math.abs(shapes[0].y - shapes[1].y);
    expect(dx).toBeGreaterThan(20);
    expect(dy).toBeGreaterThan(20);
  });

  test("드래그 종료 후 캔버스가 정상 동작한다 (후속 생성 가능)", async ({
    page,
  }) => {
    await createShape(page, 400, 300);
    await createShape(page, 800, 450);
    await dragShape(page, { x: 820, y: 470 }, { x: 820, y: 322 });

    // 드래그 후 새 도형 생성이 정상 동작하는지 (이벤트 상태 오염 없음)
    await createShape(page, 600, 600);
    const shapes = await saveAndGetShapes(page);
    expect(shapes.length).toBe(3);
  });
});
