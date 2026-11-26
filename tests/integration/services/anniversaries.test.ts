/**
 * 사용자 지정 기념일 유스케이스 통합 테스트
 * (TC-CUS-002~015, TC-CUS-017, TC-SET-008, ARC-A01~A05, CUS-E05, CUS-E06, 2026-11-26 확정 세칙).
 */
import { afterEach, describe, expect, it } from "vitest";
import { IntegrityError, RevisionConflictError, ValidationError } from "@/application/errors";
import {
  addCustomAnniversary,
  countLinkedRecords,
  deleteAnniversaryOccurrence,
  deleteAnniversarySeries,
  deleteOneTimeAnniversary,
  updateAnniversaryOccurrence,
  updateAnniversarySeries,
  updateOneTimeAnniversary,
} from "@/application/services/anniversaries";
import { loadAppState } from "@/application/services/app-bootstrap";
import { updateStartDate } from "@/application/services/couple-settings";
import { completeOnboarding } from "@/application/services/onboarding";
import { checkIntegrity } from "@/application/validation/integrity";
import { generateCustomOccurrences } from "@/domain/anniversary/exceptions";
import { openDatabase, type CoupleDatabase } from "@/infrastructure/db/database";
import { memory, photo } from "../../fixtures/entities";

const TODAY = "2026-11-25";
const opened: CoupleDatabase[] = [];
afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await indexedDB.deleteDatabase(db.name);
  }
});

async function setup() {
  const db = await openDatabase({ name: `test-${crypto.randomUUID()}` });
  opened.push(db);
  await loadAppState(db);
  const revision = await completeOnboarding(
    db,
    { myName: "하늘", partnerName: "바다", startDate: "2026-07-01", dayOffset: 1, myPhoto: null, partnerPhoto: null },
    { expectedRevision: 0, today: TODAY },
  );
  let rev = revision;
  const ctx = () => ({ expectedRevision: rev });
  const track = async <T,>(p: Promise<T>): Promise<T> => {
    const result = await p;
    rev = typeof result === "number" ? result : (result as { revision: number }).revision;
    return result;
  };
  return { db, ctx, track };
}

async function snapshot(db: CoupleDatabase) {
  return {
    couple: await db.couple.toArray(),
    settings: await db.settings.toArray(),
    anniversaries: await db.anniversaries.toArray(),
    anniversaryExceptions: await db.anniversaryExceptions.toArray(),
    memories: await db.memories.toArray(),
    photos: await db.photos.toArray(),
    onboardingDraft: await db.onboardingDraft.toArray(),
  };
}

async function occurrences(db: CoupleDatabase) {
  return generateCustomOccurrences(await db.anniversaries.toArray(), await db.anniversaryExceptions.toArray(), "2030-01-01");
}

describe("등록", () => {
  it("이름 앞뒤 공백 제거, 30자 제한, 빈 이름 차단 (CUS-002, CUS-E01)", async () => {
    const { db, ctx, track } = await setup();
    const { id } = await track(addCustomAnniversary(db, { title: "  첫 여행 ", date: "2026-08-15", repeatType: "yearly" }, ctx()));
    expect((await db.anniversaries.get(id))?.title).toBe("첫 여행");
    await expect(addCustomAnniversary(db, { title: "  ", date: "2026-08-15", repeatType: "none" }, ctx())).rejects.toBeInstanceOf(ValidationError);
    await expect(addCustomAnniversary(db, { title: "가".repeat(31), date: "2026-08-15", repeatType: "none" }, ctx())).rejects.toBeInstanceOf(ValidationError);
  });

  it("시작일 이전 차단, 과거·미래 허용 (CUS-003, CUS-007)", async () => {
    const { db, ctx, track } = await setup();
    await expect(addCustomAnniversary(db, { title: "이전", date: "2026-06-30", repeatType: "none" }, ctx())).rejects.toBeInstanceOf(ValidationError);
    await track(addCustomAnniversary(db, { title: "과거", date: "2026-07-01", repeatType: "none" }, ctx()));
    await track(addCustomAnniversary(db, { title: "미래", date: "2031-12-25", repeatType: "none" }, ctx()));
    expect(await db.anniversaries.count()).toBe(2);
  });

  it("같은 이름·날짜도 독립 ID 로 등록 (CUS-009)", async () => {
    const { db, ctx, track } = await setup();
    const a = await track(addCustomAnniversary(db, { title: "기념", date: "2026-12-01", repeatType: "none" }, ctx()));
    const b = await track(addCustomAnniversary(db, { title: "기념", date: "2026-12-01", repeatType: "none" }, ctx()));
    expect(a.id).not.toBe(b.id);
  });

  it("오래된 revision 으로 등록하면 충돌 (중복 실행 방지, CUS-E03)", async () => {
    const { db, ctx, track } = await setup();
    const stale = ctx();
    await track(addCustomAnniversary(db, { title: "기념", date: "2026-12-01", repeatType: "none" }, stale));
    await expect(addCustomAnniversary(db, { title: "기념", date: "2026-12-01", repeatType: "none" }, stale)).rejects.toBeInstanceOf(RevisionConflictError);
    expect(await db.anniversaries.count()).toBe(1);
  });
});

