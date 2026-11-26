/**
 * 온보딩·설정 유스케이스 통합 테스트
 * (TC-ONB-002, TC-ONB-007, TC-ONB-008, TC-ONB-010 일부, TC-ONB-011, TC-SET-001, TC-SET-002, TC-SET-005, TC-SET-007, TC-DATE-012).
 */
import { afterEach, describe, expect, it } from "vitest";
import type { DraftImage } from "@/domain/entities";
import { RevisionConflictError, ValidationError } from "@/application/errors";
import { loadAppState } from "@/application/services/app-bootstrap";
import {
  removeProfilePhoto,
  setProfilePhoto,
  updateDayOffset,
  updateName,
  updateStartDate,
} from "@/application/services/couple-settings";
import {
  completeOnboarding,
  saveOnboardingDraft,
  validateOnboardingInput,
  type OnboardingInput,
} from "@/application/services/onboarding";
import { checkIntegrity } from "@/application/validation/integrity";
import { openDatabase, type CoupleDatabase } from "@/infrastructure/db/database";
import { hash, memory, photo } from "../../fixtures/entities";

const TODAY = "2026-11-25";
const opened: CoupleDatabase[] = [];
afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await indexedDB.deleteDatabase(db.name);
  }
});

async function newUserDb() {
  const db = await openDatabase({ name: `test-${crypto.randomUUID()}` });
  opened.push(db);
  const state = await loadAppState(db);
  if (state.status !== "onboarding") throw new Error("expected onboarding");
  return db;
}

function image(seed: string): DraftImage {
  const data = new Uint8Array([0xff, 0xd8, 0xff, seed.charCodeAt(0)]).buffer;
  return { data, sourceHash: hash(seed), contentHash: hash(`${seed}c`), mimeType: "image/jpeg", width: 10, height: 10, size: data.byteLength };
}

const input = (overrides: Partial<OnboardingInput> = {}): OnboardingInput => ({
  myName: " 하늘 ",
  partnerName: "바다",
  startDate: "2026-07-01",
  dayOffset: 1,
  myPhoto: null,
  partnerPhoto: null,
  ...overrides,
});

async function snapshot(db: CoupleDatabase) {
  const [couple, settings, anniversaries, anniversaryExceptions, memories, photos, onboardingDraft] = await Promise.all([
    db.couple.toArray(),
    db.settings.toArray(),
    db.anniversaries.toArray(),
    db.anniversaryExceptions.toArray(),
    db.memories.toArray(),
    db.photos.toArray(),
    db.onboardingDraft.toArray(),
  ]);
  return { couple, settings, anniversaries, anniversaryExceptions, memories, photos, onboardingDraft };
}

async function completedDb() {
  const db = await newUserDb();
  const revision = await completeOnboarding(db, input(), { expectedRevision: 0, today: TODAY });
  return { db, revision };
}

describe("온보딩 입력 검증 (ONB-008)", () => {
  it("두 이름과 유효한 시작일이 있을 때만 통과", () => {
    expect(validateOnboardingInput(input(), TODAY)).toEqual({});
    expect(validateOnboardingInput(input({ myName: "  " }), TODAY)).toEqual({ myName: "empty" });
    expect(validateOnboardingInput(input({ partnerName: "가".repeat(11) }), TODAY)).toEqual({ partnerName: "too-long" });
    expect(validateOnboardingInput(input({ startDate: null }), TODAY)).toEqual({ startDate: "missing" });
    expect(validateOnboardingInput(input({ startDate: "2026-11-26" }), TODAY)).toEqual({ startDate: "future-date" });
    expect(validateOnboardingInput(input({ startDate: TODAY }), TODAY)).toEqual({});
  });
});

