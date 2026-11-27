import base from "./playwright.config";
import { defineConfig } from "@playwright/test";

/**
 * 화면 전환 성능 측정 전용 설정 (기본 E2E 와 분리). 프로덕션 빌드 대상.
 * 실행: npm run build && npx playwright test -c playwright.perf.config.ts
 */
export default defineConfig({
  ...base,
  testDir: "tests/perf",
  testMatch: "**/*.perf.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
});