describe("수정", () => {
  it("일회성 수정은 ID·연결 기록 유지 (CUS-005)", async () => {
    const { db, ctx, track } = await setup();
    const { id } = await track(addCustomAnniversary(db, { title: "기념", date: "2026-12-01", repeatType: "none" }, ctx()));
    await db.memories.add(memory({ occurrenceId: `custom:${id}`, memo: "가상 메모" }));
    await track(updateOneTimeAnniversary(db, id, { title: "기념일", date: "2026-12-02" }, ctx()));
    expect(await db.anniversaries.get(id)).toMatchObject({ title: "기념일", date: "2026-12-02" });
    expect(await db.memories.get(`custom:${id}`)).toBeDefined();
  });

  it("전체 반복 수정: 월·일만 변경, 연도 변경 거부, 개별 예외 유지 (ARC-A02, 확정 세칙)", async () => {
    const { db, ctx, track } = await setup();
    const { id } = await track(addCustomAnniversary(db, { title: "첫 여행", date: "2026-08-15", repeatType: "yearly" }, ctx()));
    await track(updateAnniversaryOccurrence(db, id, 2027, { title: "제주 여행", date: "2027-08-15" }, ctx()));
    await expect(updateAnniversarySeries(db, id, { title: "첫 여행", date: "2027-08-20" }, ctx())).rejects.toBeInstanceOf(ValidationError);
    await track(updateAnniversarySeries(db, id, { title: "우리 여행", date: "2026-08-20" }, ctx()));
    const list = await occurrences(db);
    expect(list.find((o) => o.occurrenceYear === 2027)).toMatchObject({ title: "제주 여행", date: "2027-08-20" });
    expect(list.find((o) => o.occurrenceYear === 2028)).toMatchObject({ title: "우리 여행", date: "2028-08-20" });
  });

  it("해당 연도만 수정: 같은 연도 안에서만 이동, 발생 ID 유지, 차이가 없으면 override 제거 (ARC-A02)", async () => {
    const { db, ctx, track } = await setup();
    const { id } = await track(addCustomAnniversary(db, { title: "첫 여행", date: "2026-08-15", repeatType: "yearly" }, ctx()));
    await expect(updateAnniversaryOccurrence(db, id, 2027, { title: "첫 여행", date: "2028-01-02" }, ctx())).rejects.toBeInstanceOf(ValidationError);
    await track(updateAnniversaryOccurrence(db, id, 2027, { title: "첫 여행", date: "2027-09-01" }, ctx()));
    expect(await db.anniversaryExceptions.get([id, 2027])).toMatchObject({ kind: "override", overrideDate: "2027-09-01" });
    expect((await db.anniversaryExceptions.get([id, 2027]))?.overrideTitle).toBeUndefined();
    expect((await occurrences(db)).find((o) => o.occurrenceYear === 2027)?.id).toBe(`custom:${id}:2027`);
    await track(updateAnniversaryOccurrence(db, id, 2027, { title: "첫 여행", date: "2027-08-15" }, ctx()));
    expect(await db.anniversaryExceptions.get([id, 2027])).toBeUndefined();
  });

  it("시작일 이전으로 밀린 기념일은 이름만 수정 가능, 날짜 변경 시 새 시작일 이상 (ARC-A01, TC-SET-008)", async () => {
    const { db, ctx, track } = await setup();
    const { id } = await track(addCustomAnniversary(db, { title: "옛 기념", date: "2026-07-02", repeatType: "none" }, ctx()));
    await db.memories.add(memory({ occurrenceId: `custom:${id}`, memo: "가상 메모" }));
    await track(updateStartDate(db, "2026-07-05", { ...ctx(), today: TODAY }));
    expect(await db.anniversaries.get(id)).toMatchObject({ date: "2026-07-02" }); // 자동 삭제·변경 없음
    await track(updateOneTimeAnniversary(db, id, { title: "옛 기념일", date: "2026-07-02" }, ctx()));
    await expect(updateOneTimeAnniversary(db, id, { title: "옛 기념일", date: "2026-07-03" }, ctx())).rejects.toBeInstanceOf(ValidationError);
    await expect(addCustomAnniversary(db, { title: "신규", date: "2026-07-04", repeatType: "none" }, ctx())).rejects.toBeInstanceOf(ValidationError);
    expect(await db.memories.get(`custom:${id}`)).toBeDefined();
    expect(checkIntegrity(await snapshot(db))).toEqual([]);
  });

  it("일회성↔반복 유형을 바꾸는 수정 경로가 없다(일회성 ID 로 반복 수정 시도 거부)", async () => {
    const { db, ctx, track } = await setup();
    const { id } = await track(addCustomAnniversary(db, { title: "기념", date: "2026-12-01", repeatType: "none" }, ctx()));
    await expect(updateAnniversarySeries(db, id, { title: "기념", date: "2026-12-01" }, ctx())).rejects.toBeInstanceOf(IntegrityError);
  });
});

