import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * E2E / 시각 회귀 설정.
 * - 프로덕션 빌드(next start)를 대상으로 실행하여 Service Worker·폰트 precache 동작까지 확인한다.
 * - WebKit(iPhone 에뮬레이션)은 실제 iOS 실기기 검증을 대체하지 않는다 (ARCHITECTURE.md §15).
 * - 시각 회귀 기준 이미지는 사용자 승인 후 생성한다.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium-iphone", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "webkit-iphone", use: { ...devices["iPhone 15"] } },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
