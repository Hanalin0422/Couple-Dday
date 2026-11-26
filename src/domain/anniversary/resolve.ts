/**
 * 발생 ID → 현재 설정 기준의 실제 날짜·이름 (MEM-001, MEM-002, SET-015, DB-011).
 * 추억은 날짜가 아닌 발생 ID 에 연결되므로, 등록 가능 여부(과거·당일만)는 현재 시작일·오프셋·예외로 다시 계산한다.
 */
import type { AnniversaryException, CustomAnniversary, DayOffset, LocalDate } from "@/domain/entities";
import { getLocalDateYear } from "@/domain/date/local-date";
import { exceptionKey, getYearlyOccurrenceDate, indexExceptions } from "./exceptions";
import { getDayMilestoneDate, getYearMilestoneDate } from "./generator";
import { parseOccurrenceId } from "./occurrence-id";
import { isAutoDayMilestoneNumber } from "./milestones";

export interface ResolvedOccurrence {
  id: string;
  date: LocalDate;
  title: string;
}

export function resolveOccurrence(
  occurrenceId: string,
  context: {
    startDate: LocalDate;
    dayOffset: DayOffset;
    series: readonly CustomAnniversary[];
    exceptions: readonly AnniversaryException[];
  },
): ResolvedOccurrence | null {
  const parsed = parseOccurrenceId(occurrenceId);
  if (!parsed) return null;
  if (parsed.kind === "auto-day") {
    if (!isAutoDayMilestoneNumber(parsed.days)) return null;
    return { id: occurrenceId, date: getDayMilestoneDate(context.startDate, parsed.days, context.dayOffset), title: `${parsed.days}일` };
  }
  if (parsed.kind === "auto-year") {
    return { id: occurrenceId, date: getYearMilestoneDate(context.startDate, parsed.years), title: `${parsed.years}주년` };
  }
  const series = context.series.find((s) => s.id === parsed.seriesId);
  if (!series) return null;
  if (series.repeatType === "none") {
    return parsed.occurrenceYear === null ? { id: occurrenceId, date: series.date, title: series.title } : null;
  }
  if (parsed.occurrenceYear === null || parsed.occurrenceYear < getLocalDateYear(series.date)) return null;
  const exception = indexExceptions(context.exceptions).get(exceptionKey(series.id, parsed.occurrenceYear));
  if (exception?.kind === "cancelled") return null;
  return {
    id: occurrenceId,
    date: exception?.overrideDate ?? getYearlyOccurrenceDate(series.date, parsed.occurrenceYear),
    title: exception?.overrideTitle ?? series.title,
  };
}
