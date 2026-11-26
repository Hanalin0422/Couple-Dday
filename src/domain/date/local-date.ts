/**
 * 현지 달력 날짜(LocalDate) 검증 및 연산 (ARCHITECTURE.md §7, DATE-010, DB-014).
 *
 * - 날짜는 `YYYY-MM-DD` 문자열로만 다루며 내부 연산 시에만 현지 자정 Date로 변환한다.
 * - `new Date('YYYY-MM-DD')`(UTC 해석) 및 밀리초/86400000 나눗셈을 사용하지 않는다.
 * - 존재하지 않는 날짜(2월 30일 등)는 자동 보정하지 않고 거부한다.
 */
import { addDays, addYears, differenceInCalendarDays } from "date-fns";
import type { LocalDate } from "@/domain/entities";

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export class InvalidLocalDateError extends Error {
  constructor(value: unknown) {
    super(`유효하지 않은 날짜입니다: ${String(value)}`);
    this.name = "InvalidLocalDateError";
  }
}

/** 현지 자정 Date 생성. 0~99년이 1900년대로 해석되지 않도록 setFullYear를 사용한다. */
function toLocalMidnight(year: number, monthIndex: number, day: number): Date {
  const date = new Date(2000, 0, 1);
  date.setFullYear(year, monthIndex, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** 엄격한 형식 + 왕복 검증으로 실제 존재하는 날짜인지 확인한다. */
export function validateLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string") return false;
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const date = toLocalMidnight(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function assertLocalDate(value: unknown): asserts value is LocalDate {
  if (!validateLocalDate(value)) throw new InvalidLocalDateError(value);
}

/** LocalDate → 현지 자정 Date. 유효하지 않으면 예외. */
export function parseLocalDate(value: LocalDate): Date {
  assertLocalDate(value);
  const [year, month, day] = value.split("-").map(Number);
  return toLocalMidnight(year, month - 1, day);
}

/** Date의 현지 달력 날짜를 LocalDate로 변환한다(시각은 버린다). */
export function toLocalDate(date: Date): LocalDate {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 달력 날짜 차이 (a - b). */
export function diffCalendarDays(a: LocalDate, b: LocalDate): number {
  return differenceInCalendarDays(parseLocalDate(a), parseLocalDate(b));
}

export function addDaysToLocalDate(date: LocalDate, days: number): LocalDate {
  return toLocalDate(addDays(parseLocalDate(date), days));
}

/** 달력 기준 연 가산. 2월 29일은 평년에 2월 28일로 처리된다(date-fns addYears). */
export function addYearsToLocalDate(date: LocalDate, years: number): LocalDate {
  return toLocalDate(addYears(parseLocalDate(date), years));
}

/** 같은 형식(4자리 연도)의 LocalDate는 문자열 비교로 순서를 판단할 수 있다. */
export function compareLocalDate(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxLocalDate(a: LocalDate, b: LocalDate): LocalDate {
  return a >= b ? a : b;
}

export function getLocalDateYear(date: LocalDate): number {
  assertLocalDate(date);
  return Number(date.slice(0, 4));
}

/** 화면 표시 형식 `YYYY.MM.DD` (HOME-008). */
export function formatDisplayDate(date: LocalDate): string {
  assertLocalDate(date);
  return date.replaceAll("-", ".");
}
