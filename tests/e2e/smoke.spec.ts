/**
 * Phase 0 스모크 테스트: 프로덕션 빌드의 기본 셸, 라이트모드, 로컬 폰트, manifest, Service Worker 산출물 확인.
 * 화면별 E2E 및 시각 회귀는 각 Phase 에서 추가한다.
 */
import { expect, test } from "@playwright/test";

const FONT_FACES = [
  { family: "Pretendard", descriptor: "500 16px Pretendard", file: "/fonts/pretendard/PretendardVariable.woff2" },
  { family: "MaruBuri", descriptor: "600 28px MaruBuri", file: "/fonts/maruburi/MaruBuri-SemiBold.woff2" },
  { family: "MaruBuri", descriptor: "400 38px MaruBuri", file: "/fonts/maruburi/MaruBuri-Regular.woff2" },
  { family: "Cormorant Garamond", descriptor: "italic 500 88px 'Cormorant Garamond'", file: "/fonts/cormorant-garamond/cormorant-garamond-latin-500-italic.woff2" },
  { family: "Cormorant Garamond", descriptor: "400 12px 'Cormorant Garamond'", file: "/fonts/cormorant-garamond/cormorant-garamond-latin-400-normal.woff2" },
];

test("기본 셸이 한국어·라이트모드 배경으로 렌더링된다", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page).toHaveTitle("D-Day");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(255, 248, 250)"); // #FFF8FA
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
  expect(errors).toEqual([]);
});

test("시스템 다크모드에서도 라이트모드를 유지한다 (PWA-011)", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(255, 248, 250)");
});

test("로컬 폰트가 동일 출처에서 로드된다 (PWA-004, PWA-014)", async ({ page }) => {
  const fontRequests: string[] = [];
  page.on("request", (req) => req.resourceType() === "font" && fontRequests.push(req.url()));
  await page.goto("/");
  for (const face of FONT_FACES) {
    const loaded = await page.evaluate(async (d) => (await document.fonts.load(d)).length, face.descriptor);
    expect(loaded, face.descriptor).toBeGreaterThan(0);
  }
  const origin = new URL(page.url()).origin;
  for (const url of fontRequests) expect(url.startsWith(origin), url).toBe(true);
  for (const face of FONT_FACES) {
    const res = await page.request.get(face.file);
    expect(res.status(), face.file).toBe(200);
  }
});

test("manifest와 홈 화면 아이콘이 제공된다 (PWA-001, PWA-002)", async ({ page }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const manifest = await (await page.request.get(href!)).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(manifest.background_color.toUpperCase()).toBe("#FFF8FA");
  expect(manifest.lang).toBe("ko");
  expect(manifest.name).toBe("D-Day");
  expect(manifest.short_name).toBe("D-Day");
  const purposes = manifest.icons.map((i: { purpose?: string }) => i.purpose);
  expect(purposes).toEqual(expect.arrayContaining(["any", "maskable"]));
  for (const icon of manifest.icons as { src: string; type: string }[]) {
    const res = await page.request.get(icon.src);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
  const appleHref = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect(appleHref).toContain("/icons/apple-touch-icon.png");
  expect((await page.request.get(appleHref!)).status()).toBe(200);
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "D-Day");
});

test("Service Worker가 앱 셸과 로컬 폰트를 precache 목록에 포함한다 (SYS-005, PWA-003)", async ({ page }) => {
  const res = await page.request.get("/serwist/sw.js");
  expect(res.status()).toBe(200);
  expect(res.headers()["service-worker-allowed"]).toBe("/");
  const body = await res.text();
  for (const face of FONT_FACES) expect(body, face.file).toContain(face.file);
  expect(body).toMatch(/url:\s*"\/"/);
});
