/**
 * 화면 전환 성능 측정 (고정 날짜·가상 데이터, 프로덕션 빌드).
 * 측정 항목: 깜빡임 프레임, 전환 완료 시간, IndexedDB 요청 수, Object URL 생성 수, DOM 변경 수(Mount/Unmount 대리 지표),
 * Long Task, 스와이프 중 프레임 시간, 연속 전환 후 메모리. 결과는 [PERF] JSON 한 줄로 출력한다.
 * 제한: React 렌더 횟수는 프로덕션 빌드에서 직접 셀 수 없어 DOM 변경 수로 대신한다. 실제 iPhone 수치를 대체하지 않는다.
 */
import { expect, test, type Page } from "@playwright/test";

const PHOTOS = "tests/fixtures/photos";

/** 페이지에 주입: IDB·Object URL 계측과 프레임 단위 화면 상태 기록 */
function instrument() {
  const w = window as unknown as Record<string, unknown>;
  const counters = { idb: 0, objectUrl: 0, mutations: 0 };
  for (const proto of [IDBObjectStore.prototype, IDBIndex.prototype] as unknown as Record<string, (...a: unknown[]) => unknown>[]) {
    for (const name of ["get", "getAll", "getAllKeys", "count", "openCursor", "openKeyCursor"]) {
      const original = proto[name];
      if (typeof original !== "function") continue;
      proto[name] = function (this: unknown, ...args: unknown[]) {
        counters.idb++;
        return original.apply(this, args);
      };
    }
  }
  const createObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (obj: Blob | MediaSource) => {
    counters.objectUrl++;
    return createObjectURL(obj);
  };
  const longTasks: number[] = [];
  try {
    new PerformanceObserver((list) => list.getEntries().forEach((e) => longTasks.push(e.duration))).observe({ type: "longtask", buffered: false });
  } catch {
    /* WebKit 미지원 */
  }

  const ready = (panel: Element) => {
    const name = panel.getAttribute("data-screen");
    const imgs = [...panel.querySelectorAll("img")];
    const imagesOk = imgs.every((img) => img.complete && img.naturalWidth > 0);
    if (name === "home") return !!panel.querySelector("[data-testid=dday-number]") && imgs.length > 0 && imagesOk;
    if (name === "settings") return !!panel.querySelector("h1") && imgs.length > 0 && imagesOk;
    if (name === "anniversary") return panel.querySelectorAll("[data-testid=timeline-item]").length > 0 && !!panel.querySelector("[data-testid=today-divider]");
    return false;
  };

  w.__perf = {
    counters,
    longTasks,
    /** 대상 화면이 제자리에 오고 내용이 준비될 때까지 프레임마다 기록 */
    track(target: string, timeoutMs = 3000) {
      const area = document.querySelector("[data-testid=screen-area]")!;
      const observer = new MutationObserver((records) => records.forEach((r) => (counters.mutations += r.addedNodes.length + r.removedNodes.length)));
      observer.observe(area, { childList: true, subtree: true });
      const base = { ...counters, longTasks: longTasks.length };
      const start = performance.now();
      let flashFrames = 0;
      let frames = 0;
      const deltas: number[] = [];
      const why: string[] = [];
      let last = start;
      return new Promise((resolve) => {
        const tick = (now: number) => {
          frames++;
          deltas.push(now - last);
          last = now;
          const a = area.getBoundingClientRect();
          let covered = 0;
          let targetDone = false;
          for (const panel of document.querySelectorAll("[data-screen]")) {
            const r = panel.getBoundingClientRect();
            const visible = Math.max(0, Math.min(r.right, a.right) - Math.max(r.left, a.left));
            if (visible <= 0) continue;
            const style = getComputedStyle(panel);
            const opaque = parseFloat(style.opacity) >= 0.99 && style.visibility !== "hidden";
            const ok = ready(panel) && opaque;
            if (!ok && why.length < 6) why.push(`${frames}:${panel.getAttribute("data-screen")} L${Math.round(r.left - a.left)} vis${style.visibility} ready${ready(panel)} imgs${[...panel.querySelectorAll("img")].map((i) => `${i.complete}/${i.naturalWidth}`).join(",")}`);
            if (ok) covered += visible;
            if (panel.getAttribute("data-screen") === target && Math.abs(r.left - a.left) < 1 && ok) targetDone = true;
          }
          if (covered < a.width * 0.98) flashFrames++;
          if (targetDone || now - start > timeoutMs) {
            observer.disconnect();
            const tasks = longTasks.slice(base.longTasks);
            resolve({
              settleMs: Math.round(now - start),
              timedOut: !targetDone,
              frames,
              flashFrames,
              maxFrameMs: Math.round(Math.max(...deltas.slice(1), 0)),
              slowFrames: deltas.slice(1).filter((d) => d > 20).length,
              idb: counters.idb - base.idb,
              objectUrl: counters.objectUrl - base.objectUrl,
              domMutations: counters.mutations - base.mutations,
              longTasks: tasks.length,
              longTaskMs: Math.round(tasks.reduce((s, d) => s + d, 0)),
              why: why.join(" | "),
            });
          } else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    },
  };
}

async function pickDate(page: Page, year: number, month: number, date: string) {
  await page.getByRole("button", { name: /\d{4}년 \d{1,2}월/ }).click();
  await page.getByRole("option", { name: String(year), exact: true }).click();
  await page.getByRole("option", { name: `${month}월`, exact: true }).click();
  await page.getByRole("button", { name: date, exact: true }).click();
}

/** 10년 차 커플 + 프로필 사진 + 추억 3건(사진 2장씩) */
async function seed(page: Page) {
  // 시계를 고정하지 않는다: Playwright 가짜 시계가 Motion 애니메이션 시간에 영향을 주어 측정이 왜곡된다.
  await page.goto("/");
  await page.getByTestId("image-file-input").setInputFiles(`${PHOTOS}/photo-1.jpg`);
  await expect(page.getByRole("button", { name: /나 사진 선택/ }).locator("img")).toBeVisible();
  await page.getByLabel("내 이름").fill("하늘");
  await page.getByLabel("상대방 이름").fill("바다");
  await page.getByRole("button", { name: "처음 사귄 날" }).click();
  await pickDate(page, 2016, 7, "2016-07-01");
  await page.getByRole("button", { name: "선택", exact: true }).click();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page.getByText("TOGETHER")).toBeVisible();
  await page.getByTestId("bottom-navigation").getByRole("button", { name: "기념일" }).click();
  for (const [title, files] of [
    ["3600일", ["photo-2.png", "photo-3.jpg"]],
    ["3500일", ["photo-4.png", "photo-5.jpg"]],
    ["9주년", ["photo-6.png", "photo-1.jpg"]],
  ] as const) {
    await page.getByRole("button", { name: `${title} 추억 사진 추가` }).click();
    await page.getByTestId("memory-file-input").setInputFiles(files.map((f) => `${PHOTOS}/${f}`));
    await page.getByRole("dialog").getByRole("button", { name: "사진 1, 대표 사진" }).waitFor();
    await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.getByTestId("bottom-navigation").getByRole("button", { name: "메인" }).click();
  await page.reload();
  await expect(page.getByTestId("dday-number")).toBeVisible();
  await page.waitForTimeout(500);
}

type Result = Record<string, number | boolean | string>;

async function viaNav(page: Page, label: string, target: string): Promise<Result> {
  const result = page.evaluate((t) => (window as unknown as { __perf: { track: (t: string) => Promise<Result> } }).__perf.track(t), target);
  await page.getByTestId("bottom-navigation").getByRole("button", { name: label }).click();
  return result;
}

async function viaSwipe(page: Page, dx: number, target: string): Promise<Result> {
  const { width, height } = page.viewportSize()!;
  const startX = dx < 0 ? width * 0.8 : width * 0.2;
  const y = height * 0.45;
  const result = page.evaluate((t) => (window as unknown as { __perf: { track: (t: string, ms: number) => Promise<Result> } }).__perf.track(t, 4000), target);
  await page.mouse.move(startX, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(startX + (dx * i) / 12, y + i * 0.5);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  return result;
}

const summarize = (list: Result[]) => {
  const keys = Object.keys(list[0]).filter((k) => typeof list[0][k] === "number");
  return Object.fromEntries(keys.map((k) => [k, { avg: +(list.reduce((s, r) => s + (r[k] as number), 0) / list.length).toFixed(1), max: Math.max(...list.map((r) => r[k] as number)) }]));
};

for (const motion of ["no-preference", "reduce"] as const) {
test.describe(`모션 ${motion}`, () => {
test.use({ reducedMotion: motion });
test(`화면 전환 성능 (motion=${motion})`, async ({ page, browserName }) => {
  await page.addInitScript(instrument);
  await seed(page);
  if (browserName === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  const fontsBefore = await page.evaluate(() => performance.getEntriesByType("resource").filter((e) => e.name.includes("/fonts/")).length);

  const nav: Result[] = [];
  const swipe: Result[] = [];
  for (let round = 0; round < 3; round++) {
    nav.push(await viaNav(page, "기념일", "anniversary"));
    nav.push(await viaNav(page, "메인", "home"));
    nav.push(await viaNav(page, "설정", "settings"));
    nav.push(await viaNav(page, "메인", "home"));
    swipe.push(await viaSwipe(page, -160, "anniversary"));
    swipe.push(await viaSwipe(page, 160, "home"));
    swipe.push(await viaSwipe(page, 160, "settings"));
    swipe.push(await viaSwipe(page, -160, "home"));
  }

  // 연속 빠른 전환 안정성 + 메모리
  let heapBefore = 0;
  let heapAfter = 0;
  const cdp = browserName === "chromium" ? await page.context().newCDPSession(page) : null;
  const heap = async () => {
    if (!cdp) return 0;
    await cdp.send("HeapProfiler.collectGarbage");
    return page.evaluate(() => (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize);
  };
  heapBefore = await heap();
  const bar = page.getByTestId("bottom-navigation");
  for (let i = 0; i < 20; i++) {
    await bar.getByRole("button", { name: ["기념일", "설정", "메인"][i % 3] }).click({ delay: 0 });
  }
  await bar.getByRole("button", { name: "메인" }).click();
  await expect(page.getByTestId("dday-number")).toBeVisible();
  await page.waitForTimeout(1500);
  heapAfter = await heap();
  const fontsAfter = await page.evaluate(() => performance.getEntriesByType("resource").filter((e) => e.name.includes("/fonts/")).length);

  const report = {
    browser: browserName,
    motion,
    cpuThrottle: browserName === "chromium" ? 4 : 1,
    nav: summarize(nav),
    swipe: summarize(swipe),
    navTimeouts: nav.filter((r) => r.timedOut).length,
    swipeTimeouts: swipe.filter((r) => r.timedOut).length,
    fontRequestsDuringTransitions: fontsAfter - fontsBefore,
    heapMB: cdp ? { before: +(heapBefore / 1048576).toFixed(1), after20Rapid: +(heapAfter / 1048576).toFixed(1) } : "n/a",
  };
  console.log(`[PERF] ${JSON.stringify(report)}`);
  console.log(`[WHY] ${JSON.stringify(nav.filter((r) => (r.flashFrames as number) > 0).map((r) => r.why))}`);
  console.log(`[FLASH] nav=${JSON.stringify(nav.map((r) => r.flashFrames))} swipe=${JSON.stringify(swipe.map((r) => r.flashFrames))}`);
});
});
}
