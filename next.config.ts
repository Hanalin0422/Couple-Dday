import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

// Local-first 단일 클라이언트 앱이므로 서버 렌더링 최적화 옵션(cacheComponents 등)은 사용하지 않는다.
// cacheComponents는 Serwist 라우트 핸들러의 route segment config(dynamic/revalidate)와 호환되지 않는다.
const nextConfig: NextConfig = {
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
