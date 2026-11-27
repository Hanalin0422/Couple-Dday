/**
 * 화면 전환 구조 (ARC-C05, NAV-002~004): 브라우저 기본 가로 스크롤 + CSS Scroll Snap.
 * 화면 유지, 스크롤 보존, 손가락 추적(Chromium 실제 터치), 스냅, 선택 상태 동기화, 빈 영역 없음, Sheet 중 차단, 모션 감소.
 */
import { expect, test, type Page } from "@playwright/test";
import { swipe, touchAt, touchSession } from "./support/swipe";

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

  test("스와이프 중 화면이 손가락을 따라오고, 손을 떼면 다음 화면에 정렬된다 (Chromium 실제 터치)", async ({ page }) => {
    const cdp = await touchSession(page);
    test.skip(!cdp, "WebKit 은 Playwright 터치 이동 미지원 — 실기기 검증");
    await onboard(page);
    await page.waitForTimeout(800); // 나머지 화면 미리 렌더링
    const { width, height } = page.viewportSize()!;
    const y = height * 0.45;
    const x0 = width * 0.85;
    await touchAt(cdp!, "touchStart", x0, y);
    for (let i = 1; i <= 10; i++) {
      await touchAt(cdp!, "touchMove", x0 - 14 * i, y);
      await page.waitForTimeout(16);
    }
    // 손가락 140px 이동: 메인이 (터치 판정 거리만큼 늦게) 같이 이동, 기념일 내용이 이미 그려져 있음
    const homeLeft = await panelLeft(page, "home");
    expect(homeLeft).toBeLessThan(-100);
    expect(homeLeft).toBeGreaterThan(-141);
    await expect(page.locator("[data-screen=anniversary]").getByTestId("today-divider")).toBeAttached();
    for (let i = 11; i <= 16; i++) await touchAt(cdp!, "touchMove", x0 - 14 * i, y); // 화면 절반 넘김
    await touchAt(cdp!, "touchEnd");
    await expect.poll(() => panelLeft(page, "anniversary")).toBe(0);
    await expect(page.getByTestId("bottom-navigation").getByRole("button", { name: "기념일" })).toHaveAttribute("aria-current", "page");
  });

  test("짧게 천천히 끌었다 놓으면 제자리로 돌아온다 (Chromium 실제 터치)", async ({ page }) => {
    test.skip(!(await touchSession(page)), "WebKit 은 코드 스크롤이 방향 스냅되어 재현 불가 — 실기기 검증");
    await onboard(page);
    await swipe(page, -40, { speed: "slow" });
    await expect.poll(() => panelLeft(page, "home")).toBe(0);
    await expect(page.getByTestId("bottom-navigation").getByRole("button", { name: "메인" })).toHaveAttribute("aria-current", "page");
  });

  test("스와이프로 이동하면 하단 메뉴 선택 상태가 실제 화면과 같고, 양 끝에서는 더 이동하지 않는다", async ({ page }) => {
    await onboard(page);
    const bar = page.getByTestId("bottom-navigation");
    await swipe(page, 200);
    await expect.poll(() => panelLeft(page, "settings")).toBe(0);
    await expect(bar.getByRole("button", { name: "설정" })).toHaveAttribute("aria-current", "page");
    await swipe(page, 200); // 왼쪽 끝
    await expect.poll(() => panelLeft(page, "settings")).toBe(0);
    await swipe(page, -200);
    await swipe(page, -200);
    await expect.poll(() => panelLeft(page, "anniversary")).toBe(0);
    await expect(bar.getByRole("button", { name: "기념일" })).toHaveAttribute("aria-current", "page");
    await swipe(page, -200); // 오른쪽 끝
    await expect.poll(() => panelLeft(page, "anniversary")).toBe(0);
    // 하단 메뉴로 두 화면 건너 이동 중에도 중간 화면에서 선택이 흔들리지 않고 도착 화면과 일치
    await bar.getByRole("button", { name: "설정" }).click();
    await expect.poll(() => panelLeft(page, "settings")).toBe(0);
    await expect(bar.getByRole("button", { name: "설정" })).toHaveAttribute("aria-current", "page");
  });

  test("Bottom Sheet 가 열려 있으면 화면이 넘어가지 않는다 (NAV-004)", async ({ page }) => {
    await onboard(page);
    await nav(page, "설정");
    await expect.poll(() => panelLeft(page, "settings")).toBe(0);
    await page.getByRole("button", { name: /^내 이름/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByTestId("screen-area")).toHaveCSS("overflow-x", "hidden");
    await page.getByTestId("screen-area").evaluate((el) => el.scrollBy({ left: 300 })); // 강제 스크롤 시도도 무시(overflow hidden 은 사용자 스크롤만 막음 → 위치 확인)
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("screen-area")).toHaveCSS("overflow-x", "auto");
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
  await page.waitForTimeout(50);
  expect(await panelLeft(page, "settings")).toBe(0);
});

test("스와이프를 시작한 위치의 메뉴 행은 손을 떼도 열리지 않는다 (NAV-004)", async ({ page }) => {
  test.skip(!(await touchSession(page)), "WebKit 은 Playwright 터치 이동 미지원 — 실기기 검증");
  await onboard(page);
  await nav(page, "설정");
  await expect.poll(() => panelLeft(page, "settings")).toBe(0);
  const row = page.getByRole("button", { name: /^연애 시작일/ });
  const box = (await row.boundingBox())!;
  await swipe(page, -200, { at: { x: box.x + box.width * 0.8, y: box.y + box.height / 2 } });
  await expect.poll(() => panelLeft(page, "home")).toBe(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // 탭은 그대로 동작
  await nav(page, "설정");
  await expect.poll(() => panelLeft(page, "settings")).toBe(0);
  await row.click();
  await expect(page.getByRole("dialog", { name: "연애 시작일" })).toBeVisible();
});
