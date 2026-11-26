import { APP_NAME } from "@/constants/app";

/**
 * Phase 0 자리표시 화면.
 * 확정 UI(온보딩/메인/설정/기념일)는 Phase 4 의 AppShell 에서 구현하며,
 * 그 전까지 임의의 시각 요소를 추가하지 않는다.
 */
export default function Page() {
  return (
    <main className="min-h-dvh bg-background">
      <h1 className="sr-only">{APP_NAME}</h1>
    </main>
  );
}
