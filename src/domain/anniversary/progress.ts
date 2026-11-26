/**
 * 진행률 계산 (REQUIREMENTS.md §5 원형 진행률, ARCHITECTURE.md §7.1, ARC-C01, ARC-C02).
 *
 * - 목표: 오늘 이상인 가장 가까운 날짜. 기념일 당일은 100%를 유지하고 다음 날부터 다음 구간으로 전환한다.
 * - 이전 목표: 목표보다 엄격히 이전인 가장 가까운 날짜. 없으면 시작일.
 * - 진행률 = 100 × diff(today, previous) / diff(target, previous), 0~100으로 제한.
 * - 동일 날짜는 한 번만 사용하여 분모 0을 방지한다.
 * - 메인 원형은 자동 기념일만, 타임라인 강조 카드는 자동 + 사용자 지정(취소 제외)으로 분리 계산한다.
 */
import type { DayOffset, LocalDate } from "@/domain/entities";
import { diffCalendarDays } from "@/domain/date/local-date";
import { generateAutoAnniversaries } from "./generator";
import { getTargetSearchEnd } from "./timeline";
import type { AnniversaryOccurrence } from "./types";

export interface ProgressResult {
  previousDate: LocalDate;
  targetDate: LocalDate;
  /** 0~100 사이의 실수. 표시 반올림은 UI에서 처리한다. */
  percentage: number;
  isAnniversaryToday: boolean;
}

/**
 * 목표 날짜 집합으로 진행률을 계산한다.
 * 시작일 이전 날짜는 이전 기준으로 사용하지 않는다(시작일 변경으로 시작일 이전에 보존된 사용자 지정 기념일, ARC-A01 구현 제안).
 * @returns 오늘이 시작일 이전이거나 목표가 없으면 null (DATE-E05: 음수 진행률 금지)
 */
export function calculateProgress(
  targetDates: readonly LocalDate[],
  startDate: LocalDate,
  today: LocalDate,
): ProgressResult | null {
  if (today < startDate) return null;
  const dates = [...new Set(targetDates)].filter((date) => date >= startDate).sort();
  const targetDate = dates.find((date) => date >= today);
  if (targetDate === undefined) return null;
  const previousDate = dates.findLast((date) => date < targetDate) ?? startDate;
  if (targetDate === today) return { previousDate, targetDate, percentage: 100, isAnniversaryToday: true };
  const total = diffCalendarDays(targetDate, previousDate);
  const done = diffCalendarDays(today, previousDate);
  const percentage = total <= 0 ? 100 : Math.min(100, Math.max(0, (100 * done) / total));
  return { previousDate, targetDate, percentage, isAnniversaryToday: false };
}

/** 메인 원형 진행률: 자동 기념일만 포함 (HOME-004, HOME-005, CUS-010). */
export function calculateHomeProgress(startDate: LocalDate, dayOffset: DayOffset, today: LocalDate): ProgressResult | null {
  if (today < startDate) return null;
  const autos = generateAutoAnniversaries(startDate, dayOffset, { from: startDate, to: getTargetSearchEnd(today) });
  return calculateProgress(
    autos.map((occurrence) => occurrence.date),
    startDate,
    today,
  );
}

export interface TimelineHighlight {
  progress: ProgressResult;
  /** 가장 가까운 날짜에 겹치는 모든 기념일 ID (ARC-C02). */
  occurrenceIds: string[];
}

/**
 * 타임라인 강조 카드: 자동 + 사용자 지정 발생 건 전체에서 가장 가까운 예정 날짜와 별도 진행률 (ARC-C01).
 * occurrences는 다음 목표를 찾을 수 있을 만큼(getTargetSearchEnd 이상) 생성된 목록이어야 한다.
 */
export function getTimelineHighlight(
  occurrences: readonly AnniversaryOccurrence[],
  startDate: LocalDate,
  today: LocalDate,
): TimelineHighlight | null {
  const progress = calculateProgress(
    occurrences.map((occurrence) => occurrence.date),
    startDate,
    today,
  );
  if (!progress) return null;
  return {
    progress,
    occurrenceIds: occurrences.filter((occurrence) => occurrence.date === progress.targetDate).map((o) => o.id),
  };
}
