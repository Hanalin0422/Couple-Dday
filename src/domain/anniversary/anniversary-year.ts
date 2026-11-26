/**
 * 자동 주년 당일 판별 (HOME-014, HOME-017, SKILL.md §10.1, ARCHITECTURE.md §7.3).
 * - 누적 일수가 아닌 실제 달력 날짜로 판단한다. dayOffset은 사용하지 않는다.
 * - 2월 29일 시작은 평년 2월 28일, 윤년 2월 29일이 주년이다.
 * - 사용자 지정 기념일 및 자동 일수 기념일은 판별에 영향을 주지 않는다.
 */
import type { LocalDate } from "@/domain/entities";
import { getLocalDateYear } from "@/domain/date/local-date";
import { getYearMilestoneDate } from "./generator";

/** 오늘이 자동 주년이면 주년 횟수, 아니면 null. */
export function getAnniversaryYear(startDate: LocalDate, today: LocalDate): number | null {
  const years = getLocalDateYear(today) - getLocalDateYear(startDate);
  if (years < 1) return null;
  return getYearMilestoneDate(startDate, years) === today ? years : null;
}
