/**
 * 추억 사진·메모 유스케이스 통합 테스트 — "저장" 한 번으로 반영하는 흐름(2026-11-26)
 * (TC-MEM-001~010, TC-MEM-014, TC-MEM-017, ARC-B01~B06, DB-004~DB-008, DB-013).
 */
import { afterEach, describe, expect, it } from "vitest";
import type { DraftImage } from "@/domain/entities";
import { RevisionConflictError, ValidationError } from "@/application/errors";
import { addCustomAnniversary, deleteOneTimeAnniversary } from "@/application/services/anniversaries";
import { loadAppState } from "@/application/services/app-bootstrap";
import { updateStartDate } from "@/application/services/couple-settings";
import { deleteMemory, MemoryPolicyError, saveMemory, type MemoryEdit } from "@/application/services/memories";
import { completeOnboarding } from "@/application/services/onboarding";
import { checkIntegrity } from "@/application/validation/integrity";
import { openDatabase, type CoupleDatabase } from "@/infrastructure/db/database";
import { hash } from "../../fixtures/entities";

const TODAY = "2026-11-25";
const PAST = "auto:day:100"; // 2026-10-08
const FUTURE = "auto:day:200"; // 2027-01-16
const opened: CoupleDatabase[] = [];
afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await indexedDB.deleteDatabase(db.name);
  }
});

function image(seed: string): DraftImage {
  const data = new Uint8Array([0xff, 0xd8, 0xff, ...Array.from(seed, (c) => c.charCodeAt(0))]).buffer;
  return { data, sourceHash: hash(seed), contentHash: hash(`${seed}c`), mimeType: "image/jpeg", width: 10, height: 10, size: data.byteLength };
}

/** 새 사진만으로 구성된 편집 */
const withNew = (seeds: string[], memo = "", cover: string | null = null): MemoryEdit => ({
  order: seeds,
  newPhotos: seeds.map((s) => ({ key: s, image: image(s) })),
  cover,
  memo,
});

async function setup() {
  const db = await openDatabase({ name: `test-${crypto.randomUUID()}` });
  opened.push(db);
  await loadAppState(db);
  let rev = await completeOnboarding(
    db,
    { myName: "하늘", partnerName: "바다", startDate: "2026-07-01", dayOffset: 1, myPhoto: null, partnerPhoto: null },
    { expectedRevision: 0, today: TODAY },
  );
  const ctx = () => ({ expectedRevision: rev, today: TODAY });
  const track = async <T,>(p: Promise<T>): Promise<T> => {
    const result = await p;
    rev = typeof result === "number" ? result : (result as { revision: number }).revision;
    return result;
  };
  const snapshot = async () => ({
    couple: await db.couple.toArray(),
    settings: await db.settings.toArray(),
    anniversaries: await db.anniversaries.toArray(),
    anniversaryExceptions: await db.anniversaryExceptions.toArray(),
    memories: await db.memories.toArray(),
    photos: await db.photos.toArray(),
    onboardingDraft: await db.onboardingDraft.toArray(),
  });
  const photosOf = async (id: string) => (await db.photos.where("[ownerType+ownerId]").equals(["memory", id]).toArray()).sort((a, b) => a.sortOrder - b.sortOrder);
  return { db, ctx, track, snapshot, photosOf };
}

const policyReason = async (p: Promise<unknown>) => {
  const error = await p.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(MemoryPolicyError);
  return (error as MemoryPolicyError).reason;
};

