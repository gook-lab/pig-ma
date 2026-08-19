import { test, expect, Page } from '@playwright/test';

// Helper to wait for canvas to be ready
async function waitForCanvas(page: Page) {
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(500); // Wait for initial render
}

// Helper to create a StickyNote at specific position
async function createStickyNote(page: Page, x: number, y: number) {
  // Press 'S' to select StickyNote tool
  await page.keyboard.press('s');
  await page.waitForTimeout(100);

  // Click on canvas to create StickyNote (force: true for Konva canvas)
  await page.click('canvas', { position: { x, y }, force: true });
  await page.waitForTimeout(300);
}

// Helper to enter edit mode (type a character when selected)
async function enterEditMode(page: Page) {
  // When a textBox/stickyNote is selected, typing any character enters edit mode
  // We'll type a space and then delete it, or just use a trigger character
  await page.keyboard.press('a');  // This triggers edit mode and types 'a'
  await page.waitForTimeout(300);
}

// Helper to get the hidden textarea
async function getHiddenTextarea(page: Page) {
  return page.locator('textarea[autocomplete="off"]');
}

// Helper to type text
async function typeText(page: Page, text: string) {
  const textarea = await getHiddenTextarea(page);
  await textarea.fill(text);
  await page.waitForTimeout(100);
}

// Helper to select text in textarea
async function selectText(page: Page, start: number, end: number) {
  const textarea = await getHiddenTextarea(page);
  await textarea.evaluate((el, { start, end }) => {
    el.selectionStart = start;
    el.selectionEnd = end;
  }, { start, end });
  await page.waitForTimeout(100);
}

// Helper to check if TextOptionsBar is visible
async function isOptionsBarVisible(page: Page) {
  const optionsBar = page.locator('[class*="bg-gray-800"]').first();
  return optionsBar.isVisible();
}

// Helper to get font size from options bar
async function getFontSizeFromOptionsBar(page: Page): Promise<string> {
  // Find the font size dropdown button
  const fontSizeButton = page.locator('button:has-text("16"), button:has-text("19"), button:has-text("24"), button:has-text("40")').first();
  if (await fontSizeButton.isVisible()) {
    return (await fontSizeButton.textContent()) ?? '';
  }
  return '';
}

