/**
 * DB 스냅샷 무결성 규칙 (ARCHITECTURE.md §5.2, TC-DB-001~003, TC-CUS-017).
 */
import { describe, expect, it } from "vitest";
import { checkIntegrity, type DatabaseSnapshot, isAutoDayMilestone } from "@/application/validation/integrity";
import {
  couple,
  draft,
  emptySnapshot,
  exception,
  memory,
  photo,
  SERIES_A,
  SERIES_B,
  settings,
  validSnapshot,
} from "../../fixtures/entities";

const rules = (snapshot: DatabaseSnapshot) => [...new Set(checkIntegrity(snapshot).map((v) => v.rule))].sort();

describe("무결성 검사", () => {
  it("정상 스냅샷과 빈 스냅샷은 위반이 없다", () => {
    expect(checkIntegrity(validSnapshot())).toEqual([]);
    expect(checkIntegrity(emptySnapshot())).toEqual([]);
    expect(checkIntegrity({ ...emptySnapshot(), settings: [settings({ onboardingCompleted: false })], onboardingDraft: [draft()] })).toEqual([]);
  });

  it("DB-001: 단일 레코드 store 중복", () => {
    const s = validSnapshot();
    s.settings.push(settings({ revision: 3 }));
    expect(rules(s)).toContain("DB-001");
  });

  it("DB-002: 완료 상태인데 커플 없음 / 미완료인데 완료 데이터 존재 / 설정 없이 데이터 존재", () => {
    expect(rules({ ...validSnapshot(), couple: [], photos: [] })).toContain("DB-002");
    expect(rules({ ...validSnapshot(), settings: [settings({ onboardingCompleted: false })] })).toContain("DB-002");
    expect(rules({ ...validSnapshot(), settings: [] })).toContain("DB-002");
  });

  it("DB-003 / DB-014: 형식 위반을 길이와 날짜로 구분해 보고한다", () => {
    const s = validSnapshot();
    s.couple[0] = { ...s.couple[0], myName: "가".repeat(11), startDate: "2026-02-30" };
    expect(rules(s)).toEqual(["DB-003", "DB-014"]);
  });

  it("DB-004: 추억 사진 6장 / 프로필 역할당 2장", () => {
    const s = validSnapshot();
    const owner = `custom:${SERIES_A}:2026`;
    const six = Array.from({ length: 6 }, (_, i) => photo({ ownerId: owner, sortOrder: i }));
    s.photos.push(...six);
    s.memories[1] = { ...s.memories[1], coverPhotoId: six[0].id };
    expect(rules(s)).toEqual(["DB-004"]);

    const p = validSnapshot();
    p.photos.push(photo({ ownerType: "profile", ownerId: "self" }));
    expect(rules(p)).toEqual(expect.arrayContaining(["DB-004"]));
  });

  it("DB-005: 대표 사진이 다른 추억의 사진", () => {
    const s = validSnapshot();
    const other = photo({ ownerId: `custom:${SERIES_A}:2026`, sortOrder: 0 });
    s.photos.push(other);
    s.memories[0] = { ...s.memories[0], coverPhotoId: other.id };
    expect(rules(s)).toContain("DB-005");
  });

  it("DB-006: 사진이 있는데 대표 사진 null", () => {
    const s = validSnapshot();
    s.memories[0] = { ...s.memories[0], coverPhotoId: null };
    expect(rules(s)).toEqual(["DB-006"]);
  });

  it("DB-007: 순서가 0부터 연속되지 않음", () => {
    const s = validSnapshot();
    s.photos[2] = { ...s.photos[2], sortOrder: 2 };
    expect(rules(s)).toEqual(["DB-007"]);
  });

  it("DB-008: 같은 추억에 동일 원본 해시", () => {
    const s = validSnapshot();
    s.photos[2] = { ...s.photos[2], sourceHash: s.photos[1].sourceHash };
    expect(rules(s)).toEqual(["DB-008"]);
  });

  it("다른 추억에는 동일 원본 해시 허용 (ARC-B01)", () => {
    const s = validSnapshot();
    const copy = photo({ ownerId: `custom:${SERIES_A}:2026`, sortOrder: 0, sourceHash: s.photos[1].sourceHash });
    s.photos.push(copy);
    s.memories[1] = { ...s.memories[1], coverPhotoId: copy.id };
    expect(checkIntegrity(s)).toEqual([]);
  });

  it("DB-009: 존재하지 않는 시리즈 / 일회성 시리즈 / 등록 연도 이전 예외", () => {
    expect(rules({ ...validSnapshot(), anniversaryExceptions: [exception({ seriesId: "33333333-3333-4333-8333-333333333333" })] })).toEqual(["DB-009"]);
    expect(rules({ ...validSnapshot(), anniversaryExceptions: [exception({ seriesId: SERIES_B })] })).toEqual(["DB-009"]);
    expect(rules({ ...validSnapshot(), anniversaryExceptions: [exception({ occurrenceYear: 2025 })] })).toEqual(["DB-009"]);
  });

  it("DB-010: 취소된 발생 건에 추억 연결 (TC-CUS-017)", () => {
    const s = validSnapshot();
    s.anniversaryExceptions = [exception({ occurrenceYear: 2026, kind: "cancelled" })];
    expect(rules(s)).toEqual(["DB-010"]);
  });

  it("DB-011: 잘못된 발생 ID 참조 (TC-DB-003)", () => {
    const cases = [
      "auto:day:150", // 존재하지 않는 자동 일수
      `custom:33333333-3333-4333-8333-333333333333`, // 존재하지 않는 시리즈
      `custom:${SERIES_B}:2026`, // 일회성에 연도
      `custom:${SERIES_A}`, // 반복에 연도 없음
      `custom:${SERIES_A}:2025`, // 등록 연도 이전
    ];
    for (const occurrenceId of cases) {
      const s = validSnapshot();
      s.memories.push(memory({ occurrenceId }));
      expect(rules(s), occurrenceId).toEqual(["DB-011"]);
    }
  });

  it("DB-011: 프로필 참조 불일치, 추억 레코드 없는 사진, 참조되지 않는 프로필 사진", () => {
    expect(rules({ ...validSnapshot(), couple: [couple({ myPhotoId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })] })).toContain("DB-011");
    const s = validSnapshot();
    s.photos.push(photo({ ownerId: "auto:day:200", sortOrder: 0 }));
    expect(rules(s)).toEqual(["DB-011"]);
    expect(rules({ ...validSnapshot(), couple: [couple()] })).toEqual(["DB-011"]);
  });

  it("자동 일수 기념일 번호 판정", () => {
    expect([10, 30, 50, 100, 200, 8400].every(isAutoDayMilestone)).toBe(true);
    expect([0, 20, 40, 150, 99].some(isAutoDayMilestone)).toBe(false);
  });

  it("위반 메시지에 이름·메모 등 개인 데이터를 포함하지 않는다 (NFR-003)", () => {
    const s = validSnapshot();
    s.couple[0] = { ...s.couple[0], myName: "비밀이름비밀이름비밀이름" };
    s.memories[0] = { ...s.memories[0], memo: "비밀메모".repeat(200) };
    const text = JSON.stringify(checkIntegrity(s));
    expect(text).not.toContain("비밀");
  });
});
