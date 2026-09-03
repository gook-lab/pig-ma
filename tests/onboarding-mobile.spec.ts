import { expect, test } from "@playwright/test";

test.describe("온보딩과 모바일 헤더", () => {
  test("첫 방문 안내가 네 단계를 거쳐 완료된다", async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");

    await expect(page.getByLabel("시작 안내 1/4")).toContainText(
      "Pig-ma에 오신 것을 환영합니다",
    );
    await page.getByRole("button", { name: "다음" }).click();
    await expect(page.getByLabel("시작 안내 2/4")).toContainText(
      "하단 도구에서 시작하세요",
    );
    await page.getByRole("button", { name: "다음" }).click();
    await expect(page.getByLabel("시작 안내 3/4")).toContainText(
      "미니맵으로 전체 위치를 확인하세요",
    );
    await page.getByRole("button", { name: "다음" }).click();
    await expect(page.getByLabel("시작 안내 4/4")).toContainText(
      "상단 메뉴에서 작업을 관리하세요",
    );
    await page.getByRole("button", { name: "시작하기" }).click();

    await expect(page.getByLabel(/시작 안내/)).toHaveCount(0);
    await expect(
      page.evaluate(() => localStorage.getItem("pig-onboarding-complete")),
    ).resolves.toBe("true");
  });

  test("375px 헤더는 주요 기능을 더보기 메뉴에 모은다", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.addInitScript(() =>
      localStorage.setItem("pig-onboarding-complete", "true"),
    );
    await page.goto("/");

    await expect(page.getByRole("button", { name: "검색" })).toBeVisible();
    await page.getByRole("button", { name: "더보기 메뉴" }).click();

    await expect(page.getByRole("button", { name: "파일" })).toBeVisible();
    await expect(page.getByRole("button", { name: "설정" })).toBeVisible();
    await expect(page.getByRole("button", { name: "템플릿" })).toBeVisible();
    await expect(page.getByRole("button", { name: "공유" })).toBeVisible();
  });
});
