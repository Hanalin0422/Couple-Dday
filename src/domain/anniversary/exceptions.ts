/**
 * 사용자 지정 기념일 발생 건 생성 및 반복 예외 적용 (CUS-004, CUS-011, ARC-A02~A05, ARCHITECTURE.md §6.1).
 *
 * - 일회성: 원본 날짜 1건. 표시 범위와 무관하게 항상 포함한다(TML-014 예외 규칙).
 * - 매년 반복: 등록 날짜의 연도부터 생성하며 소급하지 않는다(ARC-A05).
 *   원본 월/일 기준으로 매년 생성하고 2월 29일은 평년 2월 28일(ARC-A04). 직전 발생 건에 누적 가산하지 않는다.
 * - `[seriesId, occurrenceYear]` 예외: cancelled면 생성하지 않고, override면 지정 필드만 덮어쓴다.
 *   예외로 날짜가 이동해도 발생 ID(원래 연도)는 유지하며 실제 날짜로 필터링한다.
 */
import type { AnniversaryException, CustomAnniversary, LocalDate } from "@/domain/entities";
import { addYearsToLocalDate, getLocalDateYear } from "@/domain/date/local-date";
import { customOccurrenceId } from "./occurrence-id";
import type { CustomOccurrence } from "./types";

export function exceptionKey(seriesId: string, occurrenceYear: number): string {
  return `${seriesId}|${occurrenceYear}`;
}

export function indexExceptions(exceptions: readonly AnniversaryException[]): Map<string, AnniversaryException> {
  const map = new Map<string, AnniversaryException>();
  for (const exception of exceptions) map.set(exceptionKey(exception.seriesId, exception.occurrenceYear), exception);
  return map;
}

/** 매년 반복 시리즈의 특정 연도 원래 날짜(예외 적용 전). */
export function getYearlyOccurrenceDate(seriesDate: LocalDate, occurrenceYear: number): LocalDate {
  return addYearsToLocalDate(seriesDate, occurrenceYear - getLocalDateYear(seriesDate));
}

function buildYearlyOccurrence(
  series: CustomAnniversary,
  occurrenceYear: number,
  exception: AnniversaryException | undefined,
): CustomOccurrence | null {
  if (exception?.kind === "cancelled") return null;
  const override = exception?.kind === "override" ? exception : undefined;
  return {
    kind: "custom",
    id: customOccurrenceId(series.id, occurrenceYear),
    date: override?.overrideDate ?? getYearlyOccurrenceDate(series.date, occurrenceYear),
    title: override?.overrideTitle ?? series.title,
    seriesId: series.id,
    repeatType: "yearly",
    occurrenceYear,
    isOverridden: override !== undefined,
    createdAt: series.createdAt,
  };
}

/**
 * 사용자 지정 기념일 발생 건을 생성한다.
 * @param until 매년 반복 전개의 상한(미포함). 실제 날짜가 until 이전인 발생 건만 포함한다.
 */
export function generateCustomOccurrences(
  anniversaries: readonly CustomAnniversary[],
  exceptions: readonly AnniversaryException[],
  until: LocalDate,
): CustomOccurrence[] {
  const exceptionIndex = indexExceptions(exceptions);
  const untilYear = getLocalDateYear(until);
  const result: CustomOccurrence[] = [];

  for (const series of anniversaries) {
    if (series.repeatType === "none") {
      result.push({
        kind: "custom",
        id: customOccurrenceId(series.id),
        date: series.date,
        title: series.title,
        seriesId: series.id,
        repeatType: "none",
        occurrenceYear: null,
        isOverridden: false,
        createdAt: series.createdAt,
      });
      continue;
    }

    const firstYear = getLocalDateYear(series.date);
    const years = new Set<number>();
    for (let year = firstYear; year <= untilYear + 1; year++) years.add(year);
    // 다른 연도로 이동한 override가 상한 이전 날짜를 가지면 포함한다.
    for (const exception of exceptions) {
      if (
        exception.seriesId === series.id &&
        exception.kind === "override" &&
        exception.occurrenceYear >= firstYear &&
        exception.overrideDate !== undefined &&
        exception.overrideDate < until
      ) {
        years.add(exception.occurrenceYear);
      }
    }

    for (const year of [...years].sort((a, b) => a - b)) {
      const occurrence = buildYearlyOccurrence(series, year, exceptionIndex.get(exceptionKey(series.id, year)));
      if (occurrence && occurrence.date < until) result.push(occurrence);
    }
  }
  return result;
}