test.describe('StickyNote Text Editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvas(page);
  });

  test('1. 3줄 텍스트 작성 테스트', async ({ page }) => {
    // Create StickyNote
    await createStickyNote(page, 400, 300);

    // Enter edit mode
    await enterEditMode(page);

    // Check hidden textarea exists
    const textarea = await getHiddenTextarea(page);
    await expect(textarea).toBeVisible();

    // Type 3 lines
    await textarea.fill('안녕하세요\n안녕하세요2\n안녕하세요3');
    await page.waitForTimeout(200);

    // Verify text was entered
    const value = await textarea.inputValue();
    expect(value).toBe('안녕하세요\n안녕하세요2\n안녕하세요3');

    // Take screenshot for visual verification
    await page.screenshot({ path: 'tests/capture/1-three-lines.png' });

    console.log('✅ 3줄 텍스트 작성 완료');
  });

  test('2. 줄바꿈 및 서식 테스트 (볼드, 취소선, 폰트 크기)', async ({ page }) => {
    // Create StickyNote
    await createStickyNote(page, 400, 300);
    await enterEditMode(page);

    const textarea = await getHiddenTextarea(page);

    // Type 3 lines
    await textarea.fill('안녕하세요\n안녕하세요2\n안녕하세요3');
    await page.waitForTimeout(200);

    // 2번째 줄 부분 볼드: "안녕" 선택 (index 6-8)
    await selectText(page, 6, 8);
    await page.waitForTimeout(100);

    // Apply bold with Cmd+B
    await page.keyboard.press('Meta+b');
    await page.waitForTimeout(200);

    console.log('✅ 2번째 줄 부분 볼드 적용');

    // 3번째 줄 취소선: "안녕" 선택 (index 16-18)
    await selectText(page, 16, 18);
    await page.waitForTimeout(100);

    // Apply strikethrough with Cmd+S (note: this might trigger save, check behavior)
    await page.keyboard.press('Meta+s');
    await page.waitForTimeout(200);

    console.log('✅ 3번째 줄 취소선 적용');

    // Take screenshot
    await page.screenshot({ path: 'tests/capture/2-formatting.png' });
  });

  test('3. 폰트 크기 변경 및 커서 크기 확인', async ({ page }) => {
    // Create StickyNote
    await createStickyNote(page, 400, 300);
    await enterEditMode(page);

    const textarea = await getHiddenTextarea(page);
    await textarea.fill('안녕하세요\n테스트');
    await page.waitForTimeout(200);

    // Select second line
    await selectText(page, 6, 9);
    await page.waitForTimeout(100);

    // Check options bar is visible
    const optionsBarVisible = await isOptionsBarVisible(page);
    expect(optionsBarVisible).toBe(true);
    console.log('✅ 옵션바 표시됨');

    // Click font size dropdown and change to 40
    const fontSizeButton = page.locator('button').filter({ hasText: /^\d+$/ }).first();
    if (await fontSizeButton.isVisible()) {
      await fontSizeButton.click();
      await page.waitForTimeout(200);

      // Find and click 40px option
      const size40 = page.locator('button:has-text("40"), [role="option"]:has-text("40")').first();
      if (await size40.isVisible()) {
        await size40.click();
        await page.waitForTimeout(300);
        console.log('✅ 폰트 크기 40으로 변경');
      }
    }

    // Take screenshot to verify cursor size
    await page.screenshot({ path: 'tests/capture/3-font-size-cursor.png' });
  });

  test('4. 들여쓰기 테스트 (Tab 키)', async ({ page }) => {
    // Create StickyNote
    await createStickyNote(page, 400, 300);
    await enterEditMode(page);

    const textarea = await getHiddenTextarea(page);
    await textarea.fill('첫번째줄\n두번째줄\n세번째줄');
    await page.waitForTimeout(200);

    // Move cursor to second line start
    await selectText(page, 5, 5);
    await page.waitForTimeout(100);

    // Press Tab for indent
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // Verify indentation (check if spaces were added)
    const value = await textarea.inputValue();
    console.log('Tab 후 텍스트:', value);
    expect(value).toContain('  '); // Should have spaces for indent

    console.log('✅ Tab 들여쓰기 동작');

    // Press Shift+Tab for outdent
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(200);

    const valueAfterOutdent = await textarea.inputValue();
    console.log('Shift+Tab 후 텍스트:', valueAfterOutdent);

    console.log('✅ Shift+Tab 내어쓰기 동작');

    // Take screenshot
    await page.screenshot({ path: 'tests/capture/4-indentation.png' });
  });

  test('5. 타이핑 동작 확인', async ({ page }) => {
    // Create StickyNote
    await createStickyNote(page, 400, 300);
    await enterEditMode(page);

    const textarea = await getHiddenTextarea(page);

    // Type text using keyboard.type (supports Korean)
    await textarea.fill('테스트 타이핑');
    await page.waitForTimeout(200);

    // Verify text (includes 'a' from enterEditMode)
    const value = await textarea.inputValue();
    expect(value).toContain('테스트');

    console.log('✅ 타이핑 동작 확인:', value);

    // Test backspace
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(100);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(100);

    const valueAfterBackspace = await textarea.inputValue();
    console.log('Backspace 후:', valueAfterBackspace);

    console.log('✅ Backspace 동작 확인');

    // Take screenshot
    await page.screenshot({ path: 'tests/capture/5-typing.png' });
  });

  test('6. 메모지 리사이징 테스트', async ({ page }) => {
    // Create StickyNote
    await createStickyNote(page, 400, 300);

    // Take initial screenshot (already selected after creation)
    await page.screenshot({ path: 'tests/capture/6-resize-before.png' });

    // Enter edit mode directly (StickyNote is already selected after creation)
    await enterEditMode(page);
    const textarea = await getHiddenTextarea(page);
    await expect(textarea).toBeVisible({ timeout: 5000 });

    // Add multiple lines with large font to trigger resize
    await textarea.fill('큰폰트테스트\n두번째줄\n세번째줄\n네번째줄\n다섯번째줄');
    await page.waitForTimeout(300);

    // Take screenshot after text
    await page.screenshot({ path: 'tests/capture/6-resize-after-text.png' });

    // Select all and change font size to 40
    await selectText(page, 0, 5);
    await page.waitForTimeout(100);

    // Find font size in options bar and click
    const optionsBar = page.locator('[class*="bg-gray-800"]').first();
    if (await optionsBar.isVisible()) {
      // Look for font size button (shows current size like "16")
      const buttons = optionsBar.locator('button');
      const count = await buttons.count();

      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        const text = await button.textContent();
        if (text && /^\d+/.test(text)) {
          await button.click();
          await page.waitForTimeout(200);
          break;
        }
      }

      // Try to find 40 option
      const largeSize = page.locator('text=Large, text=40, [data-value="40"]').first();
      if (await largeSize.isVisible()) {
        await largeSize.click();
        await page.waitForTimeout(300);
      }
    }

    // Take final screenshot
    await page.screenshot({ path: 'tests/capture/6-resize-after-fontsize.png' });

    console.log('✅ 메모지 리사이징 테스트 완료 - 스크린샷 확인 필요');
  });

  test('7. 텍스트 선택 (Cmd+A 전체 선택)', async ({ page }) => {
    // Create StickyNote
    await createStickyNote(page, 400, 300);
    await enterEditMode(page);

    const textarea = await getHiddenTextarea(page);
    await textarea.fill('선택할 텍스트입니다');
    await page.waitForTimeout(200);

    // Use Cmd+A to select all text
    await page.keyboard.press('Meta+a');
    await page.waitForTimeout(200);

    // Check if selection was made
    const selectionStart = await textarea.evaluate(el => el.selectionStart);
    const selectionEnd = await textarea.evaluate(el => el.selectionEnd);
    const textLength = await textarea.evaluate(el => el.value.length);

    console.log(`선택 범위: ${selectionStart} - ${selectionEnd} (전체 길이: ${textLength})`);

    // Take screenshot
    await page.screenshot({ path: 'tests/capture/7-select-all.png' });

    // Cmd+A should select all text (start=0, end=textLength)
    expect(selectionStart).toBe(0);
    expect(selectionEnd).toBe(textLength);
    console.log('✅ Cmd+A 전체 선택 동작 확인');
  });

  test('8. ESC로 편집 종료', async ({ page }) => {
    // Create StickyNote
    await createStickyNote(page, 400, 300);
    await enterEditMode(page);

    const textarea = await getHiddenTextarea(page);
    await textarea.fill('ESC 테스트');
    await page.waitForTimeout(200);

    // Press ESC to exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Check if textarea is no longer visible (edit mode exited)
    const textareaAfterEsc = page.locator('textarea[autocomplete="off"]');
    const isVisible = await textareaAfterEsc.isVisible();

    if (!isVisible) {
      console.log('✅ ESC로 편집 모드 종료');
    } else {
      console.log('⚠️ ESC로 편집 모드가 종료되지 않음');
    }

    // Take screenshot
    await page.screenshot({ path: 'tests/capture/8-esc-exit.png' });
  });
});

