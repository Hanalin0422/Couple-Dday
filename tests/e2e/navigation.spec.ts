/**
 * 화면 전환 구조 (ARC-C05, NAV-002~004): 화면 유지, 스크롤 보존, 손가락 추적, 깜빡임 없음, 모션 감소.
 */
import { expect, test, type Page } from "@playwright/test";

async function pickDate(page: Page, year: number, month: number, date: string) {
  await page.getByRole("button", { name: /\d{4}년 \d{1,2}월/ }).click();
  await page.getByRole("option", { name: String(year), exact: true }).click();
  await page.getByRole("option", { name: `${month}월`, exact: true }).click();
  await page.getByRole("button", { name: date, exact: true }).click();
}

async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date("2026-11-25T10:00:00+09:00"));
  await page.goto("/");
  await page.getByLabel("내 이름").fill("하늘");
  await page.getByLabel("상대방 이름").fill("바다");
  await page.getByRole("button", { name: "처음 사귄 날" }).click();
  await pickDate(page, 2016, 7, "2016-07-01");
  await page.getByRole("button", { name: "선택", exact: true }).click();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page.getByText("TOGETHER")).toBeVisible();
}

const nav = (page: Page, label: string) => page.getByTestId("bottom-navigation").getByRole("button", { name: label }).click();
const panelLeft = (page: Page, name: string) =>
  page.evaluate((n) => {
    const area = document.querySelector("[data-testid=screen-area]")!.getBoundingClientRect();
    return Math.round(document.querySelector(`[data-screen=${n}]`)!.getBoundingClientRect().left - area.left);
  }, name);

test("화면을 오가도 다시 만들지 않고 기념일 스크롤 위치를 유지한다", async ({ page }) => {
  await onboard(page);
  await nav(page, "기념일");
  const scroll = page.getByTestId("timeline-scroll");
  await expect(page.getByTestId("today-divider")).toBeVisible();
  await scroll.evaluate((el) => {
    el.scrollTop = 200;
    (window as unknown as { __timeline: Element }).__timeline = el;
  });
  await nav(page, "메인");
  await expect(page.getByTestId("dday-number")).toBeVisible();
  await nav(page, "설정");
  await nav(page, "기념일");
  await expect(page.getByRole("heading", { name: "우리의 기념일" })).toBeVisible();
  expect(await scroll.evaluate((el) => el === (window as unknown as { __timeline: Element }).__timeline)).toBe(true);
  expect(await scroll.evaluate((el) => el.scrollTop)).toBe(200);
});

test.describe("모션 허용", () => {
  test.use({ reducedMotion: "no-preference" });

  test("스와이프 중 화면이 손가락을 따라오고, 손을 떼면 다음 화면에 스냅한다", async ({ page }) => {
    await onboard(page);
    await page.waitForTimeout(800); // 나머지 화면 미리 렌더링
    const { width, height } = page.viewportSize()!;
    const y = height * 0.45;
    await page.mouse.move(width * 0.8, y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(width * 0.8 - 12 * i, y + i * 0.3);
    // 손가락 120px 이동: 메인이 같은 만큼 왼쪽으로, 기념일이 오른쪽에서 보이기 시작
    const homeLeft = await panelLeft(page, "home");
    expect(homeLeft).toBeLessThan(-80);
    expect(homeLeft).toBeGreaterThan(-140);
    await expect(page.locator("[data-screen=anniversary]")).toHaveCSS("visibility", "visible");
    await expect(page.locator("[data-screen=anniversary]").getByTestId("today-divider")).toBeAttached(); // 미리 렌더링되어 빈 화면 없음
    await page.mouse.up();
    await expect.poll(() => panelLeft(page, "anniversary")).toBe(0);
    await expect(page.getByRole("heading", { name: "우리의 기념일" })).toBeVisible();
    await expect(page.locator("[data-screen=home]")).toHaveCSS("visibility", "hidden");
  });

  test("임계값 미만으로 끌었다 놓으면 제자리로 돌아온다", async ({ page }) => {
    await onboard(page);
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width * 0.5, height * 0.45);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) await page.mouse.move(width * 0.5 - 8 * i, height * 0.45);
    await page.mouse.up();
    await expect.poll(() => panelLeft(page, "home")).toBe(0);
    await expect(page.getByTestId("dday-number")).toBeVisible();
  });

  test("하단 메뉴 전환 중 모든 프레임에서 빈 영역·투명 단계가 없다", async ({ page }) => {
    await onboard(page);
    await page.waitForTimeout(800);
    const frames = page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const area = document.querySelector("[data-testid=screen-area]")!;
          const coverage: number[] = [];
          const t0 = performance.now();
          const tick = (now: number) => {
            const a = area.getBoundingClientRect();
            let covered = 0;
            for (const panel of document.querySelectorAll<HTMLElement>("[data-screen]")) {
              const r = panel.getBoundingClientRect();
              const style = getComputedStyle(panel);
              if (style.visibility === "hidden" || parseFloat(style.opacity) < 0.99 || panel.childElementCount === 0) continue;
              covered += Math.max(0, Math.min(r.right, a.right) - Math.max(r.left, a.left));
            }
            coverage.push(covered / a.width);
            if (now - t0 < 700) requestAnimationFrame(tick);
            else resolve(coverage);
          };
          requestAnimationFrame(tick);
        }),
    );
    await nav(page, "기념일");
    const coverage = await frames;
    expect(Math.min(...coverage)).toBeGreaterThanOrEqual(0.99);
    await expect.poll(() => panelLeft(page, "anniversary")).toBe(0);
  });
});

test("모션 감소 설정에서는 메뉴 전환이 애니메이션 없이 즉시 이동한다", async ({ page }) => {
  await onboard(page);
  await nav(page, "설정");
  expect(await panelLeft(page, "settings")).toBe(0);
  await expect(page.locator("[data-screen=home]")).toHaveCSS("visibility", "hidden");
});

test("스와이프를 시작한 위치의 메뉴 행은 손을 떼도 열리지 않는다 (NAV-004)", async ({ page }) => {
  await onboard(page);
  await nav(page, "설정");
  const row = page.getByRole("button", { name: /^연애 시작일/ });
  const box = (await row.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.8, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width * 0.8 - 16 * i, y);
  await page.mouse.up();
  await expect(page.getByRole("heading", { name: "TOGETHER" }).or(page.getByText("TOGETHER"))).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // 탭은 그대로 동작
  await nav(page, "설정");
  await row.click();
  await expect(page.getByRole("dialog", { name: "연애 시작일" })).toBeVisible();
});
