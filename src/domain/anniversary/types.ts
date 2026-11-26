/**
 * 계산된 기념일 발생 건. 자동 기념일과 반복 발생 건은 영속화하지 않고 계산한다(ARCHITECTURE.md §5).
 */
import type { Instant, LocalDate, RepeatType } from "@/domain/entities";

export interface AutoDayOccurrence {
  kind: "auto-day";
  id: string;
  date: LocalDate;
  title: string;
  days: number;
}

export interface AutoYearOccurrence {
  kind: "auto-year";
  id: string;
  date: LocalDate;
  title: string;
  years: number;
}

export interface CustomOccurrence {
  kind: "custom";
  id: string;
  date: LocalDate;
  title: string;
  seriesId: string;
  repeatType: RepeatType;
  /** 매년 반복의 원래 발생 연도. 일회성은 null. 예외로 날짜가 이동해도 바뀌지 않는다. */
  occurrenceYear: number | null;
  isOverridden: boolean;
  createdAt: Instant;
}

export type AutoOccurrence = AutoDayOccurrence | AutoYearOccurrence;
export type AnniversaryOccurrence = AutoOccurrence | CustomOccurrence;

/** 반열린 구간 [from, to). */
export interface LocalDateRange {
  from: LocalDate;
  to: LocalDate;
}
