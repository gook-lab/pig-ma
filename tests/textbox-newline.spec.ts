import { test, expect } from '@playwright/test';

test.describe('TextBox Newline Bug', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Konva Stage가 로드될 때까지 대기
    await page.waitForSelector('.konvajs-content', { timeout: 10000 });
  });

  test('TextBox 편집 모드 진입 시 줄바꿈이 생성되지 않아야 함', async ({ page }) => {
    // 1. TextBox 도구 선택 (T 키)
    await page.keyboard.press('t');
    await page.waitForTimeout(300);

    // 2. 캔버스 클릭하여 TextBox 생성
    const canvas = page.locator('.konvajs-content canvas').first();
    const canvasBox = await canvas.boundingBox();
    const clickX = canvasBox!.x + canvasBox!.width / 2;
    const clickY = canvasBox!.y + canvasBox!.height / 2;

    await page.mouse.click(clickX, clickY);
    await page.waitForTimeout(500);

    // 3. 생성된 TextBox 더블클릭하여 편집 모드 진입
    await page.mouse.dblclick(clickX, clickY);
    await page.waitForTimeout(800);

    // 4. Tiptap 에디터 확인 - ProseMirror 클래스는 에디터 컨텐츠 영역
    const tiptapEditor = page.locator('.ProseMirror[contenteditable="true"]');
    await expect(tiptapEditor).toBeVisible({ timeout: 5000 });

    // 5. 에디터 내부 paragraph 개수 확인 (1개여야 함)
    const paragraphs = await tiptapEditor.locator('p').count();
    console.log(`Paragraph count: ${paragraphs}`);

    // 6. 에디터 innerHTML 확인
    const innerHTML = await tiptapEditor.innerHTML();
    console.log(`Editor innerHTML: ${innerHTML}`);

    // 7. paragraph가 1개만 있어야 함
    expect(paragraphs).toBeLessThanOrEqual(1);

    // 8. 스크린샷 저장
    await page.screenshot({ path: 'tests/capture/textbox-edit-mode.png' });
  });
});
