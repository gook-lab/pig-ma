import { test, expect, type Page } from "@playwright/test";
import fs from "fs";

/**
 * File 메뉴 I/O E2E — .pigma 저장/열기, Excalidraw import/export, Mermaid import.
 * 토스트 텍스트와 다운로드 파일 내용으로 검증한다.
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

async function openFileMenu(page: Page) {
  await page.getByRole("button", { name: "File" }).click();
  await page.waitForTimeout(150);
}

/** 다운로드 파일을 JSON 으로 파싱 */
async function downloadJson(page: Page, trigger: () => Promise<void>) {
  const downloadPromise = page.waitForEvent("download");
  await trigger();
  const download = await downloadPromise;
  const path = await download.path();
  return {
    filename: download.suggestedFilename(),
    json: JSON.parse(fs.readFileSync(path!, "utf-8")),
  };
}

/**
 * 파일 메뉴 항목 클릭 → 네이티브 파일 선택창(filechooser)에 파일 주입.
 * 숨김 input 에 직접 setInputFiles 하면 이미 열린 chooser 가 이벤트를
 * 삼켜서 onChange 가 발화하지 않는다.
 */
async function chooseFile(
  page: Page,
  menuLabel: string,
  file: { name: string; buffer: Buffer },
) {
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText(menuLabel).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: file.name,
    mimeType: "application/json",
    buffer: file.buffer,
  });
}

test.describe("File I/O", () => {
  test.beforeEach(async ({ page }) => {
    // persist 된 이전 상태 제거 후 진입
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test(".pigma 저장 — 도형 1개가 파일에 직렬화된다", async ({ page }) => {
    await createShape(page, 400, 300);

    await openFileMenu(page);
    const { filename, json } = await downloadJson(page, () =>
      page.getByText("Save as file").click(),
    );

    expect(filename.endsWith(".pigma")).toBe(true);
    expect(json.type).toBe("pigma");
    const currentPage = json.pages.find(
      (p: { id: string }) => p.id === json.currentPageId,
    );
    expect(currentPage.objects.length).toBe(1);
    await expect(page.getByText(/^Saved /)).toBeVisible();
  });

  test(".pigma 열기 — 교체 confirm 후 프로젝트가 로드된다", async ({
    page,
  }) => {
    await createShape(page, 400, 300); // 기존 콘텐츠 → confirm 발생 조건

    const pigmaFile = {
      type: "pigma",
      version: 1,
      exportedAt: "2026-08-19T00:00:00.000Z",
      projectName: "E2E Project",
      currentPageId: "p1",
      pages: [
        {
          id: "p1",
          name: "page",
          objects: [
            {
              id: "obj1",
              type: "shape",
              shapeVariant: "rectangle",
              x: 100,
              y: 100,
              width: 120,
              height: 80,
              rotation: 0,
              opacity: 1,
              fill: "#3b82f6",
            },
            {
              id: "obj2",
              type: "shape",
              shapeVariant: "ellipse",
              x: 300,
              y: 200,
              width: 100,
              height: 100,
              rotation: 0,
              opacity: 1,
              fill: "#ef4444",
            },
          ],
          groups: [],
          captions: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      ],
    };

    page.once("dialog", (dialog) => dialog.accept());
    await openFileMenu(page);
    await chooseFile(page, "Open file", {
      name: "e2e.pigma",
      buffer: Buffer.from(JSON.stringify(pigmaFile)),
    });

    await expect(page.getByText("Project opened")).toBeVisible();
    await expect(page.getByText(/"E2E Project" — 1 page/)).toBeVisible();
    // 이전 프로젝트 백업 안내 포함
    await expect(page.getByText(/backed up/)).toBeVisible();
  });

  test("백업 복원 — 열기 이전 프로젝트로 되돌아간다", async ({ page }) => {
    await createShape(page, 400, 300);

    const pigmaFile = {
      type: "pigma",
      version: 1,
      projectName: "Replacement",
      currentPageId: "p1",
      pages: [
        {
          id: "p1",
          name: "page",
          objects: [],
          groups: [],
          captions: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      ],
    };
    page.once("dialog", (dialog) => dialog.accept());
    await openFileMenu(page);
    await chooseFile(page, "Open file", {
      name: "replace.pigma",
      buffer: Buffer.from(JSON.stringify(pigmaFile)),
    });
    await expect(page.getByText("Project opened")).toBeVisible();

    // Restore last backup 항목이 나타나고, 복원하면 이전 도형이 돌아온다
    await openFileMenu(page);
    await page.getByText("Restore last backup").click();
    await expect(page.getByText("Backup restored")).toBeVisible();

    // 복원된 프로젝트를 저장해 도형 1개 확인
    await openFileMenu(page);
    const { json } = await downloadJson(page, () =>
      page.getByText("Save as file").click(),
    );
    const currentPage = json.pages.find(
      (p: { id: string }) => p.id === json.currentPageId,
    );
    expect(currentPage.objects.length).toBe(1);
  });

  test("Excalidraw import — 요소가 추가되고 토스트가 뜬다", async ({
    page,
  }) => {
    const excalidraw = {
      type: "excalidraw",
      version: 2,
      elements: [
        {
          id: "r1",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 100,
          height: 60,
          strokeColor: "#1e1e1e",
          backgroundColor: "#ffc9c9",
        },
        {
          id: "t1",
          type: "text",
          x: 0,
          y: 100,
          width: 80,
          height: 24,
          text: "hello",
          fontSize: 20,
          strokeColor: "#e03131",
        },
      ],
    };

    await openFileMenu(page);
    await chooseFile(page, "Import Excalidraw", {
      name: "e2e.excalidraw",
      buffer: Buffer.from(JSON.stringify(excalidraw)),
    });

    await expect(page.getByText("Excalidraw imported")).toBeVisible();
    await expect(page.getByText("2 object(s) added")).toBeVisible();
  });

  test("Excalidraw export — 캔버스 도형이 요소로 내보내진다", async ({
    page,
  }) => {
    await createShape(page, 400, 300);

    await openFileMenu(page);
    const { filename, json } = await downloadJson(page, () =>
      page.getByText("Export Excalidraw").click(),
    );

    expect(filename.endsWith(".excalidraw")).toBe(true);
    expect(json.type).toBe("excalidraw");
    expect(json.elements.length).toBeGreaterThanOrEqual(1);
    await expect(page.getByText(/Exported 1 object/)).toBeVisible();
  });

  test("Mermaid import — flowchart 가 도형/커넥터로 생성된다", async ({
    page,
  }) => {
    await openFileMenu(page);
    await page.getByText("Import Mermaid").click();

    const textarea = page.getByPlaceholder(/flowchart TD/);
    await textarea.fill(
      "flowchart TD\n  A[Start] --> B{OK?}\n  B -->|yes| C[Done]",
    );
    await page.getByRole("button", { name: "Import", exact: true }).click();

    await expect(page.getByText("Diagram imported")).toBeVisible();
    await expect(
      page.getByText("3 node(s), 2 connector(s) added"),
    ).toBeVisible();
  });

  test("Mermaid import — 잘못된 입력이면 인라인 에러", async ({ page }) => {
    await openFileMenu(page);
    await page.getByText("Import Mermaid").click();
    await page.getByPlaceholder(/flowchart TD/).fill("this is not mermaid");
    await page.getByRole("button", { name: "Import", exact: true }).click();

    await expect(page.getByText(/Not a flowchart/)).toBeVisible();
  });
});
