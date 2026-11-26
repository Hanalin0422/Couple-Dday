/**
 * TC-DB-010 (Zod 스키마), DB-003, DB-014, ONB-E01, ONB-E02, CUS-E01, MEM-E11 입력 규칙.
 */
import { describe, expect, it } from "vitest";
import {
  anniversaryExceptionSchema,
  coupleSchema,
  customAnniversarySchema,
  memorySchema,
  onboardingDraftSchema,
  photoSchema,
  settingsSchema,
} from "@/application/validation/entity-schemas";
import {
  countCharacters,
  normalizeRequiredText,
  validateOptionalText,
  validateRequiredText,
} from "@/domain/policies/text-rules";
import { anniversary, couple, draft, exception, memory, photo, settings, SERIES_A } from "../../fixtures/entities";

const ok = (schema: { safeParse(v: unknown): { success: boolean } }, value: unknown) => schema.safeParse(value).success;

describe("글자 수 규칙 (사용자 인식 문자 기준, ARCHITECTURE.md §5.2 제안)", () => {
  it.each([
    ["하늘", 2],
    ["abc", 3],
    ["👩‍❤️‍👨", 1],
    ["🇰🇷", 1],
    ["é", 1],
    ["한", 1], // 조합형 한글 자모 '한'
    ["", 0],
  ])("%j → %i자", (value, expected) => {
    expect(countCharacters(value)).toBe(expected);
  });

  it("Intl.Segmenter 미지원 대체 구현은 코드 포인트 수", () => {
    expect(countCharacters("하늘😀", false)).toBe(3);
  });

  it("필수 텍스트: 앞뒤 공백 제거 후 1..max (ONB-E01, ONB-E02, CUS-E01)", () => {
    expect(validateRequiredText("", 10)).toBe("empty");
    expect(validateRequiredText("   ", 10)).toBe("empty");
    expect(validateRequiredText(" 하늘 ", 10)).toBeNull();
    expect(validateRequiredText("가".repeat(10), 10)).toBeNull();
    expect(validateRequiredText("가".repeat(11), 10)).toBe("too-long");
    expect(validateRequiredText("😀".repeat(10), 10)).toBeNull();
    expect(validateRequiredText("가".repeat(30), 30)).toBeNull();
    expect(validateRequiredText("가".repeat(31), 30)).toBe("too-long");
    expect(normalizeRequiredText("  하늘 ")).toBe("하늘");
  });

  it("메모: 빈 값 허용, 500자 초과 거부 (MEM-E11)", () => {
    expect(validateOptionalText("", 500)).toBeNull();
    expect(validateOptionalText("가".repeat(500), 500)).toBeNull();
    expect(validateOptionalText("가".repeat(501), 500)).toBe("too-long");
  });
});

