/**
 * 자동 기념일 생성 (ANN-001~007, SKILL.md §10, ARCHITECTURE.md §7).
 *
 * - 일수: 10, 30, 50일, 이후 100일 단위(100, 200, …). N일 = addDays(startDate, N - dayOffset).
 * - 주년: N주년 = addYears(원래 시작일, N). 2월 29일 시작은 평년 2월 28일. 직전 주년에 누적 가산하지 않는다.
 * - 주년은 dayOffset의 영향을 받지 않는다.
 */
import type { DayOffset, LocalDate } from "@/domain/entities";
import {
  addDaysToLocalDate,
  addYearsToLocalDate,
  assertLocalDate,
  diffCalendarDays,
  getLocalDateYear,
} from "@/domain/date/local-date";
import { autoDayOccurrenceId, autoYearOccurrenceId } from "./occurrence-id";
import type { AutoDayOccurrence, AutoOccurrence, AutoYearOccurrence, LocalDateRange } from "./types";

export const AUTO_DAY_MILESTONES_BEFORE_100 = [10, 30, 50] as const;
export const AUTO_DAY_MILESTONE_STEP = 100;

export function getDayMilestoneDate(startDate: LocalDate, days: number, dayOffset: DayOffset): LocalDate {
  return addDaysToLocalDate(startDate, days - dayOffset);
}

export function getYearMilestoneDate(startDate: LocalDate, years: number): LocalDate {
  return addYearsToLocalDate(startDate, years);
}

function dayOccurrence(startDate: LocalDate, days: number, dayOffset: DayOffset): AutoDayOccurrence {
  return {
    kind: "auto-day",
    id: autoDayOccurrenceId(days),
    date: getDayMilestoneDate(startDate, days, dayOffset),
    title: `${days}일`,
    days,
  };
}

function yearOccurrence(startDate: LocalDate, years: number): AutoYearOccurrence {
  return {
    kind: "auto-year",
    id: autoYearOccurrenceId(years),
    date: getYearMilestoneDate(startDate, years),
    title: `${years}주년`,
    years,
  };
}

/** 구간 [from, to)에 속하는 자동 일수 기념일. */
export function generateAutoDayAnniversaries(
  startDate: LocalDate,
  dayOffset: DayOffset,
  range: LocalDateRange,
): AutoDayOccurrence[] {
  // N일의 경과 일수는 N - dayOffset. 구간을 경과 일수 [eFrom, eTo)로 변환한다.
  const eFrom = Math.max(diffCalendarDays(range.from, startDate), 0);
  const eTo = diffCalendarDays(range.to, startDate);
  const result: AutoDayOccurrence[] = [];
  if (eTo <= eFrom) return result;
  const inRange = (days: number) => days - dayOffset >= eFrom && days - dayOffset < eTo;

  for (const days of AUTO_DAY_MILESTONES_BEFORE_100) {
    if (inRange(days)) result.push(dayOccurrence(startDate, days, dayOffset));
  }
  let k = Math.max(1, Math.ceil((eFrom + dayOffset) / AUTO_DAY_MILESTONE_STEP));
  for (; k * AUTO_DAY_MILESTONE_STEP - dayOffset < eTo; k++) {
    result.push(dayOccurrence(startDate, k * AUTO_DAY_MILESTONE_STEP, dayOffset));
  }
  return result;
}

/** 구간 [from, to)에 속하는 자동 주년. */
export function generateAutoYearAnniversaries(startDate: LocalDate, range: LocalDateRange): AutoYearOccurrence[] {
  assertLocalDate(range.from);
  assertLocalDate(range.to);
  const result: AutoYearOccurrence[] = [];
  const startYear = getLocalDateYear(startDate);
  let years = Math.max(1, getLocalDateYear(range.from) - startYear - 1);
  for (; ; years++) {
    const occurrence = yearOccurrence(startDate, years);
    if (occurrence.date >= range.to) break;
    if (occurrence.date >= range.from) result.push(occurrence);
  }
  return result;
}

/** 구간 [from, to)의 자동 기념일 전체(일수 + 주년). 정렬은 mergeAnniversaries에서 수행한다. */
export function generateAutoAnniversaries(
  startDate: LocalDate,
  dayOffset: DayOffset,
  range: LocalDateRange,
): AutoOccurrence[] {
  return [...generateAutoDayAnniversaries(startDate, dayOffset, range), ...generateAutoYearAnniversaries(startDate, range)];
}