describe("삭제", () => {
  it("일회성 삭제는 연결 메모·사진을 함께 삭제하고 무결성 유지 (CUS-006, SET-017, CUS-E05)", async () => {
    const { db, ctx, track } = await setup();
    const { id } = await track(addCustomAnniversary(db, { title: "기념", date: "2026-10-01", repeatType: "none" }, ctx()));
    const p = photo({ ownerId: `custom:${id}` });
    await db.memories.add(memory({ occurrenceId: `custom:${id}`, memo: "가상 메모", coverPhotoId: p.id }));
    await db.photos.add(p);
    expect(await countLinkedRecords(db, { ids: [`custom:${id}`] })).toEqual({ memos: 1, photos: 1 });
    await track(deleteOneTimeAnniversary(db, id, ctx()));
    expect(await db.anniversaries.count()).toBe(0);
    expect(await db.memories.count()).toBe(0);
    expect(await db.photos.count()).toBe(0);
    expect(checkIntegrity(await snapshot(db))).toEqual([]);
  });

  it("해당 연도 삭제는 tombstone 으로 재생성을 막고 그 연도 기록만 삭제 (ARC-A03, DB-010)", async () => {
    const { db, ctx, track } = await setup();
    const { id } = await track(addCustomAnniversary(db, { title: "첫 여행", date: "2026-08-15", repeatType: "yearly" }, ctx()));
    await track(updateAnniversaryOccurrence(db, id, 2027, { title: "제주 여행", date: "2027-08-15" }, ctx()));
    await db.memories.bulkAdd([memory({ occurrenceId: `custom:${id}:2026`, memo: "2026" }), memory({ occurrenceId: `custom:${id}:2027`, memo: "2027" })]);
    await track(deleteAnniversaryOccurrence(db, id, 2027, ctx()));
    expect(await db.anniversaryExceptions.get([id, 2027])).toMatchObject({ kind: "cancelled" });
    expect((await occurrences(db)).map((o) => o.occurrenceYear)).not.toContain(2027);
    expect(await db.memories.get(`custom:${id}:2026`)).toBeDefined();
    expect(await db.memories.get(`custom:${id}:2027`)).toBeUndefined();
    await expect(updateAnniversaryOccurrence(db, id, 2027, { title: "x", date: "2027-08-15" }, ctx())).rejects.toBeInstanceOf(IntegrityError);
    expect(checkIntegrity(await snapshot(db))).toEqual([]);
  });

  it("전체 반복 삭제는 시리즈·예외·모든 연도 기록을 함께 삭제, 다른 기념일 기록은 유지 (ARC-A03)", async () => {
    const { db, ctx, track } = await setup();
    const a = await track(addCustomAnniversary(db, { title: "첫 여행", date: "2026-08-15", repeatType: "yearly" }, ctx()));
    const b = await track(addCustomAnniversary(db, { title: "다른", date: "2026-09-01", repeatType: "yearly" }, ctx()));
    await track(deleteAnniversaryOccurrence(db, a.id, 2028, ctx()));
    const pa = photo({ ownerId: `custom:${a.id}:2026` });
    const pb = photo({ ownerId: `custom:${b.id}:2026` });
    await db.memories.bulkAdd([
      memory({ occurrenceId: `custom:${a.id}:2026`, coverPhotoId: pa.id }),
      memory({ occurrenceId: `custom:${a.id}:2027`, memo: "메모" }),
      memory({ occurrenceId: `custom:${b.id}:2026`, coverPhotoId: pb.id }),
    ]);
    await db.photos.bulkAdd([pa, pb]);
    expect(await countLinkedRecords(db, { prefix: `custom:${a.id}:` })).toEqual({ memos: 1, photos: 1 });
    await track(deleteAnniversarySeries(db, a.id, ctx()));
    expect(await db.anniversaries.get(a.id)).toBeUndefined();
    expect(await db.anniversaryExceptions.where("seriesId").equals(a.id).count()).toBe(0);
    expect(await db.memories.where("occurrenceId").startsWith(`custom:${a.id}`).count()).toBe(0);
    expect(await db.photos.get(pb.id)).toBeDefined();
    expect(await db.memories.get(`custom:${b.id}:2026`)).toBeDefined();
    expect(checkIntegrity(await snapshot(db))).toEqual([]);
  });

  it("삭제 실패 시 기존 데이터 유지 (CUS-E06)", async () => {
    const { db, ctx, track } = await setup();
    const stale = ctx();
    const { id } = await track(addCustomAnniversary(db, { title: "기념", date: "2026-10-01", repeatType: "none" }, ctx()));
    await expect(deleteOneTimeAnniversary(db, id, stale)).rejects.toBeInstanceOf(RevisionConflictError);
    expect(await db.anniversaries.get(id)).toBeDefined();
  });
});
