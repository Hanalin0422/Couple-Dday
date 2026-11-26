/**
 * 디데이 및 남은 일수 계산 (REQUIREMENTS.md §4 계산 규칙, ARCHITECTURE.md §7).
 *
 * - elapsed = differenceInCalendarDays(today, startDate)
 * - dday = elapsed + dayOffset
 * - 남은 일수 = differenceInCalendarDays(target, today) — 오프셋을 다시 더하지 않는다.
 * - 기기 날짜가 시작일보다 이전이면 음수를 반환하지 않고 오류 상태를 반환한다(DATE-E05).
 */
import type { DayOffset, LocalDate } from "@/domain/entities";
import { diffCalendarDays } from "./local-date";

export type DdayResult =
  | { status: "ok"; elapsed: number; dday: number }
  | { status: "before-start" };

export function calculateDday(startDate: LocalDate, today: LocalDate, dayOffset: DayOffset): DdayResult {
  const elapsed = diffCalendarDays(today, startDate);
  if (elapsed < 0) return { status: "before-start" };
  return { status: "ok", elapsed, dday: elapsed + dayOffset };
}

/** 기념일까지 남은 일수. 당일 0, 지난 날짜는 음수. */
export function calculateRemainingDays(target: LocalDate, today: LocalDate): number {
  return diffCalendarDays(target, today);
}

/** 타임라인 D-N 표기 (ANN-008). 지난 날짜는 null. */
export function formatDdayLabel(target: LocalDate, today: LocalDate): string | null {
  const remaining = calculateRemainingDays(target, today);
  if (remaining < 0) return null;
  return remaining === 0 ? "D-DAY" : `D-${remaining}`;
}
