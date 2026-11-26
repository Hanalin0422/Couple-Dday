import { describe, expect, it } from "vitest";
import { validateInstant } from "@/domain/date/instant";
import {
  addDaysToLocalDate,
  addYearsToLocalDate,
  diffCalendarDays,
  formatDisplayDate,
  InvalidLocalDateError,
  parseLocalDate,
  toLocalDate,
  validateLocalDate,
} from "@/domain/date/local-date";

describe("LocalDate 검증 (TC-DATE-001, TC-DATE-002)", () => {
  it.each(["2026-07-01", "2024-02-29", "2000-02-29", "0001-01-01", "9999-12-31"])("%s 은 유효하다", (value) => {
    expect(validateLocalDate(value)).toBe(true);
  });

  it.each([
    "2026-02-30",
    "2025-02-29",
    "1900-02-29",
    "2026-13-01",
    "2026-00-10",
    "2026-04-31",
    "2026-7-1",
    "2026-07-01T00:00",
    "20260701",
    " 2026-07-01",
    "",
    "0000-01-01",
  ])("%j 은 자동 보정 없이 거부한다", (value) => {
    expect(validateLocalDate(value)).toBe(false);
  });

  it.each([null, undefined, 20260701, new Date(2026, 6, 1)])("문자열이 아닌 값 %j 를 거부한다", (value) => {
    expect(validateLocalDate(value)).toBe(false);
  });

  it("parseLocalDate는 잘못된 날짜에 예외를 던진다", () => {
    expect(() => parseLocalDate("2026-02-30")).toThrow(InvalidLocalDateError);
  });

  it("parseLocalDate는 현지 자정을 반환하고 toLocalDate와 왕복한다", () => {
    const date = parseLocalDate("2026-07-01");
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 6, 1, 0]);
    expect(toLocalDate(date)).toBe("2026-07-01");
    expect(toLocalDate(parseLocalDate("0050-03-01"))).toBe("0050-03-01");
  });
});

describe("LocalDate 연산", () => {
  it("달력 날짜 차이와 가산", () => {
    expect(diffCalendarDays("2026-11-25", "2026-07-01")).toBe(147);
    expect(diffCalendarDays("2026-07-01", "2026-11-25")).toBe(-147);
    expect(addDaysToLocalDate("2026-07-01", 99)).toBe("2026-10-08");
    expect(addDaysToLocalDate("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("2월 29일의 연 가산은 평년 2월 28일, 윤년 2월 29일", () => {
    expect(addYearsToLocalDate("2024-02-29", 1)).toBe("2025-02-28");
    expect(addYearsToLocalDate("2024-02-29", 4)).toBe("2028-02-29");
  });

  it("표시 형식 YYYY.MM.DD (HOME-008)", () => {
    expect(formatDisplayDate("2026-07-01")).toBe("2026.07.01");
  });
});

describe("시간대 독립성 (TC-DATE-008)", () => {
  const original = process.env.TZ;
  it.each(["UTC", "America/Los_Angeles", "Pacific/Kiritimati", "Australia/Lord_Howe"])("%s 에서도 달력 차이가 동일하다", (tz) => {
    process.env.TZ = tz;
    try {
      // America/Los_Angeles 는 2026-03-08 서머타임 시작(23시간 하루)을 포함한다.
      expect(diffCalendarDays("2026-03-10", "2026-03-01")).toBe(9);
      expect(diffCalendarDays("2026-11-25", "2026-07-01")).toBe(147);
      expect(addDaysToLocalDate("2026-03-07", 2)).toBe("2026-03-09");
      expect(addDaysToLocalDate("2026-10-31", 2)).toBe("2026-11-02");
    } finally {
      process.env.TZ = original;
    }
  });
});

describe("Instant 검증 (TC-DB-005, DB-014)", () => {
  it.each(["2026-11-25T06:30:00Z", "2026-11-25T06:30:00.123Z", "2024-02-29T23:59:59Z"])("%s 유효", (value) => {
    expect(validateInstant(value)).toBe(true);
  });

  it.each([
    "2026-11-25T06:30:00",
    "2026-11-25T06:30:00+09:00",
    "2026-11-25 06:30:00Z",
    "2026-02-30T00:00:00Z",
    "2026-11-25T24:00:00Z",
    "2026-11-25T06:60:00Z",
    "2026-11-25",
    "",
  ])("%j 거부", (value) => {
    expect(validateInstant(value)).toBe(false);
  });
});
