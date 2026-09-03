import { test, expect, type Page } from "@playwright/test";

/**
 * 손상 데이터 내성 E2E.
 *
 * 배경: 손상된 객체 하나(`chartData.items` 가 문자열)가 뷰포트 가상화 경로에서
 * 예외를 던져 캔버스 전체를 죽인 사건이 있었다. 방어는 세 겹이다 —
 *   ① import 입구에서 스키마 검증(손상 객체만 제외)
 *   ② 렌더 경로 하드닝(geometry 는 어떤 입력에도 던지지 않는다)
 *   ③ 앱 레벨 ErrorBoundary(그래도 새면 복구 UI)
 * 이 스펙은 ①②의 결과 계약을 잠근다: **열려야 하고, 죽지 않아야 하고,
 * 멀쩡한 객체는 보존되어야 한다.**
 *
 * ③ 의 복구 UI 는 영구적인 E2E 트리거가 없다 — 크래시를 발견할 때마다 ①②로
 * 고치기 때문이다. 의도된 상태이며, 폴백 UI 자체는 수동 확인했다.
 */

/** 렌더 경로를 죽였던 실제 페이로드 */
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

/** 배열이어야 할 points 가 문자열 — 같은 버그 클래스 */
const BROKEN_LINE = {
  id: "broken-2",
  type: "line",
  x: 100,
  y: 400,
  rotation: 0,
  opacity: 1,
  points: "not-an-array",
  stroke: "#000000",
  strokeWidth: 2,
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
  await page.getByRole("button", { name: "파일" }).click();
  await page.waitForTimeout(150);
  const chooser = page.waitForEvent("filechooser");
  await page.getByText("파일 열기").click();
  await (
    await chooser
  ).setFiles({
    name: "recovery.pigma",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(board(objects))),
  });
  await page.waitForTimeout(1500);
}

/** 현재 캔버스를 .pigma 로 저장해 현재 페이지 objects 를 얻는다 */
async function saveAndGetObjects(page: Page) {
  await page.getByRole("button", { name: "파일" }).click();
  await page.waitForTimeout(150);
  const downloadPromise = page.waitForEvent("download");
  await page.getByText("파일로 저장").click();
  const download = await downloadPromise;
  const fs = await import("fs");
  const json = JSON.parse(fs.readFileSync((await download.path())!, "utf-8"));
  return json.pages.find((p: { id: string }) => p.id === json.currentPageId)
    .objects as { id: string }[];
}

test.describe("손상 데이터 내성", () => {
  test.beforeEach(async ({ page }) => {
    // ⚠️ addInitScript 는 **새로고침을 포함한 모든 네비게이션**에서 실행된다.
    // 무조건 localStorage.clear() 를 넣으면 reload 검증이 "데이터 손실"처럼
    // 보이는 가짜 실패를 낸다 — 세션 첫 로드에서만 비운다.
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("__test_cleared")) {
        localStorage.clear();
        sessionStorage.setItem("__test_cleared", "1");
      }
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("손상 객체가 섞여 있어도 캔버스가 죽지 않고 열린다", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await openBoard(page, [BROKEN_CHART, BROKEN_LINE, HEALTHY_SHAPE]);

    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await expect(page.locator("canvas").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("손상 객체는 제외하고 멀쩡한 객체는 보존한다", async ({ page }) => {
    await openBoard(page, [BROKEN_CHART, BROKEN_LINE, HEALTHY_SHAPE]);

    // 사용자에게 제외 사실을 알린다
    await expect(page.getByText(/damaged object\(s\) skipped/)).toBeVisible();

    const objects = await saveAndGetObjects(page);
    expect(objects.map((o) => o.id)).toEqual(["ok-1"]);
  });

  test("손상 객체를 연 뒤에도 보드는 계속 편집 가능하다", async ({ page }) => {
    await openBoard(page, [BROKEN_CHART, HEALTHY_SHAPE]);

    await page.keyboard.press("Escape");
    await page.keyboard.press("r");
    await page.waitForTimeout(150);
    await page.mouse.click(500, 500);
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");

    const objects = await saveAndGetObjects(page);
    expect(objects.length).toBe(2); // 기존 정상 1개 + 새로 만든 1개
  });

  test("손상 객체를 연 뒤 새로고침해도 데이터가 남는다", async ({ page }) => {
    await openBoard(page, [BROKEN_CHART, HEALTHY_SHAPE]);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await expect(page.locator("canvas").first()).toBeVisible();
    const objects = await saveAndGetObjects(page);
    expect(objects.map((o) => o.id)).toEqual(["ok-1"]);
  });

  test("정상 보드는 경고 없이 열린다", async ({ page }) => {
    await openBoard(page, [HEALTHY_SHAPE]);
    await expect(page.getByText("Project opened")).toBeVisible();
    await expect(page.getByText(/damaged/)).toHaveCount(0);
  });
});
