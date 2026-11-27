/**
 * 가로 화면 전환 제스처 (브라우저 기본 스크롤 + CSS Scroll Snap 대상).
 * - Chromium: CDP 실제 터치 이벤트(브라우저 스크롤·관성·스냅 경로 그대로)
 * - WebKit(모바일 에뮬레이션): Playwright 가 터치 이동·휠을 지원하지 않아 스크롤 컨테이너를 코드로 스크롤한다
 *   (스냅·양 끝·선택 상태 동기화 검증용. 손가락 추적·관성은 검증 불가 → 실기기 확인)
 * dx < 0: 왼쪽으로 밀기(오른쪽 화면으로), dx > 0: 오른쪽으로 밀기(왼쪽 화면으로)
 */
import type { CDPSession, Page } from "@playwright/test";

const sessions = new WeakMap<Page, CDPSession>();

export async function touchSession(page: Page): Promise<CDPSession | null> {
  if (page.context().browser()?.browserType().name() !== "chromium") return null;
  let cdp = sessions.get(page);
  if (!cdp) {
    cdp = await page.context().newCDPSession(page);
    sessions.set(page, cdp);
  }
  return cdp;
}

export const touchAt = (cdp: CDPSession, type: "touchStart" | "touchMove" | "touchEnd", x = 0, y = 0) =>
  cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });

/** 빠르게 튕기기(fast) 또는 천천히 끌고 멈췄다 놓기(slow) */
export async function swipe(page: Page, dx: number, { speed = "fast", at }: { speed?: "fast" | "slow"; at?: { x: number; y: number } } = {}) {
  const { width, height } = page.viewportSize()!;
  const start = at ?? { x: dx < 0 ? width * 0.85 : width * 0.15, y: height * 0.45 };
  const cdp = await touchSession(page);
  if (cdp) {
    await touchAt(cdp, "touchStart", start.x, start.y);
    const steps = speed === "fast" ? 5 : 12;
    for (let i = 1; i <= steps; i++) {
      await touchAt(cdp, "touchMove", start.x + (dx * i) / steps, start.y);
      if (speed === "slow") await page.waitForTimeout(16);
    }
    if (speed === "slow") await page.waitForTimeout(250);
    await touchAt(cdp, "touchEnd");
  } else {
    // 빠른 튕기기 = 화면 절반 넘게 스크롤(한 화면 이동), 느린 짧은 이동 = 그만큼만 스크롤(제자리로 스냅)
    const delta = speed === "fast" ? -Math.sign(dx) * width * 0.6 : -dx;
    await page.getByTestId("screen-area").evaluate((el, left) => el.scrollBy({ left, behavior: "smooth" }), delta);
  }
  await page.waitForTimeout(700);
}
