import { describe, expect, it } from "vitest";
import {
  generateAutoAnniversaries,
  generateAutoDayAnniversaries,
  generateAutoYearAnniversaries,
} from "@/domain/anniversary/generator";
import {
  autoDayOccurrenceId,
  autoYearOccurrenceId,
  customOccurrenceId,
  parseOccurrenceId,
} from "@/domain/anniversary/occurrence-id";
import { mergeAnniversaries } from "@/domain/anniversary/timeline";

const START = "2026-07-01";
const ALL = { from: "2026-07-01", to: "2028-09-30" };

const simplify = (list: { id: string; date: string; title: string }[]) =>
  list.map(({ id, date, title }) => ({ id, date, title }));

describe("자동 일수 기념일 (TC-ANN-001, TC-ANN-002)", () => {
  it("1일 방식: 10/30/50일, 이후 100일 단위", () => {
    expect(simplify(generateAutoDayAnniversaries(START, 1, ALL))).toEqual([
      { id: "auto:day:10", date: "2026-07-10", title: "10일" },
      { id: "auto:day:30", date: "2026-07-30", title: "30일" },
      { id: "auto:day:50", date: "2026-08-19", title: "50일" },
      { id: "auto:day:100", date: "2026-10-08", title: "100일" },
      { id: "auto:day:200", date: "2027-01-16", title: "200일" },
      { id: "auto:day:300", date: "2027-04-26", title: "300일" },
      { id: "auto:day:400", date: "2027-08-04", title: "400일" },
      { id: "auto:day:500", date: "2027-11-12", title: "500일" },
      { id: "auto:day:600", date: "2028-02-20", title: "600일" },
      { id: "auto:day:700", date: "2028-05-30", title: "700일" },
      { id: "auto:day:800", date: "2028-09-07", title: "800일" },
    ]);
  });

  it("0일 방식: 일수 기념일이 하루씩 뒤로 이동", () => {
    const dates = generateAutoDayAnniversaries(START, 0, ALL).map((o) => [o.days, o.date]);
    expect(dates.slice(0, 5)).toEqual([
      [10, "2026-07-11"],
      [30, "2026-07-31"],
      [50, "2026-08-20"],
      [100, "2026-10-09"],
      [200, "2027-01-17"],
    ]);
  });

  it("구간 [from, to)만 생성하며 경계를 정확히 처리한다", () => {
    const days = (from: string, to: string) => generateAutoDayAnniversaries(START, 1, { from, to }).map((o) => o.days);
    expect(days("2026-10-08", "2027-01-16")).toEqual([100]); // from 포함, to 미포함
    expect(days("2026-10-09", "2027-01-17")).toEqual([200]);
    expect(days("2026-11-25", "2027-11-25")).toEqual([200, 300, 400, 500]);
    expect(days("2026-06-01", "2026-07-10")).toEqual([]);
    expect(days("2027-01-16", "2027-01-16")).toEqual([]);
  });

  it("먼 미래 구간에서도 100일 단위가 계속된다 (ANN-002)", () => {
    const list = generateAutoDayAnniversaries(START, 1, { from: "2056-07-01", to: "2056-12-31" });
    expect(list.length).toBeGreaterThan(0);
    for (const o of list) expect(o.days % 100).toBe(0);
  });
});

describe("자동 주년 (TC-ANN-003, TC-ANN-004)", () => {
  it("0일/1일 방식과 무관하게 동일한 달력 날짜", () => {
    const years = (offset: 0 | 1) =>
      generateAutoAnniversaries(START, offset, ALL)
        .filter((o) => o.kind === "auto-year")
        .map((o) => [o.id, o.date]);
    expect(years(1)).toEqual([
      ["auto:year:1", "2027-07-01"],
      ["auto:year:2", "2028-07-01"],
    ]);
    expect(years(0)).toEqual(years(1));
  });

  it("2월 29일 시작: 평년 2월 28일, 윤년 2월 29일, 누적 가산 없음", () => {
    const list = generateAutoYearAnniversaries("2024-02-29", { from: "2024-02-29", to: "2033-01-01" });
    expect(list.map((o) => [o.years, o.date])).toEqual([
      [1, "2025-02-28"],
      [2, "2026-02-28"],
      [3, "2027-02-28"],
      [4, "2028-02-29"],
      [5, "2029-02-28"],
      [6, "2030-02-28"],
      [7, "2031-02-28"],
      [8, "2032-02-29"],
    ]);
  });

  it("구간 시작이 먼 미래여도 올바른 주년 번호를 생성한다", () => {
    const list = generateAutoYearAnniversaries(START, { from: "2046-01-01", to: "2047-12-31" });
    expect(list.map((o) => [o.title, o.date])).toEqual([
      ["20주년", "2046-07-01"],
      ["21주년", "2047-07-01"],
    ]);
  });
});

describe("시작일·오프셋 변경과 식별자 (TC-ANN-005, TC-ANN-006)", () => {
  it("시작일 변경 시 날짜만 재계산되고 ID는 유지된다", () => {
    const before = generateAutoDayAnniversaries("2026-07-01", 1, ALL).find((o) => o.days === 100)!;
    const after = generateAutoDayAnniversaries("2026-07-05", 1, ALL).find((o) => o.days === 100)!;
    expect(before).toMatchObject({ id: "auto:day:100", date: "2026-10-08" });
    expect(after).toMatchObject({ id: "auto:day:100", date: "2026-10-12" });
  });

  it("발생 ID 형식과 해석", () => {
    const uuid = "123e4567-e89b-42d3-a456-426614174000";
    expect(autoDayOccurrenceId(100)).toBe("auto:day:100");
    expect(autoYearOccurrenceId(1)).toBe("auto:year:1");
    expect(customOccurrenceId(uuid)).toBe(`custom:${uuid}`);
    expect(customOccurrenceId(uuid, 2027)).toBe(`custom:${uuid}:2027`);
    expect(parseOccurrenceId("auto:day:100")).toEqual({ kind: "auto-day", days: 100 });
    expect(parseOccurrenceId("auto:year:3")).toEqual({ kind: "auto-year", years: 3 });
    expect(parseOccurrenceId(`custom:${uuid}`)).toEqual({ kind: "custom", seriesId: uuid, occurrenceYear: null });
    expect(parseOccurrenceId(`custom:${uuid}:2027`)).toEqual({ kind: "custom", seriesId: uuid, occurrenceYear: 2027 });
  });

  it.each(["auto:day:0", "auto:day:010", "auto:year:-1", "auto:day:", "custom:not-a-uuid", "custom:123E4567-E89B-42D3-A456-426614174000", "manual:1", ""])(
    "잘못된 발생 ID %j 는 null",
    (id) => {
      expect(parseOccurrenceId(id)).toBeNull();
    },
  );

  it("잘못된 입력으로 ID를 만들지 않는다", () => {
    expect(() => autoDayOccurrenceId(0)).toThrow(RangeError);
    expect(() => autoYearOccurrenceId(1.5)).toThrow(RangeError);
    expect(() => customOccurrenceId("abc")).toThrow(RangeError);
  });
});

describe("동일 날짜 기념일 (TC-ANN-007)", () => {
  it("0일 방식 2000-03-01 시작: 2023-03-01에 23주년과 8400일이 각각 존재하고 주년이 먼저 정렬된다", () => {
    const autos = generateAutoAnniversaries("2000-03-01", 0, { from: "2023-03-01", to: "2023-03-02" });
    expect(mergeAnniversaries(autos).map((o) => o.id)).toEqual(["auto:year:23", "auto:day:8400"]);
  });
});
