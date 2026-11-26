import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

// 앱 셸("/") precache revision. git 커밋이 없으면 빌드마다 새 값을 사용한다.
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  additionalPrecacheEntries: [{ url: "/", revision }],
  // PretendardVariable.woff2(약 2.0MB)가 기본 상한 2MiB에 근접하므로 명시적으로 상향한다.
  maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
  useNativeEsbuild: false,
});
