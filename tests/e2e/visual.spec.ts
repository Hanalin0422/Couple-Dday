/**
 * 시각 회귀 (ARCHITECTURE.md §15 Visual Regression Test, TC-DSN-009~012).
 * - 고정 날짜·가상 데이터·모션 감소(축하 입자 자동 재생 없음)·CSS 애니메이션 비활성으로 비교한다.
 * - 기준 이미지(tests/e2e/visual.spec.ts-snapshots)는 사용자 승인 후 확정한다. 갱신: `npx playwright test visual --update-snapshots`.
 * - 축하 Canvas 는 랜덤 입자이므로 화면에 있으면 가린다(mask).
 */
import { expect, test, type Page } from "@playwright/test";

async function pickDate(page: Page, year: number, month: number, date: string) {
  await page.getByRole("button", { name: /\d{4}년 \d{1,2}월/ }).click();
  await page.getByRole("option", { name: String(year), exact: true }).click();
  await page.getByRole("option", { name: `${month}월`, exact: true }).click();
  await page.getByRole("button", { name: date, exact: true }).click();
}

type Setup = { today: string; start: [number, number, string]; myName?: string; partnerName?: string; photo?: boolean };

async function onboard(page: Page, { today, start, myName = "하늘", partnerName = "바다", photo = false }: Setup) {
  await page.clock.setFixedTime(new Date(`${today}T10:00:00+09:00`));
  await page.goto("/");
  if (photo) {
    await page.getByTestId("image-file-input").setInputFiles("tests/fixtures/photos/photo-1.jpg");
    await expect(page.getByRole("button", { name: /나 사진 선택/ }).locator("img")).toBeVisible();
  }
  await page.getByLabel("내 이름").fill(myName);
  await page.getByLabel("상대방 이름").fill(partnerName);
  await page.getByRole("button", { name: "처음 사귄 날" }).click();
  await pickDate(page, ...start);
  await page.getByRole("button", { name: "선택", exact: true }).click();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page.getByText("TOGETHER")).toBeVisible();
}

const nav = (page: Page, label: string) => page.getByTestId("bottom-navigation").getByRole("button", { name: label }).click();

async function shot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot(`${name}.png`, {
    animations: "disabled",
    caret: "hide",
    mask: [page.getByTestId("celebration-canvas")],
    maxDiffPixelRatio: 0.01,
  });
}

test.describe("시각 회귀", () => {
  test("온보딩 (TC-DSN-011)", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-25T10:00:00+09:00"));
    await page.goto("/");
    await expect(page.getByLabel("내 이름")).toBeVisible();
    await shot(page, "onboarding");
  });

  test("일반 디데이 메인 · 설정 · 기념일 (TC-DSN-009, TC-DSN-011)", async ({ page }) => {
    await onboard(page, { today: "2026-11-25", start: [2026, 7, "2026-07-01"] });
    await shot(page, "home-normal");
    await nav(page, "설정");
    await expect(page.getByRole("heading", { name: "설정", exact: true })).toBeVisible();
    await shot(page, "settings");
    await nav(page, "기념일");
    await expect(page.getByTestId("timeline-item").first()).toBeVisible();
    await shot(page, "anniversary");
  });

  for (const [years, start, today] of [
    [1, [2025, 11, "2025-11-25"], "2026-11-25"],
    [2, [2024, 11, "2024-11-25"], "2026-11-25"],
    [10, [2016, 11, "2016-11-25"], "2026-11-25"],
  ] as const) {
    test(`${years}주년 메인, 축하 효과 종료(미재생) 상태 (TC-DSN-010)`, async ({ page }) => {
      await onboard(page, { today, start: [...start] });
      await expect(page.getByTestId("anniversary-label")).toHaveAttribute("aria-label", `${years}주년`);
      await shot(page, `home-anniversary-${years}`);
    });
  }

  test("긴 이름(10자)·프로필 사진 있음 (TC-DSN-012)", async ({ page }) => {
    await onboard(page, { today: "2026-11-25", start: [2026, 7, "2026-07-01"], myName: "가나다라마바사아자차", partnerName: "WWWWWWWWWW", photo: true });
    await expect(page.getByRole("img", { name: "가나다라마바사아자차 프로필" }).locator("img")).toBeVisible();
    await shot(page, "home-long-names-photo");
    await nav(page, "설정");
    await expect(page.getByRole("heading", { name: "설정", exact: true })).toBeVisible();
    await shot(page, "settings-long-names-photo");
  });
});
