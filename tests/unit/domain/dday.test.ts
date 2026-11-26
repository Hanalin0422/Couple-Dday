import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateDday, calculateRemainingDays, formatDdayLabel } from "@/domain/date/dday";
import {
  canAddNewMemoryPhoto,
  getMaxSelectableMonth,
  validateCustomAnniversaryDateInput,
  validateStartDateInput,
} from "@/domain/policies/date-rules";

const START = "2026-07-01";

describe("디데이 계산 (TC-DATE-003, TC-DATE-004, TC-DATE-006)", () => {
  it.each([
    ["2026-07-01", 0, 1, 0],
    ["2026-07-10", 9, 10, 9],
    ["2026-10-08", 99, 100, 99],
    ["2026-11-25", 147, 148, 147],
    ["2027-07-01", 365, 366, 365],
    ["2028-07-01", 731, 732, 731],
  ])("오늘 %s → 경과 %i, 1일 방식 %i, 0일 방식 %i", (today, elapsed, offset1, offset0) => {
    expect(calculateDday(START, today, 1)).toEqual({ status: "ok", elapsed, dday: offset1 });
    expect(calculateDday(START, today, 0)).toEqual({ status: "ok", elapsed, dday: offset0 });
  });

  it("기기 날짜가 시작일보다 이전이면 음수 대신 오류 상태 (TC-DATE-009, DATE-E05)", () => {
    expect(calculateDday(START, "2026-06-30", 1)).toEqual({ status: "before-start" });
    expect(calculateDday(START, "2026-06-30", 0)).toEqual({ status: "before-start" });
  });
});

describe("남은 일수와 D-N (TC-DATE-010, TC-ANN-008)", () => {
  it("오프셋을 더하지 않는다", () => {
    expect(calculateRemainingDays("2027-01-16", "2026-11-25")).toBe(52);
    expect(calculateRemainingDays("2027-07-01", "2026-11-25")).toBe(218);
  });

  it("당일 D-DAY, 미래 D-N, 과거 null", () => {
    expect(formatDdayLabel("2026-11-25", "2026-11-25")).toBe("D-DAY");
    expect(formatDdayLabel("2027-01-16", "2026-11-25")).toBe("D-52");
    expect(formatDdayLabel("2026-10-08", "2026-11-25")).toBeNull();
  });
});

describe("날짜 입력 정책", () => {
  const TODAY = "2026-11-25";

  it("시작일은 오늘까지 허용, 미래 거부 (TC-DATE-011, TC-DATE-012)", () => {
    expect(validateStartDateInput("2026-11-25", TODAY)).toBeNull();
    expect(validateStartDateInput("2020-01-01", TODAY)).toBeNull();
    expect(validateStartDateInput("2026-11-26", TODAY)).toBe("future-date");
    expect(validateStartDateInput("2026-02-30", TODAY)).toBe("invalid-date");
    expect(validateStartDateInput(undefined, TODAY)).toBe("invalid-date");
  });

  it("사용자 지정 기념일은 시작일 이상, 미래 허용 (TC-DATE-013, TC-CUS-003, TC-CUS-004)", () => {
    expect(validateCustomAnniversaryDateInput("2026-06-30", START)).toBe("before-start-date");
    expect(validateCustomAnniversaryDateInput(START, START)).toBeNull();
    expect(validateCustomAnniversaryDateInput("2026-09-01", START)).toBeNull();
    expect(validateCustomAnniversaryDateInput("2031-12-25", START)).toBeNull();
    expect(validateCustomAnniversaryDateInput("2026-13-01", START)).toBe("invalid-date");
  });

  it("신규 추억 사진은 과거·당일만 허용 (MEM-001, MEM-002)", () => {
    expect(canAddNewMemoryPhoto("2026-10-08", TODAY)).toBe(true);
    expect(canAddNewMemoryPhoto(TODAY, TODAY)).toBe(true);
    expect(canAddNewMemoryPhoto("2026-11-26", TODAY)).toBe(false);
  });

  it("날짜 선택 UI의 마지막 이동 가능 월은 현재 월 (DATE-003)", () => {
    expect(getMaxSelectableMonth(TODAY)).toBe("2026-11");
  });
});

describe("계산 구현 규칙 (TC-DATE-007)", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
    });
  }

  it.each(sourceFiles("src/domain"))("%s 는 밀리초 나눗셈 및 new Date('YYYY-MM-DD')를 사용하지 않는다", (file) => {
    // 규칙을 설명하는 주석은 검사 대상에서 제외한다.
    const source = readFileSync(file, "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(source).not.toMatch(/86_?400_?000/);
    expect(source).not.toMatch(/new Date\(\s*["'`]\d{4}-\d{2}-\d{2}/);
    expect(source).not.toMatch(/\b365\b\s*\*/);
  });
});
