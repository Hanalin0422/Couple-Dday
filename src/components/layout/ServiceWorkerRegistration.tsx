"use client";

import { useEffect, type ReactNode } from "react";
import { SerwistProvider } from "@serwist/turbopack/react";

/** 앱 복귀 시 업데이트 확인 간격 */
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Service Worker 등록 경계 (클라이언트 전용, ARCHITECTURE.md §13, PWA-003, PWA-005).
 * - 개발 모드에서는 캐시 혼선을 막기 위해 등록하지 않는다.
 * - reloadOnOnline=false: 온라인 복귀 시 강제 reload 를 금지한다(저장/복원/백업 중 강제 reload 금지).
 * - 업데이트: 앱으로 돌아올 때(최대 30분마다) 새 버전을 확인해 내려받는다. skipWaiting 을 쓰지 않으므로 새 버전은
 *   열린 화면을 모두 닫은 뒤 다음 실행 때 활성화된다(작업 중 교체·강제 reload 없음). 개인 데이터(IndexedDB)는 SW 와 무관하게 유지된다.
 */
export function ServiceWorkerRegistration({ children }: { children: ReactNode }) {
  const disabled = process.env.NODE_ENV === "development";
  useEffect(() => {
    if (disabled || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let lastCheck = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return;
      lastCheck = Date.now();
      navigator.serviceWorker
        .getRegistration()
        .then((registration) => registration?.update())
        .catch(() => undefined); // 오프라인 등에서 실패해도 무시
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [disabled]);

  return (
    <SerwistProvider swUrl="/serwist/sw.js" disable={disabled} reloadOnOnline={false}>
      {children}
    </SerwistProvider>
  );
}
