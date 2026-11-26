/**
 * 축하 효과(금빛 꽃가루) 재생 대상 날짜 판정 (HOME-022, HOME-028, HOME-033).
 *
 * - 자동 주년 당일 (달력 기준, 시작일 계산 방식 무관)
 * - 100일 단위 자동 일수 기념일 당일(100, 200, 300일 …) — 2026-11-26 사용자 승인.
 *   이 날은 메인 표시 형식은 일반 디데이(숫자·DAYS)를 유지하고 꽃가루 효과만 적용한다.
 * - 10·30·50일 자동 기념일, 사용자 지정 기념일, 일반 날짜는 대상이 아니다.
 * - 주년과 100일 단위가 겹치면 주년으로 판정한다(HOME-018).
 * - 기기 날짜가 시작일보다 이전이면 대상이 아니다(DATE-E05, HOME-E28).
 */
import type { DayOffset, LocalDate } from "@/domain/entities";
import { calculateDday } from "@/domain/date/dday";
import { AUTO_DAY_MILESTONE_STEP } from "./generator";
import { getAnniversaryYear } from "./anniversary-year";

export type CelebrationOccasion = { kind: "anniversary"; years: number } | { kind: "hundred-days"; days: number };

export function getCelebrationOccasion(startDate: LocalDate, dayOffset: DayOffset, today: LocalDate): CelebrationOccasion | null {
  const dday = calculateDday(startDate, today, dayOffset);
  if (dday.status !== "ok") return null;
  const years = getAnniversaryYear(startDate, today);
  if (years !== null) return { kind: "anniversary", years };
  if (dday.dday >= AUTO_DAY_MILESTONE_STEP && dday.dday % AUTO_DAY_MILESTONE_STEP === 0) return { kind: "hundred-days", days: dday.dday };
  return null;
}
