/**
 * 기념일 병합·정렬·필터 및 타임라인 표시 범위 (ANN-004, TML-001~006, TML-014, ARC-C03).
 */
import type { LocalDate } from "@/domain/entities";
import { addDaysToLocalDate, addYearsToLocalDate, compareLocalDate } from "@/domain/date/local-date";
import type { AnniversaryOccurrence, LocalDateRange } from "./types";

/**
 * 동일 날짜 정렬 우선순위(구현 제안, ARCHITECTURE.md §17 "동률 정렬" 확인 전 기본값):
 * 자동 주년 → 자동 일수 → 사용자 지정(생성 일시, ID 순).
 * 메인 화면에서 주년을 우선하는 정책(HOME-018)과 같은 방향이며 결정적이다.
 */
const KIND_RANK: Record<AnniversaryOccurrence["kind"], number> = { "auto-year": 0, "auto-day": 1, custom: 2 };

export function compareOccurrences(a: AnniversaryOccurrence, b: AnniversaryOccurrence): number {
  const byDate = compareLocalDate(a.date, b.date);
  if (byDate !== 0) return byDate;
  const byKind = KIND_RANK[a.kind] - KIND_RANK[b.kind];
  if (byKind !== 0) return byKind;
  if (a.kind === "custom" && b.kind === "custom" && a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** 자동/사용자 지정 발생 건을 실제 날짜순으로 병합한다. 동일 날짜 기념일은 각각 유지한다(ANN-004). */
export function mergeAnniversaries(...groups: readonly (readonly AnniversaryOccurrence[])[]): AnniversaryOccurrence[] {
  const seen = new Set<string>();
  const merged: AnniversaryOccurrence[] = [];
  for (const group of groups) {
    for (const occurrence of group) {
      if (seen.has(occurrence.id)) continue; // 범위 확장 시 중복 카드 방지
      seen.add(occurrence.id);
      merged.push(occurrence);
    }
  }
  return merged.sort(compareOccurrences);
}

export type TimelineFilter = "past" | "all" | "upcoming";

/** 지난 날: date < today, 다가오는 날: date >= today(당일 포함), 전체: 모두 (TML-005, TML-006). */
export function filterAnniversaries<T extends { date: LocalDate }>(
  items: readonly T[],
  filter: TimelineFilter,
  today: LocalDate,
): T[] {
  if (filter === "past") return items.filter((item) => item.date < today);
  if (filter === "upcoming") return items.filter((item) => item.date >= today);
  return [...items];
}

/** 최초 미래 표시 구간 [today, today + 1년) (TML-014, ARC-C03). */
export function getInitialFutureRange(today: LocalDate): LocalDateRange {
  return { from: today, to: addYearsToLocalDate(today, 1) };
}

/** 미래 표시 구간을 1년 연장한다. 새 구간은 기존 to에서 시작하여 경계 중복이 없다. */
export function getNextFutureRange(current: LocalDateRange): LocalDateRange {
  return { from: current.to, to: addYearsToLocalDate(current.to, 1) };
}

/**
 * 다음 목표 계산용 생성 상한. 다음 100일 단위 기념일은 100일 이내, 다음 주년은 1년 이내이므로
 * today + 1년 + 1일까지 생성하면 표시 범위와 무관하게 다음 목표를 찾을 수 있다.
 */
export function getTargetSearchEnd(today: LocalDate): LocalDate {
  return addDaysToLocalDate(addYearsToLocalDate(today, 1), 1);
}
