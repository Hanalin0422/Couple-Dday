/**
 * 메인 디데이 표시 모델 (ARCHITECTURE.md §7.3, HOME-014~021).
 * 내부 디데이 계산값(value)과 화면 표시 형식을 분리한다. 주년 여부는 영속화하지 않고 매번 계산한다.
 */
import type { DayOffset, LocalDate } from "@/domain/entities";
import { calculateDday } from "@/domain/date/dday";
import { getAnniversaryYear } from "./anniversary-year";

export type HomeDdayDisplay =
  | {
      type: "days";
      value: number;
      label: string;
      subtitle: "DAYS";
    }
  | {
      type: "anniversary";
      value: number;
      anniversaryYear: number;
      label: string;
      subtitle: "HAPPY ANNIVERSARY";
    };

/**
 * @returns 기기 날짜가 시작일보다 이전이면 null (DATE-E05 우선 적용, 주년 효과 실행 금지 HOME-E28)
 */
export function getHomeDdayDisplay(startDate: LocalDate, dayOffset: DayOffset, today: LocalDate): HomeDdayDisplay | null {
  const dday = calculateDday(startDate, today, dayOffset);
  if (dday.status !== "ok") return null;
  const anniversaryYear = getAnniversaryYear(startDate, today);
  if (anniversaryYear !== null) {
    return {
      type: "anniversary",
      value: dday.dday,
      anniversaryYear,
      label: `${anniversaryYear}주년`,
      subtitle: "HAPPY ANNIVERSARY",
    };
  }
  return { type: "days", value: dday.dday, label: String(dday.dday), subtitle: "DAYS" };
}