describe("임시 저장 (ONB-012)", () => {
  it("입력 중 상태를 저장·복구하고 revision 을 올린다", async () => {
    const db = await newUserDb();
    const revision = await saveOnboardingDraft(db, input({ myName: "하늘", partnerName: "", startDate: null, myPhoto: image("a") }), {
      expectedRevision: 0,
    });
    expect(revision).toBe(1);
    const state = await loadAppState(db);
    expect(state.status === "onboarding" && state.draft).toMatchObject({ myName: "하늘", partnerName: "", startDate: null });
    expect(state.status === "onboarding" && state.draft?.myPhoto?.data).toBeInstanceOf(ArrayBuffer);
  });

  it("길이 초과 draft 는 저장하지 않는다", async () => {
    const db = await newUserDb();
    await expect(saveOnboardingDraft(db, input({ myName: "가".repeat(11) }), { expectedRevision: 0 })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("온보딩 완료 (ONB-009, ONB-013)", () => {
  it("커플·설정·프로필 사진·draft 를 한 번에 처리하고 메인 상태가 된다", async () => {
    const db = await newUserDb();
    let revision = await saveOnboardingDraft(db, input({ myPhoto: image("a") }), { expectedRevision: 0 });
    revision = await completeOnboarding(db, input({ myPhoto: image("a"), partnerPhoto: image("b"), dayOffset: 0 }), {
      expectedRevision: revision,
      today: TODAY,
    });
    expect(revision).toBe(2);
    const state = await loadAppState(db);
    expect(state).toMatchObject({ status: "ready", couple: { myName: "하늘", partnerName: "바다" }, settings: { dayOffset: 0, onboardingCompleted: true } });
    expect(await db.onboardingDraft.count()).toBe(0);
    expect(await db.photos.count()).toBe(2);
    expect(checkIntegrity(await snapshot(db))).toEqual([]);
  });

  it("저장 직전 재검증으로 미래 시작일을 거부한다 (DATE-008, DATE-E01)", async () => {
    const db = await newUserDb();
    await expect(completeOnboarding(db, input({ startDate: "2026-11-26" }), { expectedRevision: 0, today: TODAY })).rejects.toBeInstanceOf(ValidationError);
    expect(await db.couple.count()).toBe(0);
  });

  it("이미 완료된 상태에서 다시 완료하지 않는다 (ONB-E09)", async () => {
    const { db, revision } = await completedDb();
    await expect(completeOnboarding(db, input(), { expectedRevision: revision, today: TODAY })).rejects.toThrow();
    expect(await db.couple.count()).toBe(1);
  });

  it("트랜잭션 실패 시 완료 플래그·커플·draft 모두 그대로 (ONB-E07)", async () => {
    const db = await newUserDb();
    await saveOnboardingDraft(db, input(), { expectedRevision: 0 });
    // 같은 원본 해시의 사진을 같은 역할에 두 번 추가하게 만들 수 없으므로, 오래된 revision 으로 실패를 유도한다.
    await expect(completeOnboarding(db, input(), { expectedRevision: 0, today: TODAY })).rejects.toBeInstanceOf(RevisionConflictError);
    expect((await db.settings.get("default"))?.onboardingCompleted).toBe(false);
    expect(await db.couple.count()).toBe(0);
    expect(await db.onboardingDraft.count()).toBe(1);
  });
});

describe("설정 변경 (SET-001~007)", () => {
  it("이름 변경: 앞뒤 공백 제거, 무효 값 차단 (SET-001, SET-002, SET-E02)", async () => {
    const { db, revision } = await completedDb();
    const next = await updateName(db, "partner", "  바다별 ", { expectedRevision: revision });
    expect((await db.couple.get("default"))?.partnerName).toBe("바다별");
    await expect(updateName(db, "self", " ", { expectedRevision: next })).rejects.toBeInstanceOf(ValidationError);
    expect((await db.couple.get("default"))?.myName).toBe("하늘");
  });

  it("시작일 변경은 오늘까지, 연결 추억 ID 는 유지 (SET-005, SET-015, DB-012)", async () => {
    const { db, revision } = await completedDb();
    await db.memories.add(memory({ occurrenceId: "auto:day:100", memo: "가상 메모" }));
    await expect(updateStartDate(db, "2026-11-26", { expectedRevision: revision, today: TODAY })).rejects.toBeInstanceOf(ValidationError);
    await updateStartDate(db, "2026-07-05", { expectedRevision: revision, today: TODAY });
    expect((await db.couple.get("default"))?.startDate).toBe("2026-07-05");
    expect(await db.memories.get("auto:day:100")).toMatchObject({ memo: "가상 메모" });
  });

  it("계산 방식 변경 (SET-006)", async () => {
    const { db, revision } = await completedDb();
    await updateDayOffset(db, 0, { expectedRevision: revision });
    expect((await db.settings.get("default"))?.dayOffset).toBe(0);
  });

  it("오래된 화면에서의 저장은 충돌로 거부하고 기존 값 유지 (SET-E04)", async () => {
    const { db, revision } = await completedDb();
    await updateName(db, "self", "하늘빛", { expectedRevision: revision });
    await expect(updateName(db, "self", "덮어쓰기", { expectedRevision: revision })).rejects.toBeInstanceOf(RevisionConflictError);
    expect((await db.couple.get("default"))?.myName).toBe("하늘빛");
  });

  it("프로필 사진 교체·삭제: 역할당 1장, 참조 일치, 기본 이미지 복귀 (SET-003, SET-004, DB-004)", async () => {
    const { db, revision } = await completedDb();
    let rev = await setProfilePhoto(db, "self", image("a"), { expectedRevision: revision });
    rev = await setProfilePhoto(db, "self", image("b"), { expectedRevision: rev });
    const profiles = await db.photos.where("[ownerType+ownerId]").equals(["profile", "self"]).toArray();
    expect(profiles).toHaveLength(1);
    expect((await db.couple.get("default"))?.myPhotoId).toBe(profiles[0].id);
    expect(profiles[0].sourceHash).toBe(hash("b"));
    expect(checkIntegrity(await snapshot(db))).toEqual([]);

    await removeProfilePhoto(db, "self", { expectedRevision: rev });
    expect((await db.couple.get("default"))?.myPhotoId).toBeNull();
    expect(await db.photos.count()).toBe(0);
  });

  it("프로필 사진 변경은 추억 사진에 영향을 주지 않는다", async () => {
    const { db, revision } = await completedDb();
    const memoryPhoto = photo({ ownerId: "auto:day:100" });
    await db.memories.add(memory({ coverPhotoId: memoryPhoto.id }));
    await db.photos.add(memoryPhoto);
    await removeProfilePhoto(db, "self", { expectedRevision: revision });
    expect(await db.photos.get(memoryPhoto.id)).toBeDefined();
  });
});
