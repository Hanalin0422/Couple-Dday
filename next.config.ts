import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import { spawnSync } from "node:child_process";

// Local-first 단일 클라이언트 앱이므로 서버 렌더링 최적화 옵션(cacheComponents 등)은 사용하지 않는다.
// cacheComponents는 Serwist 라우트 핸들러의 route segment config(dynamic/revalidate)와 호환되지 않는다.
// [LAB] 실기기 비교 화면에 표시할 빌드 버전(Vercel 커밋 해시 또는 로컬 git 해시). 제거: src/lab/README.md
const buildSha =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  "local";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_SHA: buildSha }, // [LAB]
  reactStrictMode: true,
  poweredByHeader: false,
  // next dev 가 AGENTS.md 에 Next.js 안내 블록을 자동으로 덧붙이는 동작을 끈다.
  // AGENTS.md 는 사용자 승인 대상 명세 문서이므로 도구가 임의로 수정하지 않게 한다.
  agentRules: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSerwist(nextConfig);
