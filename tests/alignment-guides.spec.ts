import { test, expect } from '@playwright/test';

test.describe('Alignment Guides (드래그 정렬 가이드)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5001');
    await page.waitForLoadState('networkidle');
  });

  test('두 도형을 정렬하면 수평/수직 가이드 라인이 표시됨', async ({ page }) => {
    // Shape 도구 선택
    await page.keyboard.press('r');
    await page.waitForTimeout(200);

    // 첫 번째 도형 생성 (100, 100)
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);

    // 두 번째 도형 생성 (300, 300)
    await page.keyboard.press('r');
    await page.waitForTimeout(200);
    await page.mouse.click(400, 350);
    await page.waitForTimeout(300);

    // Select 도구로 전환
    await page.keyboard.press('v');
    await page.waitForTimeout(200);

    // 두 번째 도형 선택
    await page.mouse.click(400, 350);
    await page.waitForTimeout(200);

    // 두 번째 도형을 드래그하여 첫 번째 도형과 수평 정렬
    // 시작 위치에서 드래그 시작
    await page.mouse.move(400, 350);
    await page.mouse.down();

    // 첫 번째 도형의 y 위치와 비슷하게 이동 (수평 정렬 트리거)
    await page.mouse.move(400, 205, { steps: 10 });
    await page.waitForTimeout(100);

    // 스크린샷 캡처 - 수평 가이드 라인 확인
    await page.screenshot({ path: 'tests/capture/alignment-horizontal.png' });

    // 드래그 종료
    await page.mouse.up();
    await page.waitForTimeout(200);

    // 가이드 라인이 사라졌는지 확인 (드래그 종료 후)
    await page.screenshot({ path: 'tests/capture/alignment-after-drop.png' });
  });

  test('수직 정렬 시 수직 가이드 라인 표시', async ({ page }) => {
    // Shape 도구 선택
    await page.keyboard.press('r');
    await page.waitForTimeout(200);

    // 첫 번째 도형 생성
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);

    // 두 번째 도형 생성
    await page.keyboard.press('r');
    await page.waitForTimeout(200);
    await page.mouse.click(350, 350);
    await page.waitForTimeout(300);

    // Select 도구로 전환
    await page.keyboard.press('v');
    await page.waitForTimeout(200);

    // 두 번째 도형 선택
    await page.mouse.click(350, 350);
    await page.waitForTimeout(200);

    // 드래그하여 수직 정렬
    await page.mouse.move(350, 350);
    await page.mouse.down();

    // 첫 번째 도형의 x 위치와 비슷하게 이동 (수직 정렬 트리거)
    await page.mouse.move(205, 350, { steps: 10 });
    await page.waitForTimeout(100);

    // 스크린샷 캡처 - 수직 가이드 라인 확인
    await page.screenshot({ path: 'tests/capture/alignment-vertical.png' });

    await page.mouse.up();
  });

  test('수평+수직 동시 정렬 시 두 가이드 라인 모두 표시', async ({ page }) => {
    // Shape 도구 선택
    await page.keyboard.press('r');
    await page.waitForTimeout(200);

    // 첫 번째 도형 생성
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);

    // 두 번째 도형 생성
    await page.keyboard.press('r');
    await page.waitForTimeout(200);
    await page.mouse.click(400, 400);
    await page.waitForTimeout(300);

    // Select 도구로 전환
    await page.keyboard.press('v');
    await page.waitForTimeout(200);

    // 두 번째 도형 선택
    await page.mouse.click(400, 400);
    await page.waitForTimeout(200);

    // 드래그하여 수평+수직 동시 정렬
    await page.mouse.move(400, 400);
    await page.mouse.down();

    // 첫 번째 도형과 완전히 겹치도록 이동 (수평+수직 정렬 트리거)
    await page.mouse.move(205, 205, { steps: 15 });
    await page.waitForTimeout(100);

    // 스크린샷 캡처 - 수평+수직 가이드 라인 모두 확인
    await page.screenshot({ path: 'tests/capture/alignment-both.png' });

    await page.mouse.up();
  });

  test('근접하지 않은 도형은 정렬 가이드가 표시되지 않음', async ({ page }) => {
    // Shape 도구 선택
    await page.keyboard.press('r');
    await page.waitForTimeout(200);

    // 첫 번째 도형 생성 (좌측 상단)
    await page.mouse.click(100, 100);
    await page.waitForTimeout(300);

    // 두 번째 도형 생성 (우측 하단, 매우 멀리)
    await page.keyboard.press('r');
    await page.waitForTimeout(200);
    await page.mouse.click(800, 600);
    await page.waitForTimeout(300);

    // Select 도구로 전환
    await page.keyboard.press('v');
    await page.waitForTimeout(200);

    // 첫 번째 도형 선택
    await page.mouse.click(100, 100);
    await page.waitForTimeout(200);

    // 드래그하되 두 번째 도형 근처가 아닌 곳으로
    await page.mouse.move(100, 100);
    await page.mouse.down();
    await page.mouse.move(150, 150, { steps: 5 });
    await page.waitForTimeout(100);

    // 스크린샷 캡처 - 가이드 라인 없음 확인
    await page.screenshot({ path: 'tests/capture/alignment-no-guide.png' });

    await page.mouse.up();
  });
});
