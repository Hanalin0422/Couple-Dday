/**
 * 기념일 발생 ID (ARCHITECTURE.md §6, ANN-011, CUS-011).
 *
 * | 종류 | 발생 ID |
 * | 자동 N일 | auto:day:{N} |
 * | 자동 N주년 | auto:year:{N} |
 * | 일회성 사용자 지정 | custom:{uuid} |
 * | 매년 반복 | custom:{uuid}:{occurrenceYear} |
 *
 * 추억은 날짜가 아닌 이 논리적 ID에 연결되므로 시작일/오프셋 변경에도 ID는 바뀌지 않는다.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type ParsedOccurrenceId =
  | { kind: "auto-day"; days: number }
  | { kind: "auto-year"; years: number }
  | { kind: "custom"; seriesId: string; occurrenceYear: number | null };

export function isValidSeriesId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${label}는 1 이상의 정수여야 합니다: ${value}`);
}

export function autoDayOccurrenceId(days: number): string {
  assertPositiveInteger(days, "일수");
  return `auto:day:${days}`;
}

export function autoYearOccurrenceId(years: number): string {
  assertPositiveInteger(years, "주년");
  return `auto:year:${years}`;
}

export function customOccurrenceId(seriesId: string, occurrenceYear: number | null = null): string {
  if (!isValidSeriesId(seriesId)) throw new RangeError(`유효하지 않은 기념일 ID입니다: ${seriesId}`);
  if (occurrenceYear === null) return `custom:${seriesId}`;
  assertPositiveInteger(occurrenceYear, "발생 연도");
  return `custom:${seriesId}:${occurrenceYear}`;
}

const POSITIVE_INT = "([1-9]\\d*)";
const AUTO_DAY = new RegExp(`^auto:day:${POSITIVE_INT}$`);
const AUTO_YEAR = new RegExp(`^auto:year:${POSITIVE_INT}$`);
const CUSTOM = new RegExp(`^custom:([0-9a-f-]{36})(?::${POSITIVE_INT})?$`);

/** 발생 ID를 해석한다. 형식이 맞지 않으면 null (백업 복원 검증 등에서 사용). */
export function parseOccurrenceId(id: string): ParsedOccurrenceId | null {
  let match = AUTO_DAY.exec(id);
  if (match) {
    const days = Number(match[1]);
    return Number.isSafeInteger(days) ? { kind: "auto-day", days } : null;
  }
  match = AUTO_YEAR.exec(id);
  if (match) {
    const years = Number(match[1]);
    return Number.isSafeInteger(years) ? { kind: "auto-year", years } : null;
  }
  match = CUSTOM.exec(id);
  if (match && isValidSeriesId(match[1])) {
    const occurrenceYear = match[2] === undefined ? null : Number(match[2]);
    if (occurrenceYear !== null && !Number.isSafeInteger(occurrenceYear)) return null;
    return { kind: "custom", seriesId: match[1], occurrenceYear };
  }
  return null;
}
