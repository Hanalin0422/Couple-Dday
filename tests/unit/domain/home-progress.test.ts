import { describe, expect, it } from "vitest";
import { getAnniversaryYear } from "@/domain/anniversary/anniversary-year";
import { getHomeDdayDisplay } from "@/domain/anniversary/home-display";
import { calculateHomeProgress, calculateProgress } from "@/domain/anniversary/progress";

const START = "2026-07-01";
const pct = (today: string, offset: 0 | 1 = 1, start = START) => calculateHomeProgress(start, offset, today)?.percentage;

describe("메인 원형 진행률 (TC-HOME-001~008)", () => {
  it("시작 당일 0% (HOME-E01)", () => {
    expect(calculateHomeProgress(START, 1, START)).toEqual({
      previousDate: START,
      targetDate: "2026-07-10",
      percentage: 0,
      isAnniversaryToday: false,
    });
  });

  it("첫 기념일 이전은 시작일 기준 (2026-07-05 → 4/9)", () => {
    expect(pct("2026-07-05")).toBeCloseTo(44.444, 2);
  });

  it("100일 당일 100%, 다음 날 1% (HOME-E02, HOME-E03)", () => {
    expect(calculateHomeProgress(START, 1, "2026-10-08")).toMatchObject({ percentage: 100, isAnniversaryToday: true, targetDate: "2026-10-08" });
    expect(calculateHomeProgress(START, 1, "2026-10-09")).toMatchObject({
      previousDate: "2026-10-08",
      targetDate: "2027-01-16",
      percentage: 1,
      isAnniversaryToday: false,
    });
  });

  it("148일 48% (HOME-E04)", () => {
    expect(calculateHomeProgress(START, 1, "2026-11-25")).toMatchObject({
      previousDate: "2026-10-08",
      targetDate: "2027-01-16",
      percentage: 48,
    });
  });

  it("0일 방식은 목표 날짜가 재계산된다 (HOME-E07)", () => {
    expect(calculateHomeProgress(START, 0, "2026-11-25")).toMatchObject({
      previousDate: "2026-10-09",
      targetDate: "2027-01-17",
      percentage: 47,
    });
  });

  it("199일 / 200일 / 201일 → 99% / 100% / 1% (HOME-E05)", () => {
    expect(pct("2027-01-15")).toBe(99);
    expect(pct("2027-01-16")).toBe(100);
    expect(pct("2027-01-17")).toBeCloseTo(1, 5);
  });

  it("1주년 당일 100% (HOME-020) 및 다음 날 다음 구간", () => {
    expect(calculateHomeProgress(START, 1, "2027-07-01")).toMatchObject({ percentage: 100, isAnniversaryToday: true });
    expect(calculateHomeProgress(START, 1, "2027-07-02")).toMatchObject({
      previousDate: "2027-07-01",
      targetDate: "2027-08-04",
    });
    expect(calculateHomeProgress(START, 1, "2028-07-01")).toMatchObject({ percentage: 100, isAnniversaryToday: true });
  });

  it("주년과 N일이 겹치는 날 목표를 하나로 처리한다 (HOME-E06)", () => {
    // 0일 방식 2000-03-01 시작: 2023-03-01 = 23주년 = 8400일
    expect(calculateHomeProgress("2000-03-01", 0, "2023-03-01")).toMatchObject({ percentage: 100, isAnniversaryToday: true });
    const next = calculateHomeProgress("2000-03-01", 0, "2023-03-02")!;
    expect(next.previousDate).toBe("2023-03-01");
    expect(next.percentage).toBeGreaterThan(0);
    expect(Number.isFinite(next.percentage)).toBe(true);
  });

  it("기기 날짜가 시작일 이전이면 null (HOME-E08)", () => {
    expect(calculateHomeProgress(START, 1, "2026-06-30")).toBeNull();
  });

  it("calculateProgress: 중복 날짜 제거, 0~100 제한, 목표 없음 null", () => {
    expect(calculateProgress(["2026-07-10", "2026-07-10"], START, "2026-07-10")?.percentage).toBe(100);
    expect(calculateProgress(["2026-07-10"], START, "2026-07-11")).toBeNull();
    expect(calculateProgress([], START, START)).toBeNull();
  });
});

describe("자동 주년 판별 (HOME-017, TC-HOME-015)", () => {
  it.each([
    ["2027-06-30", null],
    ["2027-07-01", 1],
    ["2027-07-02", null],
    ["2028-07-01", 2],
    ["2036-07-01", 10],
    ["2026-07-01", null],
    ["2026-06-30", null],
  ])("%s → %s", (today, expected) => {
    expect(getAnniversaryYear(START, today)).toBe(expected);
  });

  it("2월 29일 시작: 평년 2월 28일, 윤년 2월 29일", () => {
    expect(getAnniversaryYear("2024-02-29", "2025-02-28")).toBe(1);
    expect(getAnniversaryYear("2024-02-29", "2025-03-01")).toBeNull();
    expect(getAnniversaryYear("2024-02-29", "2028-02-29")).toBe(4);
    expect(getAnniversaryYear("2024-02-29", "2028-02-28")).toBeNull();
  });
});

