/**
 * 사용자 지정 기념일 수정 규칙 (CUS-002~011, ARC-A01~A05, ARCHITECTURE.md §6.2·§17 — 2026-11-26 사용자 확정).
 *
 * - 신규 등록·날짜 변경은 연애 시작일 이상 (DATE-009). 미래 허용.
 * - 시작일 변경으로 시작일 이전이 된 기존 기념일은 날짜를 바꾸지 않는 한(이름만 수정) 그대로 저장할 수 있다 (ARC-A01).
 * - 전체 반복 수정: 월·일만 변경, 시작(등록) 연도 고정. 개별 연도 예외는 유지한다.
 * - 해당 연도만 수정: 같은 연도 안에서만 날짜 이동.
 * - 일회성 ↔ 매년 반복 전환은 제공하지 않는다.
 */
import type { LocalDate } from "@/domain/entities";
import { getLocalDateYear, validateLocalDate } from "@/domain/date/local-date";

export type AnniversaryDateViolation = "invalid-date" | "before-start-date" | "year-changed";

/** 날짜를 바꾸지 않았다면 기존 값을 허용하고, 바꿨다면 시작일 이상이어야 한다. */
export function validateEditedDate(next: LocalDate, previous: LocalDate | null, startDate: LocalDate): AnniversaryDateViolation | null {
  if (!validateLocalDate(next)) return "invalid-date";
  if (previous !== null && next === previous) return null;
  return next < startDate ? "before-start-date" : null;
}

/** 전체 반복 수정: 시작(등록) 연도를 유지한 채 월·일만 변경. */
export function validateSeriesDateEdit(next: LocalDate, previous: LocalDate, startDate: LocalDate): AnniversaryDateViolation | null {
  if (!validateLocalDate(next)) return "invalid-date";
  if (getLocalDateYear(next) !== getLocalDateYear(previous)) return "year-changed";
  return validateEditedDate(next, previous, startDate);
}

/** 해당 연도만 수정: 원래 발생 연도 안에서만 이동. */
export function validateOccurrenceDateEdit(
  next: LocalDate,
  occurrenceYear: number,
  previous: LocalDate,
  startDate: LocalDate,
): AnniversaryDateViolation | null {
  if (!validateLocalDate(next)) return "invalid-date";
  if (getLocalDateYear(next) !== occurrenceYear) return "year-changed";
  return validateEditedDate(next, previous, startDate);
}

/** 연도 범위 [1월 1일, 12월 31일] (DatePicker 제한용). */
export function yearBounds(year: number): { min: LocalDate; max: LocalDate } {
  const y = String(year).padStart(4, "0");
  return { min: `${y}-01-01`, max: `${y}-12-31` };
}
