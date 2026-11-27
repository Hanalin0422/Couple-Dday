/**
 * 실제 터치 이벤트(CDP Input.dispatchTouchEvent) 기반 스와이프 사용감 측정. Chromium(모바일 에뮬레이션, CPU 4배 감속) 전용.
 * - startLagPx: 화면이 처음 1px 이상 움직이기 전까지 손가락 이동 거리(작을수록 즉시 반응)
 * - trackingSlope: 반응 시작 후 손가락 이동 거리 대비 화면 이동 거리(1 = 손가락과 같이 움직임)
 * - slow160 / fling100 / past240: 천천히 160px·빠르게 100px·천천히 240px 끈 뒤 정렬된 화면과 정렬 시간(ms)
 * - blankFrames: 손을 뗀 뒤 정렬 중 화면에 내용 없는 영역이 보인 프레임 수
 * 결과: [TOUCH] JSON. 실제 iPhone(WebKit) 터치 파이프라인 수치를 대체하지 않는다.
 */
import { expect, test, type CDPSession, type Page } from "@playwright/test";

async function pickDate(page: Page, year: number, month: number, date: string) {
  await page.getByRole("button", { name: /\d{4}년 \d{1,2}월/ }).click();
  await page.getByRole("option", { name: String(year), exact: true }).click();
  await page.getByRole("option", { name: `${month}월`, exact: true }).click();
  await page.getByRole("button", { name: date, exact: true }).click();
}

async function seed(page: Page) {
  await page.goto("/");
  await page.getByTestId("image-file-input").setInputFiles("tests/fixtures/photos/photo-1.jpg");
  await page.getByLabel("내 이름").fill("하늘");
  await page.getByLabel("상대방 이름").fill("바다");
  await page.getByRole("button", { name: "처음 사귄 날" }).click();
  await pickDate(page, 2016, 7, "2016-07-01");
  await page.getByRole("button", { name: "선택", exact: true }).click();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page.getByTestId("dday-number")).toBeVisible();
  await page.waitForTimeout(1000);
}

const homeLeft = (page: Page) =>
  page.evaluate(() => {
    const area = document.querySelector("[data-testid=screen-area]")!.getBoundingClientRect();
    return document.querySelector("[data-screen=home]")!.getBoundingClientRect().left - area.left;
  });

const touch = (cdp: CDPSession, type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
  cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });

test.use({ reducedMotion: "no-preference" });

test("터치 스와이프 사용감", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "CDP 터치 이벤트는 Chromium 전용");
  await seed(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const { width, height } = page.viewportSize()!;
  const y = Math.round(height * 0.45);

  /** 손을 뗀 뒤: 어느 화면에 정렬되었는지, 정렬까지 시간, 빈 영역 프레임 */
  const settle = () =>
    page.evaluate(
      () =>
        new Promise<{ ms: number; blank: number; at: string }>((resolve) => {
          const area = document.querySelector("[data-testid=screen-area]")!;
          const t0 = performance.now();
          let blank = 0;
          let stable = 0;
          let lastLeft = NaN;
          const tick = (now: number) => {
            const a = area.getBoundingClientRect();
            let covered = 0;
            let aligned = "";
            for (const panel of document.querySelectorAll<HTMLElement>("[data-screen]")) {
              const r = panel.getBoundingClientRect();
              const st = getComputedStyle(panel);
              if (Math.abs(r.left - a.left) < 1) aligned = panel.dataset.screen!;
              if (st.visibility === "hidden" || panel.childElementCount === 0) continue;
              covered += Math.max(0, Math.min(r.right, a.right) - Math.max(r.left, a.left));
            }
            if (covered < a.width * 0.99) blank++;
            const left = document.querySelector("[data-screen=home]")!.getBoundingClientRect().left;
            stable = aligned && left === lastLeft ? stable + 1 : 0;
            lastLeft = left;
            if (stable >= 3 || now - t0 > 3000) resolve({ ms: Math.round(now - t0), blank, at: aligned || "none" });
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );
  const backHome = async () => {
    await page.getByTestId("bottom-navigation").getByRole("button", { name: "메인" }).click();
    await expect.poll(() => homeLeft(page)).toBeGreaterThan(-1);
    await page.waitForTimeout(600);
  };

  const runs: Record<string, number | string>[] = [];
  const startX = Math.round(width * 0.85);
  for (let round = 0; round < 3; round++) {
    // (1) 천천히 160px 끌기: 반응 시작 지점·추적 비율, 멈췄다 놓기
    await touch(cdp, "touchStart", startX, y);
    let startLag = -1;
    let at40 = 0;
    let finger = 0;
    const steps = [...Array.from({ length: 10 }, () => 2), ...Array.from({ length: 14 }, () => 10)];
    for (const step of steps) {
      finger += step;
      await touch(cdp, "touchMove", startX - finger, y);
      await page.waitForTimeout(16);
      const moved = -(await homeLeft(page));
      if (startLag < 0 && moved >= 1) startLag = finger;
      if (finger === 40) at40 = moved;
    }
    const at160 = -(await homeLeft(page));
    await page.waitForTimeout(250); // 멈춘 뒤 놓기(속도 0)
    await touch(cdp, "touchEnd", 0, 0);
    const slow = await settle();
    await backHome();

    // (2) 빠르게 튕기기: 100px 를 4번에 나눠 지연 없이
    await touch(cdp, "touchStart", startX, y);
    for (let i = 1; i <= 4; i++) await touch(cdp, "touchMove", startX - 25 * i, y);
    await touch(cdp, "touchEnd", 0, 0);
    const fling = await settle();
    await backHome();

    // (3) 천천히 화면 절반 넘게(240px) 끌고 멈췄다 놓기
    await touch(cdp, "touchStart", startX, y);
    for (let i = 1; i <= 12; i++) {
      await touch(cdp, "touchMove", startX - 20 * i, y);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(250);
    await touch(cdp, "touchEnd", 0, 0);
    const past = await settle();
    await backHome();

    runs.push({
      startLagPx: startLag,
      trackingSlope: +((at160 - at40) / 120).toFixed(2),
      slow160: slow.at,
      slow160Ms: slow.ms,
      fling100: fling.at,
      fling100Ms: fling.ms,
      past240: past.at,
      past240Ms: past.ms,
      blankFrames: slow.blank + fling.blank + past.blank,
    });
  }

  console.log(`[TOUCH] ${JSON.stringify(runs)}`);
});
