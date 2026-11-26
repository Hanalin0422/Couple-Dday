import { describe, expect, it } from "vitest";
import type { AnniversaryException, CustomAnniversary } from "@/domain/entities";
import { generateCustomOccurrences } from "@/domain/anniversary/exceptions";
import { generateAutoAnniversaries } from "@/domain/anniversary/generator";
import { calculateHomeProgress, getTimelineHighlight } from "@/domain/anniversary/progress";
import {
  filterAnniversaries,
  getInitialFutureRange,
  getNextFutureRange,
  getTargetSearchEnd,
  mergeAnniversaries,
} from "@/domain/anniversary/timeline";

const START = "2026-07-01";
const TODAY = "2026-11-25";
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

function anniversary(id: string, title: string, date: string, repeatType: "none" | "yearly", createdAt = "2026-11-01T00:00:00Z"): CustomAnniversary {
  return { id, title, date, repeatType, createdAt, updatedAt: createdAt };
}

function exception(seriesId: string, occurrenceYear: number, extra: Partial<AnniversaryException>): AnniversaryException {
  return { seriesId, occurrenceYear, kind: "override", createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", ...extra };
}

describe("사용자 지정 발생 건 (TC-CUS-005~007)", () => {
  it("매년 반복은 등록 연도부터 생성하며 소급하지 않는다 (ARC-A05)", () => {
    const list = generateCustomOccurrences([anniversary(UUID_A, "첫 여행", "2026-08-15", "yearly")], [], "2029-01-01");
    expect(list.map((o) => [o.id, o.date, o.occurrenceYear])).toEqual([
      [`custom:${UUID_A}:2026`, "2026-08-15", 2026],
      [`custom:${UUID_A}:2027`, "2027-08-15", 2027],
      [`custom:${UUID_A}:2028`, "2028-08-15", 2028],
    ]);
  });

  it("반복 2월 29일: 평년 2월 28일, 윤년 2월 29일, 원본 월/일 기준 (ARC-A04)", () => {
    const list = generateCustomOccurrences([anniversary(UUID_A, "윤일", "2024-02-29", "yearly")], [], "2029-01-01");
    expect(list.map((o) => o.date)).toEqual(["2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]);
  });

  it("일회성은 until과 무관하게 항상 포함 (TC-TML-004)", () => {
    const list = generateCustomOccurrences([anniversary(UUID_B, "5년 뒤", "2031-11-25", "none")], [], "2027-11-25");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: `custom:${UUID_B}`, occurrenceYear: null, repeatType: "none" });
  });

  it("같은 이름·날짜도 독립 발생 건 (CUS-009)", () => {
    const list = generateCustomOccurrences(
      [anniversary(UUID_A, "기념", "2026-12-01", "none"), anniversary(UUID_B, "기념", "2026-12-01", "none")],
      [],
      "2027-12-01",
    );
    expect(new Set(list.map((o) => o.id)).size).toBe(2);
  });
});

describe("반복 예외 (TC-CUS-011, TC-CUS-013 계산 부분)", () => {
  const series = anniversary(UUID_A, "첫 여행", "2026-08-15", "yearly");

  it("해당 연도 override는 지정 필드만 덮어쓰고 발생 ID를 유지한다", () => {
    const list = generateCustomOccurrences([series], [exception(UUID_A, 2027, { overrideTitle: "제주 여행" })], "2029-01-01");
    expect(list.find((o) => o.occurrenceYear === 2027)).toMatchObject({
      id: `custom:${UUID_A}:2027`,
      title: "제주 여행",
      date: "2027-08-15",
      isOverridden: true,
    });
    expect(list.find((o) => o.occurrenceYear === 2028)).toMatchObject({ title: "첫 여행", isOverridden: false });
  });

  it("override 날짜 이동 시 실제 날짜로 정렬·필터하고 ID는 원래 연도", () => {
    const list = generateCustomOccurrences([series], [exception(UUID_A, 2027, { overrideDate: "2027-09-01" })], "2029-01-01");
    expect(list.find((o) => o.occurrenceYear === 2027)).toMatchObject({ id: `custom:${UUID_A}:2027`, date: "2027-09-01" });
  });

  it("상한 밖 연도의 override가 상한 이전으로 이동하면 포함한다", () => {
    const list = generateCustomOccurrences([series], [exception(UUID_A, 2031, { overrideDate: "2027-12-01" })], "2028-01-01");
    expect(list.map((o) => o.id)).toContain(`custom:${UUID_A}:2031`);
  });

  it("cancelled 발생 건은 생성하지 않는다 (tombstone)", () => {
    const list = generateCustomOccurrences([series], [exception(UUID_A, 2027, { kind: "cancelled" })], "2029-01-01");
    expect(list.map((o) => o.occurrenceYear)).toEqual([2026, 2028]);
  });

  it("다른 시리즈의 예외는 적용하지 않는다", () => {
    const list = generateCustomOccurrences([series], [exception(UUID_B, 2027, { kind: "cancelled" })], "2029-01-01");
    expect(list.map((o) => o.occurrenceYear)).toEqual([2026, 2027, 2028]);
  });
});

describe("병합·정렬·필터 (TC-TML-001, TC-TML-002)", () => {
  const customs = generateCustomOccurrences(
    [
      anniversary(UUID_B, "나중 생성", "2027-01-16", "none", "2026-11-02T00:00:00Z"),
      anniversary(UUID_A, "먼저 생성", "2027-01-16", "none", "2026-11-01T00:00:00Z"),
      anniversary(UUID_C, "오늘", TODAY, "none"),
    ],
    [],
    "2027-11-25",
  );
  const autos = generateAutoAnniversaries(START, 1, { from: START, to: "2027-11-25" });
  const merged = mergeAnniversaries(autos, customs);

  it("과거→미래 오름차순, 동률은 자동 → 사용자 지정(생성 일시) 순으로 결정적", () => {
    const dates = merged.map((o) => o.date);
    expect(dates).toEqual([...dates].sort());
    const sameDay = merged.filter((o) => o.date === "2027-01-16").map((o) => o.title);
    expect(sameDay).toEqual(["200일", "먼저 생성", "나중 생성"]);
    expect(mergeAnniversaries([...customs].reverse(), [...autos].reverse())).toEqual(merged);
  });

  it("범위 확장으로 같은 ID가 다시 들어와도 중복 카드가 생기지 않는다", () => {
    expect(mergeAnniversaries(autos, autos, customs)).toHaveLength(merged.length);
  });

  it("지난 날 date < 오늘, 다가오는 날 date >= 오늘(당일 포함), 전체", () => {
    const past = filterAnniversaries(merged, "past", TODAY);
    const upcoming = filterAnniversaries(merged, "upcoming", TODAY);
    expect(past.every((o) => o.date < TODAY)).toBe(true);
    expect(upcoming.every((o) => o.date >= TODAY)).toBe(true);
    expect(upcoming.map((o) => o.title)).toContain("오늘");
    expect(past.length + upcoming.length).toBe(merged.length);
    expect(filterAnniversaries(merged, "all", TODAY)).toEqual(merged);
    expect(filterAnniversaries([], "past", TODAY)).toEqual([]);
  });
});

describe("미래 표시 구간 (TC-TML-003, ARC-C03)", () => {
  it("[오늘, 1년 뒤)에서 1년씩 경계 중복 없이 확장", () => {
    const first = getInitialFutureRange(TODAY);
    const second = getNextFutureRange(first);
    expect(first).toEqual({ from: "2026-11-25", to: "2027-11-25" });
    expect(second).toEqual({ from: "2027-11-25", to: "2028-11-25" });
    const a = generateAutoAnniversaries(START, 1, first).map((o) => o.id);
    const b = generateAutoAnniversaries(START, 1, second).map((o) => o.id);
    expect(a.filter((id) => b.includes(id))).toEqual([]);
  });

  it("2월 29일 오늘에서도 범위가 계산된다", () => {
    expect(getInitialFutureRange("2028-02-29")).toEqual({ from: "2028-02-29", to: "2029-02-28" });
  });
});

describe("타임라인 강조 카드 (TC-TML-005~007, TC-HOME-008)", () => {
  const until = getTargetSearchEnd(TODAY);
  const autos = generateAutoAnniversaries(START, 1, { from: START, to: until });

  it("사용자 지정 2026-12-01: 카드 48/54 ≈ 88.89%, 메인은 48% 유지 (ARC-C01, CUS-010)", () => {
    const customs = generateCustomOccurrences([anniversary(UUID_A, "기념", "2026-12-01", "none")], [], until);
    const highlight = getTimelineHighlight(mergeAnniversaries(autos, customs), START, TODAY)!;
    expect(highlight.progress).toMatchObject({ previousDate: "2026-10-08", targetDate: "2026-12-01" });
    expect(highlight.progress.percentage).toBeCloseTo(88.889, 2);
    expect(highlight.occurrenceIds).toEqual([`custom:${UUID_A}`]);
    expect(calculateHomeProgress(START, 1, TODAY)?.percentage).toBe(48);
  });

  it("가장 가까운 날짜에 겹치는 기념일 모두 강조 (ARC-C02)", () => {
    const customs = generateCustomOccurrences([anniversary(UUID_A, "기념", "2027-01-16", "none")], [], until);
    const highlight = getTimelineHighlight(mergeAnniversaries(autos, customs), START, TODAY)!;
    expect(highlight.occurrenceIds.sort()).toEqual(["auto:day:200", `custom:${UUID_A}`].sort());
    expect(highlight.progress.percentage).toBe(48);
  });

  it("시작일 당일 사용자 지정 기념일은 당일 100%, 분모 0 없음", () => {
    const customs = generateCustomOccurrences([anniversary(UUID_A, "첫날", START, "none")], [], until);
    const all = mergeAnniversaries(generateAutoAnniversaries(START, 1, { from: START, to: getTargetSearchEnd(START) }), customs);
    expect(getTimelineHighlight(all, START, START)?.progress).toMatchObject({ percentage: 100, isAnniversaryToday: true });
  });

  it("시작일 이전에 보존된 사용자 지정 기념일은 이전 기준으로 쓰지 않는다 (ARC-A01 구현 제안)", () => {
    const newStart = "2026-07-05";
    const customs = generateCustomOccurrences([anniversary(UUID_A, "옛 기념", "2026-07-02", "none")], [], until);
    const all = mergeAnniversaries(generateAutoAnniversaries(newStart, 1, { from: newStart, to: until }), customs);
    const highlight = getTimelineHighlight(all, newStart, "2026-07-06")!;
    expect(highlight.progress.previousDate).toBe(newStart);
    expect(all.map((o) => o.id)).toContain(`custom:${UUID_A}`); // 카드 자체는 유지
  });

  it("기기 날짜가 시작일 이전이면 강조 없음", () => {
    expect(getTimelineHighlight(autos, START, "2026-06-30")).toBeNull();
  });
});
