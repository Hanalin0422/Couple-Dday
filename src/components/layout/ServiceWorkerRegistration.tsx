"use client";

import type { ReactNode } from "react";
import { SerwistProvider } from "@serwist/turbopack/react";

/**
 * Service Worker 등록 경계 (클라이언트 전용).
 * - 개발 모드에서는 캐시 혼선을 막기 위해 등록하지 않는다.
 * - reloadOnOnline=false: 온라인 복귀 시 강제 reload 를 금지한다
 *   (ARCHITECTURE.md §13 "저장/복원/백업 중 강제 reload 금지").
 * - 업데이트 활성화 시점 조율(skipWaiting 등)은 Phase 8(PWA)에서 구현한다.
 */
export function ServiceWorkerRegistration({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={process.env.NODE_ENV === "development"}
      reloadOnOnline={false}
    >
      {children}
    </SerwistProvider>
  );
}
