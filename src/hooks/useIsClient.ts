"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => undefined;

/** 클라이언트 마운트 여부 (SSR 중 false). 브라우저 전용 API·포털 사용 경계에 쓴다. */
export function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
