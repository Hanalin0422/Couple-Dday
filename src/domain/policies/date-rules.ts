/**
 * 날짜 입력 및 등록 가능 여부 정책 (DATE-001~009, DATE-E01, CUS-003, CUS-007, MEM-001, MEM-002, ARC-A01).
 * UI 비활성화와 별개로 저장 직전에도 이 규칙으로 재검증한다(DATE-008).
 */
import type { LocalDate } from "@/domain/entities";
import { validateLocalDate } from "@/domain/date/local-date";

export type DateRuleViolation = "invalid-date" | "future-date" | "before-start-date";

/** 연애 시작일: 유효한 날짜이며 오늘 이하 (오늘 선택 가능). */
export function validateStartDateInput(value: unknown, today: LocalDate): DateRuleViolation | null {
  if (!validateLocalDate(value)) return "invalid-date";
  return value > today ? "future-date" : null;
}

/** 신규/날짜 변경 사용자 지정 기념일: 유효한 날짜이며 연애 시작일 이상. 미래 허용. */
export function validateCustomAnniversaryDateInput(value: unknown, startDate: LocalDate): DateRuleViolation | null {
  if (!validateLocalDate(value)) return "invalid-date";
  return value < startDate ? "before-start-date" : null;
}

/** 신규 추억 사진 등록: 지난 기념일 및 당일만 허용, 미래 금지. */
export function canAddNewMemoryPhoto(occurrenceDate: LocalDate, today: LocalDate): boolean {
  return occurrenceDate <= today;
}

/** 날짜 선택 UI에서 이동 가능한 마지막 달(현재 월, DATE-003). `YYYY-MM` 형식. */
export function getMaxSelectableMonth(today: LocalDate): string {
  return today.slice(0, 7);
}