describe("저장", () => {
  it("사진과 메모를 한 번에 저장, 첫 사진이 대표, 순서 0부터 연속 (MEM-001, MEM-009, DB-007, DB-013)", async () => {
    const { db, ctx, track, photosOf, snapshot } = await setup();
    await track(saveMemory(db, PAST, withNew(["a", "b"], "가상 메모"), ctx()));
    const photos = await photosOf(PAST);
    expect(photos.map((p) => p.sortOrder)).toEqual([0, 1]);
    expect(await db.memories.get(PAST)).toMatchObject({ memo: "가상 메모", coverPhotoId: photos[0].id });
    expect(checkIntegrity(await snapshot())).toEqual([]);
  });

  it("미래 발생 건에는 새 사진·새 기록을 만들 수 없다 (MEM-002)", async () => {
    const { db, ctx } = await setup();
    expect(await policyReason(saveMemory(db, FUTURE, withNew(["a"]), ctx()))).toBe("future-occurrence");
    expect(await policyReason(saveMemory(db, FUTURE, withNew([], "미래 메모"), ctx()))).toBe("future-occurrence");
  });

  it("당일에는 등록할 수 있다 (TML-012)", async () => {
    const { db, ctx, track } = await setup();
    const { id } = await track(addCustomAnniversary(db, { title: "오늘", date: TODAY, repeatType: "none" }, ctx()));
    await track(saveMemory(db, `custom:${id}`, withNew(["a"]), ctx()));
    expect(await db.memories.get(`custom:${id}`)).toBeDefined();
  });

  it("발생 건당 5장 제한 (MEM-003, MEM-E04)", async () => {
    const { db, ctx, track, photosOf } = await setup();
    await track(saveMemory(db, PAST, withNew(["a", "b", "c", "d", "e"]), ctx()));
    const existing = (await photosOf(PAST)).map((p) => p.id);
    expect(await policyReason(saveMemory(db, PAST, { order: [...existing, "f"], newPhotos: [{ key: "f", image: image("f") }], cover: null, memo: "" }, ctx()))).toBe("limit-reached");
    expect(await photosOf(PAST)).toHaveLength(5);
  });

  it("같은 추억에 동일 원본은 차단, 다른 기념일에는 허용 (MEM-011, ARC-B01, ARC-B02)", async () => {
    const { db, ctx, track, photosOf } = await setup();
    await track(saveMemory(db, PAST, withNew(["a"]), ctx()));
    const [a] = await photosOf(PAST);
    expect(await policyReason(saveMemory(db, PAST, { order: [a.id, "dup"], newPhotos: [{ key: "dup", image: image("a") }], cover: null, memo: "" }, ctx()))).toBe("duplicate");
    await track(saveMemory(db, "auto:day:50", withNew(["a"]), ctx()));
  });

  it("저장 실패 시 아무것도 바뀌지 않는다 (DB-013, MEM-E08)", async () => {
    const { db, ctx, track, photosOf } = await setup();
    const stale = ctx();
    await track(saveMemory(db, PAST, withNew(["a"], "처음"), ctx()));
    await expect(saveMemory(db, PAST, withNew(["b"], "덮어쓰기"), stale)).rejects.toBeInstanceOf(RevisionConflictError);
    expect(await photosOf(PAST)).toHaveLength(1);
    expect((await db.memories.get(PAST))?.memo).toBe("처음");
  });

  it("존재하지 않는 발생 건·잘못된 순서 목록은 거부 (DB-011)", async () => {
    const { db, ctx } = await setup();
    expect(await policyReason(saveMemory(db, "auto:day:150", withNew(["a"]), ctx()))).toBe("unknown-occurrence");
    await expect(saveMemory(db, PAST, { order: ["x"], newPhotos: [], cover: null, memo: "" }, ctx())).rejects.toBeInstanceOf(ValidationError);
    await expect(saveMemory(db, PAST, { order: ["a", "a"], newPhotos: [{ key: "a", image: image("a") }], cover: null, memo: "" }, ctx())).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("수정: 대표·순서·사진 빼기·메모", () => {
  it("대표 변경, 순서 변경 시 대표 유지, 사진 추가를 한 번에 저장 (MEM-009, MEM-010, ARC-B04)", async () => {
    const { db, ctx, track, photosOf } = await setup();
    await track(saveMemory(db, PAST, withNew(["a", "b", "c"]), ctx()));
    const [a, b, c] = await photosOf(PAST);
    await track(saveMemory(db, PAST, { order: [c.id, "d", a.id, b.id], newPhotos: [{ key: "d", image: image("d") }], cover: b.id, memo: "" }, ctx()));
    const after = await photosOf(PAST);
    expect(after.map((p) => p.sourceHash)).toEqual([hash("c"), hash("d"), hash("a"), hash("b")]);
    expect((await db.memories.get(PAST))?.coverPhotoId).toBe(b.id);
  });

  it("대표를 빼면 남은 첫 사진이 대표, 사진을 모두 빼도 메모가 있으면 기록 유지 (ARC-B03, MEM-E09)", async () => {
    const { db, ctx, track, photosOf, snapshot } = await setup();
    await track(saveMemory(db, PAST, withNew(["a", "b"], "가상 메모"), ctx()));
    const [a, b] = await photosOf(PAST);
    await track(saveMemory(db, PAST, { order: [b.id], newPhotos: [], cover: a.id, memo: "가상 메모" }, ctx()));
    expect(await db.memories.get(PAST)).toMatchObject({ coverPhotoId: b.id });
    expect((await photosOf(PAST)).map((p) => p.sortOrder)).toEqual([0]);
    await track(saveMemory(db, PAST, { order: [], newPhotos: [], cover: null, memo: "가상 메모" }, ctx()));
    expect(await db.memories.get(PAST)).toMatchObject({ memo: "가상 메모", coverPhotoId: null });
    expect(checkIntegrity(await snapshot())).toEqual([]);
  });

  it("사진 없는 메모 단독 저장, 500자 제한, 모두 비우면 기록 제거 (MEM-013, ARC-B05, MEM-E11)", async () => {
    const { db, ctx, track } = await setup();
    await track(saveMemory(db, PAST, withNew([], "가".repeat(500)), ctx()));
    expect((await db.memories.get(PAST))?.memo).toHaveLength(500);
    await expect(saveMemory(db, PAST, withNew([], "가".repeat(501)), ctx())).rejects.toBeInstanceOf(ValidationError);
    await track(saveMemory(db, PAST, withNew([], "  "), ctx()));
    expect(await db.memories.get(PAST)).toBeUndefined();
  });

  it("시작일 변경으로 미래가 된 기존 기록: 보존·메모 수정·사진 빼기 허용, 새 사진 거부 (SET-016, ARC-B06, SET-E07)", async () => {
    const { db, ctx, track, photosOf } = await setup();
    await track(saveMemory(db, PAST, withNew(["a", "b"], "처음"), ctx()));
    await track(updateStartDate(db, "2026-09-01", { expectedRevision: ctx().expectedRevision, today: TODAY })); // 100일 → 미래
    const [a] = await photosOf(PAST);
    await track(saveMemory(db, PAST, { order: [a.id], newPhotos: [], cover: null, memo: "수정한 메모" }, ctx()));
    expect(await db.memories.get(PAST)).toMatchObject({ memo: "수정한 메모" });
    expect(await policyReason(saveMemory(db, PAST, { order: [a.id, "c"], newPhotos: [{ key: "c", image: image("c") }], cover: null, memo: "수정한 메모" }, ctx()))).toBe("future-occurrence");
    expect(await photosOf(PAST)).toHaveLength(1);
  });
});

describe("삭제", () => {
  it("추억 전체 삭제는 사진·메모를 함께 지우고 다른 기념일은 유지 (MEM-005)", async () => {
    const { db, ctx, track, snapshot } = await setup();
    await track(saveMemory(db, PAST, withNew(["a", "b"], "메모"), ctx()));
    await track(saveMemory(db, "auto:day:50", withNew(["c"]), ctx()));
    await track(deleteMemory(db, PAST, ctx()));
    expect(await db.memories.get(PAST)).toBeUndefined();
    expect(await db.photos.where("[ownerType+ownerId]").equals(["memory", PAST]).count()).toBe(0);
    expect(await db.memories.get("auto:day:50")).toBeDefined();
    expect(checkIntegrity(await snapshot())).toEqual([]);
  });

  it("사용자 지정 기념일 삭제 시 연결 기록도 삭제 (SET-017)", async () => {
    const { db, ctx, track, snapshot } = await setup();
    const { id } = await track(addCustomAnniversary(db, { title: "기념", date: "2026-10-01", repeatType: "none" }, ctx()));
    await track(saveMemory(db, `custom:${id}`, withNew(["a"], "메모"), ctx()));
    await track(deleteOneTimeAnniversary(db, id, ctx()));
    expect(await db.photos.count()).toBe(0);
    expect(await db.memories.count()).toBe(0);
    expect(checkIntegrity(await snapshot())).toEqual([]);
  });
});
