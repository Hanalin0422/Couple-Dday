/**
 * 기념일 화면 일시적 UI 상태 (ARCHITECTURE.md §8 useTimelineStore). 영속화하지 않는다.
 * - 필터: 최초 진입 기본 '전체' (TML-004)
 * - 미래 표시 범위: [오늘, 오늘+1년)부터 1년씩 확장 (TML-014, ARC-C03)
 */
import { create } from "zustand";
import type { LocalDate } from "@/domain/entities";
import type { TimelineFilter } from "@/domain/anniversary/timeline";
import { addYearsToLocalDate } from "@/domain/date/local-date";

interface TimelineState {
  filter: TimelineFilter;
  /** 확장된 연수(0 = 최초 1년) */
  extraYears: number;
  setFilter: (filter: TimelineFilter) => void;
  extend: () => void;
  reset: () => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  filter: "all",
  extraYears: 0,
  setFilter: (filter) => set({ filter }),
  // 무한 확장 방지 상한(100년)
  extend: () => set((s) => (s.extraYears >= 100 ? s : { extraYears: s.extraYears + 1 })),
  reset: () => set({ filter: "all", extraYears: 0 }),
}));

export function futureEndFor(today: LocalDate, extraYears: number): LocalDate {
  return addYearsToLocalDate(today, 1 + extraYears);
}