describe("엔티티 스키마", () => {
  it("유효한 기본 엔티티를 통과시킨다", () => {
    expect(ok(coupleSchema, couple())).toBe(true);
    expect(ok(settingsSchema, settings())).toBe(true);
    expect(ok(customAnniversarySchema, anniversary())).toBe(true);
    expect(ok(anniversaryExceptionSchema, exception())).toBe(true);
    expect(ok(anniversaryExceptionSchema, exception({ kind: "override", overrideDate: "2027-09-01" }))).toBe(true);
    expect(ok(memorySchema, memory())).toBe(true);
    expect(ok(photoSchema, photo())).toBe(true);
    expect(ok(photoSchema, photo({ ownerType: "profile", ownerId: "partner" }))).toBe(true);
    expect(ok(onboardingDraftSchema, draft())).toBe(true);
  });

  it("커플: 이름 공백/빈 값/11자 거부, 저장값은 trim 상태여야 함 (DB-003)", () => {
    expect(ok(coupleSchema, couple({ myName: "" }))).toBe(false);
    expect(ok(coupleSchema, couple({ myName: " 하늘" }))).toBe(false);
    expect(ok(coupleSchema, couple({ partnerName: "가".repeat(11) }))).toBe(false);
    expect(ok(coupleSchema, couple({ partnerName: "가".repeat(10) }))).toBe(true);
  });

  it("날짜·일시 형식을 엄격히 검증한다 (DB-014)", () => {
    expect(ok(coupleSchema, couple({ startDate: "2026-02-30" }))).toBe(false);
    expect(ok(coupleSchema, couple({ createdAt: "2026-11-25T06:30:00+09:00" }))).toBe(false);
    expect(ok(settingsSchema, settings({ lastBackupAt: "2026-11-25" }))).toBe(false);
    expect(ok(customAnniversarySchema, anniversary({ date: "2026-8-15" }))).toBe(false);
  });

  it("단일 레코드 ID는 default 만 허용 (DB-001)", () => {
    expect(ok(coupleSchema, { ...couple(), id: "other" })).toBe(false);
    expect(ok(settingsSchema, { ...settings(), id: "x" })).toBe(false);
  });

  it("설정: dayOffset 0/1, revision 음이 아닌 정수", () => {
    expect(ok(settingsSchema, { ...settings(), dayOffset: 2 })).toBe(false);
    expect(ok(settingsSchema, settings({ revision: -1 }))).toBe(false);
    expect(ok(settingsSchema, settings({ revision: 1.5 }))).toBe(false);
  });

  it("예상하지 않은 필드를 거부한다", () => {
    expect(ok(coupleSchema, { ...couple(), extra: 1 })).toBe(false);
  });

  it("기념일: 이름 30자, UUID, 반복 유형 (CUS-002)", () => {
    expect(ok(customAnniversarySchema, anniversary({ title: "가".repeat(31) }))).toBe(false);
    expect(ok(customAnniversarySchema, anniversary({ title: " " }))).toBe(false);
    expect(ok(customAnniversarySchema, anniversary({ id: "custom:abc" }))).toBe(false);
    expect(ok(customAnniversarySchema, { ...anniversary(), repeatType: "monthly" })).toBe(false);
  });

  it("예외: override 는 이름 또는 날짜 필요, cancelled 는 override 필드 금지", () => {
    expect(ok(anniversaryExceptionSchema, exception({ kind: "override" }))).toBe(false);
    expect(ok(anniversaryExceptionSchema, { ...exception({ kind: "cancelled" }), overrideTitle: "x" })).toBe(false);
    expect(ok(anniversaryExceptionSchema, exception({ occurrenceYear: 0 }))).toBe(false);
  });

  it("추억: 발생 ID 형식, 메모 500자 (MEM-013, MEM-E11)", () => {
    expect(ok(memorySchema, memory({ occurrenceId: "2026-10-08" }))).toBe(false);
    expect(ok(memorySchema, memory({ occurrenceId: `custom:${SERIES_A}:2027` }))).toBe(true);
    expect(ok(memorySchema, memory({ memo: "가".repeat(500) }))).toBe(true);
    expect(ok(memorySchema, memory({ memo: "가".repeat(501) }))).toBe(false);
  });

  it("사진: MIME, 해시, 크기 일치, 소유자 형식", () => {
    expect(ok(photoSchema, photo({ mimeType: "image/gif" as "image/jpeg" }))).toBe(false);
    expect(ok(photoSchema, photo({ sourceHash: "ABC" }))).toBe(false);
    expect(ok(photoSchema, photo({ size: 9999 }))).toBe(false);
    expect(ok(photoSchema, photo({ ownerType: "profile", ownerId: "auto:day:100" }))).toBe(false);
    expect(ok(photoSchema, photo({ ownerType: "memory", ownerId: "self" }))).toBe(false);
    expect(ok(photoSchema, photo({ ownerType: "profile", ownerId: "self", sortOrder: 1 }))).toBe(false);
    expect(ok(photoSchema, { ...photo(), data: "not-bytes" })).toBe(false);
    expect(ok(photoSchema, { ...photo(), data: new Blob([new Uint8Array(6)]) })).toBe(false);
    expect(ok(photoSchema, photo({ width: 0 }))).toBe(false);
  });

  it("온보딩 임시 입력: 작성 중 빈 값 허용, 10자 상한 유지", () => {
    expect(ok(onboardingDraftSchema, draft({ myName: "", partnerName: " " }))).toBe(true);
    expect(ok(onboardingDraftSchema, draft({ myName: "가".repeat(11) }))).toBe(false);
    expect(ok(onboardingDraftSchema, draft({ startDate: "2026-02-30" }))).toBe(false);
  });
});

describe("최대 글자 수 자르기 (ONB-E02)", () => {
  it("사용자 인식 문자 단위로 자르며 결합 문자를 깨뜨리지 않는다", async () => {
    const { truncateToMaxCharacters } = await import("@/domain/policies/text-rules");
    expect(truncateToMaxCharacters("가나다", 10)).toBe("가나다");
    expect(truncateToMaxCharacters("가".repeat(12), 10)).toBe("가".repeat(10));
    expect(truncateToMaxCharacters("👩‍❤️‍👨".repeat(11), 10)).toBe("👩‍❤️‍👨".repeat(10));
    expect(truncateToMaxCharacters("áb́c", 2)).toBe("áb́");
  });
});
