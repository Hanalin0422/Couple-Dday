import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * ARCHITECTURE.md §3 계층 의존성 제한을 정적 검사로 강제한다.
 * - Domain: React, Dexie, Next, 브라우저 저장소 및 상위 계층 의존 금지 (순수 함수)
 * - Infrastructure: UI 의존 금지
 * - Presentation(components/features): DB 직접 접근 금지 → application 계층 경유
 */
const domainRestrictions = {
  patterns: [
    { group: ["react", "react-dom", "react/*", "next", "next/*"], message: "Domain 계층은 React/Next에 의존하지 않는다." },
    { group: ["dexie", "dexie-react-hooks", "zustand", "zustand/*", "jszip", "motion", "motion/*"], message: "Domain 계층은 저장소/상태/UI 라이브러리에 의존하지 않는다." },
    { group: ["@/application/*", "@/infrastructure/*", "@/components/*", "@/features/*", "@/stores/*", "@/hooks/*", "@/app/*"], message: "Domain 계층은 상위 계층을 참조하지 않는다." },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", domainRestrictions],
      "no-restricted-globals": [
        "error",
        { name: "window", message: "Domain 계층은 브라우저 API에 의존하지 않는다." },
        { name: "document", message: "Domain 계층은 브라우저 API에 의존하지 않는다." },
        { name: "localStorage", message: "Domain 계층은 브라우저 저장소에 의존하지 않는다." },
        { name: "indexedDB", message: "Domain 계층은 브라우저 저장소에 의존하지 않는다." },
      ],
    },
  },
  {
    files: ["src/infrastructure/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-dom", "react/*", "dexie-react-hooks"], message: "Infrastructure 계층은 UI에 의존하지 않는다." },
            { group: ["@/components/*", "@/features/*", "@/stores/*", "@/app/*"], message: "Infrastructure 계층은 UI에 의존하지 않는다." },
          ],
        },
      ],
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/infrastructure/db", "@/infrastructure/db/*"], message: "Presentation 계층은 DB를 직접 변경하지 않는다. application 계층을 경유한다." },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
