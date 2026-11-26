/**
 * 타임라인 표시 모델 (TC-TML-001~007, TC-TML-016 계산 부분, TC-ANN-009).
 */
import { describe, expect, it } from "vitest";
import type { AnniversaryException, CustomAnniversary } from "@/domain/entities";
import { buildTimeline, type TimelineEntry } from "@/features/anniversary/timeline-model";

const base = { startDate: "2026-07-01", dayOffset: 1 as const, today: "2026-11-25", futureEnd: "2027-11-25", series: [] as CustomAnniversary[], exceptions: [] as AnniversaryException[] };
const UUID_A = "11111111-1111-4111-8111-111111111111";
const T0 = "2026-11-01T00:00:00Z";
const series = (overrides: Partial<CustomAnniversary>): CustomAnniversary => ({ id: UUID_A, title: "기념", date: "2026-12-01", repeatType: "none", createdAt: T0, updatedAt: T0, ...overrides });
const titles = (entries: TimelineEntry[]) => entries.map((e) => (e.type === "today" ? `오늘${e.dayCount}` : e.occurrence.title));

describe("buildTimeline", () => {
  it("전체: 과거→미래, 오늘 구분선, 지난 항목은 D-N 없음, 다음 기념일 강조", () => {
    const { entries, highlight } = buildTimeline({ ...base, filter: "all" });
    expect(titles(entries)).toEqual(["10일", "30일", "50일", "100일", "오늘148", "200일", "300일", "1주년", "400일", "500일"]);
    const items = entries.filter((e) => e.type === "item");
    expect(items.filter((e) => e.status === "past").every((e) => e.ddayLabel === null)).toBe(true);
    expect(items.find((e) => e.occurrence.title === "200일")).toMatchObject({ highlighted: true, ddayLabel: "D-52" });
    expect(items.filter((e) => e.highlighted)).toHaveLength(1);
    expect(highlight?.progress.percentage).toBe(48);
  });

  it("지난 날: date < 오늘, 구분선 없음 / 다가오는 날: date >= 오늘, 당일 포함", () => {
    expect(titles(buildTimeline({ ...base, filter: "past" }).entries)).toEqual(["10일", "30일", "50일", "100일"]);
    const upcoming = buildTimeline({ ...base, today: "2026-10-08", futureEnd: "2027-10-08", filter: "upcoming" });
    expect(titles(upcoming.entries)[0]).toBe("100일");
    expect(upcoming.entries[0]).toMatchObject({ ddayLabel: "D-DAY", highlighted: true, status: "upcoming" });
    expect(upcoming.entries.some((e) => e.type === "today")).toBe(false);
  });

  it("기념일 당일은 오늘 구분선 아래(다가오는 쪽)에 표시된다", () => {
    const { entries } = buildTimeline({ ...base, today: "2026-10-08", futureEnd: "2027-10-08", filter: "all" });
    const index = titles(entries).indexOf("오늘100");
    expect(titles(entries)[index + 1]).toBe("100일");
  });

  it("미래 자동·반복 기념일은 표시 범위까지만, 일회성은 범위와 무관하게 표시 (TML-014)", () => {
    const list = [series({ title: "5년 뒤", date: "2031-11-25" }), series({ id: "22222222-2222-4222-8222-222222222222", title: "매년", date: "2026-12-05", repeatType: "yearly" })];
    const t = titles(buildTimeline({ ...base, series: list, filter: "all" }).entries);
    expect(t).toContain("5년 뒤");
    expect(t).not.toContain("2주년");
    expect(t.filter((x) => x === "매년")).toHaveLength(1); // 2027-12-05 는 범위 밖
    const extended = titles(buildTimeline({ ...base, series: list, futureEnd: "2028-11-25", filter: "all" }).entries);
    expect(extended).toContain("2주년");
    expect(extended.filter((x) => x === "매년")).toHaveLength(2);
  });

  it("사용자 지정 기념일이 가장 가까우면 그 카드를 강조하고 별도 진행률 (ARC-C01)", () => {
    const { entries, highlight } = buildTimeline({ ...base, series: [series({})], filter: "all" });
    expect(entries.find((e) => e.type === "item" && e.highlighted)).toMatchObject({ occurrence: { title: "기념" }, ddayLabel: "D-6" });
    expect(highlight?.progress.percentage).toBeCloseTo(88.889, 2);
  });

  it("같은 날짜의 가장 가까운 기념일은 모두 강조 (ARC-C02)", () => {
    const { entries } = buildTimeline({ ...base, series: [series({ date: "2027-01-16" })], filter: "all" });
    const highlighted = entries.filter((e) => e.type === "item" && e.highlighted).map((e) => (e.type === "item" ? e.occurrence.title : ""));
    expect(highlighted).toEqual(["200일", "기념"]);
  });

  it("취소된 반복 발생 건은 표시하지 않는다", () => {
    const yearly = series({ date: "2026-08-15", repeatType: "yearly", title: "여행" });
    const exceptions: AnniversaryException[] = [{ seriesId: UUID_A, occurrenceYear: 2026, kind: "cancelled", createdAt: T0, updatedAt: T0 }];
    const t = titles(buildTimeline({ ...base, series: [yearly], exceptions, filter: "all" }).entries);
    expect(t.filter((x) => x === "여행")).toHaveLength(1); // 2027년만
  });

  it("기기 날짜가 시작일 이전이면 구분선·강조 없음", () => {
    const { entries, highlight } = buildTimeline({ ...base, today: "2026-06-30", futureEnd: "2027-06-30", filter: "all" });
    expect(entries.some((e) => e.type === "today")).toBe(false);
    expect(highlight).toBeNull();
  });
});
