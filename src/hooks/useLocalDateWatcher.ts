"use client";

import { useEffect } from "react";
import { getToday, watchLocalDate } from "@/infrastructure/browser/clock";
import { useDateStore } from "@/stores/date-store";

/** 오늘 날짜를 초기화하고 복귀·자정 시 갱신한다 (DATE-E03, DATE-E04, PWA-009). AppShell 최상위에서 한 번 사용한다. */
export function useLocalDateWatcher(): void {
  const setToday = useDateStore((s) => s.setToday);
  useEffect(() => {
    const check = () => setToday(getToday());
    check();
    return watchLocalDate(check);
  }, [setToday]);
}
