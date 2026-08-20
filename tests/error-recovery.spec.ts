import { test, expect, type Page } from "@playwright/test";

/**
 * 렌더 에러 복구 E2E.
 *
 * 손상된 객체(chartData.items 가 배열이 아님)는 실제로 렌더 에러를 던진다 —
 * 바운더리가 없으면 캔버스 전체가 백색이 된다.
 *
 * 측정으로 확인한 사실: persist 재수화에는 zod 검증이 있어 새로고침하면
 * 손상 객체가 걸러진다. 즉 독성 상태가 영구화되지는 않으며, 취약한 쪽은
 * **검증 없이 store 에 밀어 넣는 import 경로**다.
 */

/** chartData.items 가 문자열 — Chart 렌더의 legendItems 순회에서 throw */
const BROKEN_CHART = {
  id: "broken-1",
  type: "chart",
  x: 250,
  y: 180,
  width: 300,
  height: 200,
  rotation: 0,
  opacity: 1,
  chartData: { variant: "bar", items: "not-an-array" },
};

const HEALTHY_SHAPE = {
  id: "ok-1",
  type: "shape",
  shapeVariant: "flowProcess",
  x: 700,
  y: 200,
  width: 200,
  height: 120,
  rotation: 0,
  opacity: 1,
  fill: "#ffffff",
  fillMode: "fill",
  stroke: "#374151",
  strokeWidth: 2,
  text: "healthy",
};

function board(objects: unknown[]) {
  return {
    type: "pigma",
    version: 1,
    projectName: "recovery",
    currentPageId: "p1",
    pages: [
      {
        id: "p1",
        name: "p",
        objects,
        groups: [],
        captions: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    ],
  };
}

async function openBoard(page: Page, objects: unknown[]) {
  await page.getByRole("button", { name: "File" }).click();
  await page.waitForTimeout(150);
  const chooser = page.waitForEvent("filechooser");
  await page.getByText("Open file").click();
  await (
    await chooser
  ).setFiles({
    name: "recovery.pigma",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(board(objects))),
  });
  await page.waitForTimeout(1500);
}

test.describe("렌더 에러 복구", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("렌더 에러를 잡아 복구 UI를 띄운다 (백색 화면 방지)", async ({
    page,
  }) => {
    await openBoard(page, [BROKEN_CHART, HEALTHY_SHAPE]);

    await expect(page.getByText("Something went wrong")).toBeVisible();
    await expect(page.getByText("Save a backup (.pigma)")).toBeVisible();
    await expect(page.getByText("Reset saved board and reload")).toBeVisible();
  });

  test("복구 UI에서 백업을 내려받을 수 있다 (초기화 전 데이터 보존)", async ({
    page,
  }) => {
    await openBoard(page, [BROKEN_CHART]);
    await expect(page.getByText("Something went wrong")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByText("Save a backup (.pigma)").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename().endsWith(".pigma")).toBe(true);
  });

  test("새로고침하면 persist 검증(zod)이 손상 상태를 걸러 정상 복귀한다", async ({
    page,
  }) => {
    await openBoard(page, [BROKEN_CHART]);
    await expect(page.getByText("Something went wrong")).toBeVisible();

    // persist 경로에는 validatePersistedState(zod) 가 있어 재수화 시 손상
    // 객체가 걸러진다 — import 경로에만 검증이 없다는 비대칭의 반증이기도 하다
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await expect(page.locator("canvas").first()).toBeVisible();
  });

  test("초기화 버튼은 저장 상태를 버리고 정상 캔버스로 돌아온다", async ({
    page,
  }) => {
    await openBoard(page, [BROKEN_CHART]);
    await expect(page.getByText("Something went wrong")).toBeVisible();

    await page.getByText("Reset saved board and reload").click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await expect(page.locator("canvas").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "File" })).toBeVisible();
    // 저장 키가 비워졌다
    const persisted = await page.evaluate(() =>
      localStorage.getItem("canvas-app"),
    );
    expect(persisted === null || !persisted.includes("broken-1")).toBe(true);
  });

  test("정상 보드에서는 복구 UI가 뜨지 않는다", async ({ page }) => {
    await openBoard(page, [HEALTHY_SHAPE]);
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await expect(page.locator("canvas").first()).toBeVisible();
  });
});
