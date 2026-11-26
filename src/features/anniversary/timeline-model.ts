/**
 * 기념일 타임라인 표시 모델 (SKILL.md §9, TML-001~016, ARC-C01~C03).
 * 순수 함수로 구성하여 단위 테스트한다.
 */
import type { AnniversaryException, CustomAnniversary, DayOffset, LocalDate } from "@/domain/entities";
import { generateCustomOccurrences } from "@/domain/anniversary/exceptions";
import { generateAutoAnniversaries } from "@/domain/anniversary/generator";
import { getTimelineHighlight, type TimelineHighlight } from "@/domain/anniversary/progress";
import { filterAnniversaries, getTargetSearchEnd, mergeAnniversaries, type TimelineFilter } from "@/domain/anniversary/timeline";
import type { AnniversaryOccurrence } from "@/domain/anniversary/types";
import { calculateDday, formatDdayLabel } from "@/domain/date/dday";
import { maxLocalDate } from "@/domain/date/local-date";

export type TimelineEntry =
  | {
      type: "item";
      occurrence: AnniversaryOccurrence;
      status: "past" | "upcoming";
      ddayLabel: string | null;
      highlighted: boolean;
    }
  | { type: "today"; dayCount: number };

export interface TimelineInput {
  startDate: LocalDate;
  dayOffset: DayOffset;
  today: LocalDate;
  /** 미래 자동·반복 기념일 표시 상한(미포함). 최초 today + 1년, 이후 1년씩 확장 */
  futureEnd: LocalDate;
  filter: TimelineFilter;
  series: readonly CustomAnniversary[];
  exceptions: readonly AnniversaryException[];
}

export interface TimelineModel {
  entries: TimelineEntry[];
  highlight: TimelineHighlight | null;
}

export function buildTimeline(input: TimelineInput): TimelineModel {
  const { startDate, dayOffset, today, futureEnd, filter } = input;
  // 다음 목표(강조 카드)는 표시 범위와 무관하게 찾을 수 있도록 생성 범위를 확보한다(§7.2).
  const until = maxLocalDate(futureEnd, getTargetSearchEnd(today));
  const autos = generateAutoAnniversaries(startDate, dayOffset, { from: startDate, to: until });
  const customs = generateCustomOccurrences(input.series, input.exceptions, until);
  const all = mergeAnniversaries(autos, customs);
  const highlight = getTimelineHighlight(all, startDate, today);
  const highlighted = new Set(highlight?.occurrenceIds ?? []);

  // 미래는 표시 범위까지만. 일회성 사용자 지정 기념일은 범위와 무관하게 표시(TML-014 예외 규칙).
  const visible = all.filter((o) => o.date < futureEnd || (o.kind === "custom" && o.repeatType === "none"));
  const filtered = filterAnniversaries(visible, filter, today);

  const entries: TimelineEntry[] = [];
  const dday = calculateDday(startDate, today, dayOffset);
  let todayInserted = filter !== "all" || dday.status !== "ok";
  for (const occurrence of filtered) {
    const status = occurrence.date < today ? "past" : "upcoming";
    if (!todayInserted && status === "upcoming") {
      if (dday.status === "ok") entries.push({ type: "today", dayCount: dday.dday });
      todayInserted = true;
    }
    entries.push({
      type: "item",
      occurrence,
      status,
      ddayLabel: status === "upcoming" ? formatDdayLabel(occurrence.date, today) : null,
      highlighted: highlighted.has(occurrence.id),
    });
  }
  if (!todayInserted && dday.status === "ok") entries.push({ type: "today", dayCount: dday.dday });
  return { entries, highlight };
}
