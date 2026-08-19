import { test, expect, Page } from '@playwright/test';

// Helper to wait for canvas to be ready
async function waitForCanvas(page: Page) {
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(500);
}

// Helper to create a StickyNote at specific position
async function createStickyNote(page: Page, x: number, y: number) {
  await page.keyboard.press('s');
  await page.waitForTimeout(100);
  await page.click('canvas', { position: { x, y }, force: true });
  await page.waitForTimeout(300);
}

// Helper to enter edit mode by double clicking
async function enterEditMode(page: Page, x: number, y: number) {
  await page.dblclick('canvas', { position: { x, y }, force: true });
  await page.waitForTimeout(500);
}

// Helper to check if Tiptap editor is visible
async function isTiptapEditorVisible(page: Page) {
  const editor = page.locator('.tiptap-editor').first();
  return editor.isVisible();
}

// Helper to get Tiptap editor
async function getTiptapEditor(page: Page) {
  return page.locator('.tiptap-editor .ProseMirror').first();
}

// Helper to check if TextOptionsBar is visible
async function isOptionsBarVisible(page: Page) {
  const optionsBar = page.locator('.fixed.z-50 .bg-gray-800').first();
  return optionsBar.isVisible();
}

test.describe('Tiptap TextOptionsBar Functions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000');
    await waitForCanvas(page);
  });

  test('2. 링크 메뉴 클릭 시 에디트 모드 유지', async ({ page }) => {
    // Create StickyNote
    await createStickyNote(page, 400, 300);

    // Double click to enter edit mode
    await enterEditMode(page, 400, 350);

    // Check if Tiptap editor is visible
    const editorVisible = await isTiptapEditorVisible(page);
    expect(editorVisible).toBe(true);
    console.log('✅ Tiptap 에디터 표시됨');

    // Type some text
    const editor = await getTiptapEditor(page);
    await editor.click();
    await page.keyboard.type('링크 테스트 텍스트');
    await page.waitForTimeout(200);

    // Select the text
    await page.keyboard.press('Meta+a');
    await page.waitForTimeout(200);

    // Take screenshot before clicking link
    await page.screenshot({ path: 'tests/capture/link-before.png' });

    // Check that options bar is visible
    const optionsVisible = await isOptionsBarVisible(page);
    expect(optionsVisible).toBe(true);
    console.log('✅ 옵션바 표시됨');

    // Find and click link button (using svg icon or title)
    const linkButton = page.locator('button[title="링크"]');

    if (await linkButton.isVisible()) {
      await linkButton.click();
      await page.waitForTimeout(500);

      // Take screenshot after clicking link button
      await page.screenshot({ path: 'tests/capture/link-panel.png' });

      // Check if link input panel appeared
      const linkInput = page.locator('input[placeholder="https://..."]').first();
      await linkInput.waitFor({ state: 'visible', timeout: 5000 });
      console.log('✅ 링크 입력 패널 표시됨');

      // Check if editor is still in edit mode (not blurred)
      const editorStillVisible = await isTiptapEditorVisible(page);
      expect(editorStillVisible).toBe(true);
      console.log('✅ 에디트 모드 유지됨');

      // Type URL using type() instead of fill() to avoid blur
      // fill() causes immediate blur, type() keeps focus during typing
      await linkInput.click();
      await linkInput.pressSequentially('https://example.com', { delay: 10 });

      // Take screenshot immediately after typing
      await page.screenshot({ path: 'tests/capture/link-after-type.png' });

      // Verify editor still active after typing in input
      const editorAfterInput = await isTiptapEditorVisible(page);
      expect(editorAfterInput).toBe(true);
      console.log('✅ URL 입력 후 에디트 모드 유지됨');

      // Click Save button immediately - it should still be visible
      const saveButton = page.locator('button:has-text("Save")').first();
      await saveButton.click();
      await page.waitForTimeout(300);

      // Verify editor still active
      const editorAfterSave = await isTiptapEditorVisible(page);
      expect(editorAfterSave).toBe(true);
      console.log('✅ 링크 저장 후 에디트 모드 유지됨');
    }

    await page.screenshot({ path: 'tests/capture/link-after.png' });
    console.log('✅ 링크 기능 테스트 완료');
  });

  test('3. 텍스트 정렬 (왼쪽/가운데/오른쪽) 동작 확인', async ({ page }) => {
    // Create StickyNote
    await createStickyNote(page, 400, 300);

    // Double click to enter edit mode
    await enterEditMode(page, 400, 350);

    // Type some text
    const editor = await getTiptapEditor(page);
    await editor.click();
    await page.keyboard.type('정렬 테스트 텍스트입니다');
    await page.waitForTimeout(200);

    // Take screenshot for initial state
    await page.screenshot({ path: 'tests/capture/align-initial.png' });

    // Click center align button
    const centerButton = page.locator('button[title="가운데 정렬"]');
    if (await centerButton.isVisible()) {
      await centerButton.click();
      await page.waitForTimeout(300);

      // Check if editor is still visible (not blurred)
      const editorVisible = await isTiptapEditorVisible(page);
      expect(editorVisible).toBe(true);
      console.log('✅ 가운데 정렬 클릭 후 에디트 모드 유지됨');

      // Check if center button is now active (has bg-violet-600)
      const centerActive = await centerButton.evaluate(el => el.classList.contains('bg-violet-600'));
      expect(centerActive).toBe(true);
      console.log('✅ 가운데 정렬 활성화됨');
    }

    await page.screenshot({ path: 'tests/capture/align-center.png' });

    // Click right align button
    const rightButton = page.locator('button[title="오른쪽 정렬"]');
    if (await rightButton.isVisible()) {
      await rightButton.click();
      await page.waitForTimeout(300);

      const editorVisible = await isTiptapEditorVisible(page);
      expect(editorVisible).toBe(true);
      console.log('✅ 오른쪽 정렬 클릭 후 에디트 모드 유지됨');

      const rightActive = await rightButton.evaluate(el => el.classList.contains('bg-violet-600'));
      expect(rightActive).toBe(true);
      console.log('✅ 오른쪽 정렬 활성화됨');
    }

    await page.screenshot({ path: 'tests/capture/align-right.png' });

    // Click left align button
    const leftButton = page.locator('button[title="왼쪽 정렬"]');
    if (await leftButton.isVisible()) {
      await leftButton.click();
      await page.waitForTimeout(300);

      const editorVisible = await isTiptapEditorVisible(page);
      expect(editorVisible).toBe(true);
      console.log('✅ 왼쪽 정렬 클릭 후 에디트 모드 유지됨');

      const leftActive = await leftButton.evaluate(el => el.classList.contains('bg-violet-600'));
      expect(leftActive).toBe(true);
      console.log('✅ 왼쪽 정렬 활성화됨');
    }

    await page.screenshot({ path: 'tests/capture/align-left.png' });
    console.log('✅ 정렬 기능 테스트 완료');
  });

  test('4. 이미지 첨부 클릭 시 에디트 모드 유지', async ({ page }) => {
    // Create StickyNote
    await createStickyNote(page, 400, 300);

    // Double click to enter edit mode
    await enterEditMode(page, 400, 350);

    // Type some text
    const editor = await getTiptapEditor(page);
    await editor.click();
    await page.keyboard.type('이미지 테스트');
    await page.waitForTimeout(200);

    // Take screenshot before clicking image button
    await page.screenshot({ path: 'tests/capture/image-before.png' });

    // Find and click image button
    const imageButton = page.locator('button[title*="이미지"]');
    if (await imageButton.isVisible()) {
      await imageButton.click();
      await page.waitForTimeout(300);

      // Check if image panel appeared
      const imagePanel = page.locator('text=이미지 삽입').first();
      const imagePanelVisible = await imagePanel.isVisible();
      expect(imagePanelVisible).toBe(true);
      console.log('✅ 이미지 삽입 패널 표시됨');

      // Check if editor is still in edit mode
      const editorVisible = await isTiptapEditorVisible(page);
      expect(editorVisible).toBe(true);
      console.log('✅ 에디트 모드 유지됨');

      // Test URL input
      const urlInput = page.locator('input[placeholder*="URL"]');
      if (await urlInput.isVisible()) {
        await urlInput.fill('https://example.com/image.png');
        await page.waitForTimeout(200);

        // Check editor still visible after typing in URL input
        const editorAfterInput = await isTiptapEditorVisible(page);
        expect(editorAfterInput).toBe(true);
        console.log('✅ URL 입력 후 에디트 모드 유지됨');
      }
    }

    await page.screenshot({ path: 'tests/capture/image-after.png' });
    console.log('✅ 이미지 첨부 기능 테스트 완료');
  });

  test('1. 볼드/취소선/텍스트크기 동작 확인 (기준 테스트)', async ({ page }) => {
    // Create StickyNote
    await createStickyNote(page, 400, 300);

    // Double click to enter edit mode
    await enterEditMode(page, 400, 350);

    // Type some text
    const editor = await getTiptapEditor(page);
    await editor.click();
    await page.keyboard.type('볼드 테스트');
    await page.waitForTimeout(200);

    // Select all text
    await page.keyboard.press('Meta+a');
    await page.waitForTimeout(200);

    // Click bold button
    const boldButton = page.locator('button[title*="굵게"]');
    if (await boldButton.isVisible()) {
      await boldButton.click();
      await page.waitForTimeout(300);

      const editorVisible = await isTiptapEditorVisible(page);
      expect(editorVisible).toBe(true);
      console.log('✅ 볼드 클릭 후 에디트 모드 유지됨');
    }

    // Click strikethrough button
    const strikeButton = page.locator('button[title*="취소선"]');
    if (await strikeButton.isVisible()) {
      await strikeButton.click();
      await page.waitForTimeout(300);

      const editorVisible = await isTiptapEditorVisible(page);
      expect(editorVisible).toBe(true);
      console.log('✅ 취소선 클릭 후 에디트 모드 유지됨');
    }

    await page.screenshot({ path: 'tests/capture/bold-strike.png' });
    console.log('✅ 볼드/취소선 기능 테스트 완료');
  });
});