describe("메인 디데이 표시 모델 (TC-HOME-009~014)", () => {
  it("주년 당일: N주년 + HAPPY ANNIVERSARY, 내부 디데이 숫자 유지 (HOME-014, HOME-015)", () => {
    expect(getHomeDdayDisplay(START, 1, "2027-07-01")).toEqual({
      type: "anniversary",
      value: 366,
      anniversaryYear: 1,
      label: "1주년",
      subtitle: "HAPPY ANNIVERSARY",
    });
  });

  it("주년 전날/다음 날: 일반 디데이 (HOME-E10, HOME-E12, HOME-021)", () => {
    expect(getHomeDdayDisplay(START, 1, "2027-06-30")).toEqual({ type: "days", value: 365, label: "365", subtitle: "DAYS" });
    expect(getHomeDdayDisplay(START, 1, "2027-07-02")).toEqual({ type: "days", value: 367, label: "367", subtitle: "DAYS" });
  });

  it("주년 당일 0일/1일 변경: 주년 유지, 내부 값만 변경 (HOME-E13)", () => {
    expect(getHomeDdayDisplay(START, 0, "2027-07-01")).toMatchObject({ type: "anniversary", anniversaryYear: 1, value: 365 });
    expect(getHomeDdayDisplay(START, 1, "2027-07-01")).toMatchObject({ type: "anniversary", anniversaryYear: 1, value: 366 });
  });

  it("주년과 8400일이 겹치면 주년 우선 (HOME-018)", () => {
    expect(getHomeDdayDisplay("2000-03-01", 0, "2023-03-01")).toMatchObject({ type: "anniversary", label: "23주년", value: 8400 });
  });

  it("100일(자동 일수 기념일) 당일은 일반 디자인 (HOME-028 전제)", () => {
    expect(getHomeDdayDisplay(START, 1, "2026-10-08")).toMatchObject({ type: "days", value: 100 });
  });

  it("10주년 이상 라벨 (HOME-E16 전제)", () => {
    expect(getHomeDdayDisplay(START, 1, "2036-07-01")).toMatchObject({ type: "anniversary", label: "10주년" });
  });

  it("기기 날짜가 시작일 이전이면 null (DATE-E05, HOME-E28)", () => {
    expect(getHomeDdayDisplay(START, 1, "2026-06-30")).toBeNull();
  });

  it("FX-TODAY 일반 표시 148", () => {
    expect(getHomeDdayDisplay(START, 1, "2026-11-25")).toEqual({ type: "days", value: 148, label: "148", subtitle: "DAYS" });
  });
});

describe("축하 효과 대상 날짜 (HOME-022, HOME-028, HOME-033)", () => {
  it("100일 단위 자동 기념일 당일은 대상, 표시 형식은 일반 디데이 유지", async () => {
    const { getCelebrationOccasion } = await import("@/domain/anniversary/celebration");
    expect(getCelebrationOccasion(START, 1, "2026-10-08")).toEqual({ kind: "hundred-days", days: 100 });
    expect(getCelebrationOccasion(START, 1, "2027-01-16")).toEqual({ kind: "hundred-days", days: 200 });
    expect(getCelebrationOccasion(START, 0, "2026-10-09")).toEqual({ kind: "hundred-days", days: 100 });
    expect(getHomeDdayDisplay(START, 1, "2026-10-08")).toMatchObject({ type: "days", value: 100 });
  });

  it("주년 당일은 주년으로 판정, 주년과 100일 단위가 겹치면 주년 우선", async () => {
    const { getCelebrationOccasion } = await import("@/domain/anniversary/celebration");
    expect(getCelebrationOccasion(START, 1, "2027-07-01")).toEqual({ kind: "anniversary", years: 1 });
    expect(getCelebrationOccasion("2000-03-01", 0, "2023-03-01")).toEqual({ kind: "anniversary", years: 23 });
  });

  it("10·30·50일, 일반 날짜, 100일 전날·다음 날, 시작일 이전은 대상 아님", async () => {
    const { getCelebrationOccasion } = await import("@/domain/anniversary/celebration");
    for (const today of ["2026-07-10", "2026-07-30", "2026-08-19", "2026-11-25", "2026-10-07", "2026-10-09", "2026-07-01"]) {
      expect(getCelebrationOccasion(START, 1, today), today).toBeNull();
    }
    expect(getCelebrationOccasion(START, 1, "2026-06-30")).toBeNull();
    expect(getCelebrationOccasion(START, 0, "2026-10-08")).toBeNull(); // 0일 방식에서는 99일
  });
});