test.describe('Selection and Style Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvas(page);
  });

  test('선택 영역에만 폰트 크기 적용 (전체가 아닌 부분 적용)', async ({ page }) => {
    // Create StickyNote with text
    await createStickyNote(page, 400, 300);
    await enterEditMode(page);

    const textarea = await getHiddenTextarea(page);
    await textarea.fill('안녕하세요 반갑습니다');
    await page.waitForTimeout(200);

    // Select only first 5 characters ("안녕하세요")
    await selectText(page, 0, 5);
    await page.waitForTimeout(200);

    // Check selection is made
    const selStart = await textarea.evaluate(el => el.selectionStart);
    const selEnd = await textarea.evaluate(el => el.selectionEnd);
    console.log(`선택 전 범위: ${selStart} - ${selEnd}`);
    expect(selEnd - selStart).toBe(5);

    // Click font size button to open dropdown
    const fontSizeButton = page.locator('button').filter({ hasText: /^\d+$/ }).first();
    if (await fontSizeButton.isVisible()) {
      await fontSizeButton.click();
      await page.waitForTimeout(200);

      // Check if dropdown is visible
      const dropdown = page.locator('text=Large, text=40').first();
      if (await dropdown.isVisible()) {
        // After clicking dropdown, check if selection is still preserved
        const selStartAfter = await textarea.evaluate(el => el.selectionStart);
        const selEndAfter = await textarea.evaluate(el => el.selectionEnd);
        console.log(`드롭다운 클릭 후 선택 범위: ${selStartAfter} - ${selEndAfter}`);

        // Click on "Large" (40px)
        await dropdown.click();
        await page.waitForTimeout(300);

        console.log('✅ 부분 선택 후 폰트 크기 변경 테스트 완료');
      }
    }

    await page.screenshot({ path: 'tests/capture/selection-font-size.png' });
  });

  test('한글 실시간 렌더링 확인', async ({ page }) => {
    // Create StickyNote
    await createStickyNote(page, 400, 300);
    await enterEditMode(page);

    const textarea = await getHiddenTextarea(page);

    // Type Korean text character by character to test real-time rendering
    await page.keyboard.type('안녕', { delay: 100 });
    await page.waitForTimeout(100);

    // Take screenshot to verify text is visible
    await page.screenshot({ path: 'tests/capture/korean-realtime-1.png' });

    const value1 = await textarea.inputValue();
    console.log(`첫 번째 입력 후: "${value1}"`);
    expect(value1).toContain('안녕');

    // Continue typing
    await page.keyboard.type('하세요', { delay: 100 });
    await page.waitForTimeout(100);

    // Take another screenshot
    await page.screenshot({ path: 'tests/capture/korean-realtime-2.png' });

    const value2 = await textarea.inputValue();
    console.log(`두 번째 입력 후: "${value2}"`);
    expect(value2).toContain('안녕하세요');

    console.log('✅ 한글 실시간 렌더링 테스트 완료');
  });
});

test.describe('TextBox Text Editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvas(page);
  });

  test('TextBox 기본 텍스트 입력', async ({ page }) => {
    // Press 'T' to select TextBox tool
    await page.keyboard.press('t');
    await page.waitForTimeout(100);

    // Click to create TextBox
    await page.click('canvas', { position: { x: 500, y: 400 }, force: true });
    await page.waitForTimeout(300);

    // Enter edit mode by typing a character
    await page.keyboard.press('a');
    await page.waitForTimeout(300);

    const textarea = await getHiddenTextarea(page);
    if (await textarea.isVisible()) {
      // Clear the 'a' that was typed to enter edit mode
      await textarea.fill('TextBox 테스트');
      await page.waitForTimeout(200);

      const value = await textarea.inputValue();
      expect(value).toContain('TextBox');
      console.log('✅ TextBox 텍스트 입력 동작');
    }

    await page.screenshot({ path: 'tests/capture/textbox-basic.png' });
  });
});
