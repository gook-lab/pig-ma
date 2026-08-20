import { test, expect, type Page } from "@playwright/test";

/**
 * 성능 벤치마크 — 합성 보드(1k/5k 노드)에서 팬/줌/드래그 FPS 실측.
 *
 * 기본 E2E 실행에서는 스킵된다. 실행:
 *   BENCH=1 npx playwright test tests/perf-bench.spec.ts --reporter=line
 *
 * 회귀 게이트가 아니라 실측 도구 — 수치는 콘솔로 출력하고,
 * 치명적 상태(FPS<5)만 실패 처리한다.
 */

test.skip(!process.env.BENCH, "BENCH=1 로만 실행하는 벤치마크");

// ============================================================================
// 합성 보드 생성 (.pigma 포맷)
// ============================================================================

interface BenchObject {
  id: string;
  type: string;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  [key: string]: unknown;
}

/** n개 노드 보드: 60% 도형(텍스트 포함), 20% 스티키, 10% 커넥터, 10% 프리핸드 */
function generateBoard(n: number) {
  const objects: BenchObject[] = [];
  const cols = Math.ceil(Math.sqrt(n) * 1.3);
  const spacing = 260;
  const shapes: string[] = [];

  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * spacing;
    const y = row * spacing;
    const kind = i % 10;

    if (kind < 6) {
      const id = `sh-${i}`;
      shapes.push(id);
      objects.push({
        id,
        type: "shape",
        shapeVariant: i % 3 === 0 ? "flowDecision" : "flowProcess",
        x,
        y,
        width: 160,
        height: 90,
        rotation: 0,
        opacity: 1,
        fill: "#ffffff",
        fillMode: "fill",
        stroke: "#374151",
        strokeWidth: 2,
        text: `Node ${i} 텍스트`,
        textColor: "#1f2937",
        fontSize: 14,
        textAlign: "center",
      });
    } else if (kind < 8) {
      objects.push({
        id: `st-${i}`,
        type: "stickyNote",
        x,
        y,
        width: 180,
        height: 180,
        rotation: 0,
        opacity: 1,
        backgroundColor: "#fef08a",
        text: `메모 ${i}\n둘째 줄 내용`,
      });
    } else if (kind < 9 && shapes.length >= 2) {
      const a = shapes[shapes.length - 2]!;
      const b = shapes[shapes.length - 1]!;
      objects.push({
        id: `cn-${i}`,
        type: "connector",
        x,
        y,
        endX: x + spacing,
        endY: y,
        rotation: 0,
        opacity: 1,
        sourceId: a,
        targetId: b,
        pathStyle: "straight",
        startMarker: "none",
        endMarker: "arrow",
        stroke: "#374151",
        strokeWidth: 2,
      });
    } else {
      // 프리핸드 (30 포인트 사인 곡선)
      const points: number[] = [];
      for (let p = 0; p < 30; p++) {
        points.push(p * 6, Math.sin(p / 3) * 25);
      }
      objects.push({
        id: `ln-${i}`,
        type: "line",
        x,
        y,
        points,
        penType: "pen",
        rotation: 0,
        opacity: 1,
        stroke: "#7c3aed",
        strokeWidth: 3,
      });
    }
  }

  return {
    type: "pigma",
    version: 1,
    projectName: `bench-${n}`,
    currentPageId: "p1",
    pages: [
      {
        id: "p1",
        name: "bench",
        objects,
        groups: [],
        captions: [],
        viewport: { x: 0, y: 0, zoom: 0.5 },
      },
    ],
  };
}

// ============================================================================
// 측정 헬퍼
// ============================================================================

async function loadBoard(page: Page, n: number) {
  const board = generateBoard(n);
  await page.getByRole("button", { name: "File" }).click();
  await page.waitForTimeout(150);
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText("Open file").click();
  const chooser = await chooserPromise;
  const t0 = Date.now();
  await chooser.setFiles({
    name: `bench-${n}.pigma`,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(board)),
  });
  await page.getByText("Project opened").waitFor({ timeout: 30000 });
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(1000); // 초기 렌더 안정화
  return loadMs;
}

