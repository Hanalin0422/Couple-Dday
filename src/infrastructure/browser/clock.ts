/**
 * 현지 날짜 어댑터 (ARCHITECTURE.md §7 getToday, §7.2 날짜 재조회, PWA-009, DATE-E03, DATE-E04).
 * 클라이언트에서만 호출한다.
 */
import type { LocalDate } from "@/domain/entities";
import { toLocalDate } from "@/domain/date/local-date";

export function getToday(now: Date = new Date()): LocalDate {
  return toLocalDate(now);
}

/** 다음 현지 자정까지 남은 밀리초 (+1초 여유). 서머타임으로 하루 길이가 달라도 달력 기준으로 계산한다. */
export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
  return Math.max(1_000, next.getTime() - now.getTime());
}

/**
 * 날짜 변경 감지: 앱 복귀(focus, pageshow, visibilitychange)와 활성 상태 자정 타이머에서 콜백을 호출한다.
 * 백그라운드/종료 상태의 타이머 실행은 보장하지 않으므로 복귀 이벤트로 보완한다.
 * @returns 정리 함수 (리스너·타이머 해제)
 */
export function watchLocalDate(onCheck: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      onCheck();
      schedule();
    }, msUntilNextLocalMidnight());
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      onCheck();
      schedule();
    }
  };
  const onResume = () => {
    onCheck();
    schedule();
  };
  window.addEventListener("focus", onResume);
  window.addEventListener("pageshow", onResume);
  document.addEventListener("visibilitychange", onVisible);
  schedule();
  return () => {
    clearTimeout(timer);
    window.removeEventListener("focus", onResume);
    window.removeEventListener("pageshow", onResume);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