/** duration 동안 rAF 프레임 수를 세서 FPS 반환 (action과 병행) */
async function measureFps(
  page: Page,
  durationMs: number,
  action: () => Promise<void>,
): Promise<number> {
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number; __stop: boolean };
    w.__frames = 0;
    w.__stop = false;
    const loop = () => {
      if (w.__stop) return;
      w.__frames++;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  const t0 = Date.now();
  await action();
  const remain = durationMs - (Date.now() - t0);
  if (remain > 0) await page.waitForTimeout(remain);
  const frames = await page.evaluate(() => {
    const w = window as unknown as { __frames: number; __stop: boolean };
    w.__stop = true;
    return w.__frames;
  });
  const elapsed = Math.max(Date.now() - t0, durationMs);
  return Math.round((frames / elapsed) * 1000);
}

/** 팬: Hand 도구로 좌우 드래그 반복 */
async function panAction(page: Page, durationMs: number) {
  await page.keyboard.press("h");
  await page.waitForTimeout(100);
  const t0 = Date.now();
  while (Date.now() - t0 < durationMs) {
    await page.mouse.move(400, 400);
    await page.mouse.down();
    await page.mouse.move(900, 450, { steps: 20 });
    await page.mouse.up();
    await page.mouse.move(900, 450);
    await page.mouse.down();
    await page.mouse.move(400, 400, { steps: 20 });
    await page.mouse.up();
  }
  await page.keyboard.press("v");
}

/** 줌: Cmd+휠 반복 (인/아웃 왕복) */
async function zoomAction(page: Page, durationMs: number) {
  await page.mouse.move(640, 400);
  await page.keyboard.down("ControlOrMeta");
  const t0 = Date.now();
  let dir = -1;
  while (Date.now() - t0 < durationMs) {
    for (let i = 0; i < 12; i++) {
      await page.mouse.wheel(0, dir * 60);
      await page.waitForTimeout(16);
    }
    dir *= -1;
  }
  await page.keyboard.up("ControlOrMeta");
}

/** 드래그: 도형 하나를 잡고 흔들기 */
async function dragAction(page: Page, durationMs: number) {
  await page.keyboard.press("v");
  await page.waitForTimeout(100);
  // 뷰포트 좌상단 근처의 도형 위치 (zoom 0.5, 첫 도형 0,0 → 화면 좌표 대략)
  await page.mouse.move(60, 120);
  await page.mouse.down();
  const t0 = Date.now();
  let dir = 1;
  while (Date.now() - t0 < durationMs) {
    await page.mouse.move(60 + dir * 200, 160, { steps: 15 });
    dir *= -1;
  }
  await page.mouse.up();
}

// ============================================================================
// 벤치마크
// ============================================================================

const SIZES = [1000, 5000];
const MEASURE_MS = 3000;

for (const n of SIZES) {
  test(`bench: ${n} nodes`, async ({ page }) => {
    test.setTimeout(180000);
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const loadMs = await loadBoard(page, n);

    const idle = await measureFps(page, MEASURE_MS, async () => {});
    const pan = await measureFps(page, MEASURE_MS, () =>
      panAction(page, MEASURE_MS),
    );
    const zoom = await measureFps(page, MEASURE_MS, () =>
      zoomAction(page, MEASURE_MS),
    );
    const drag = await measureFps(page, MEASURE_MS, () =>
      dragAction(page, MEASURE_MS),
    );

    console.log(
      `[bench:${n}] load=${loadMs}ms idle=${idle}fps pan=${pan}fps zoom=${zoom}fps drag=${drag}fps`,
    );

    // 치명 상태만 실패 (측정 도구이므로 느슨하게)
    expect(pan).toBeGreaterThan(5);
    expect(zoom).toBeGreaterThan(5);
  });
}
