/**
 * 공통 쓰기 트랜잭션: revision 증가·충돌 검사·원자성 (DB-013, DB-015, TC-DB-004, TC-DB-006, TC-SET-005 일부, TC-ENV-002).
 */
import { afterEach, describe, expect, it } from "vitest";
import { IntegrityError, RevisionConflictError, ValidationError } from "@/application/errors";
import { runWriteTransaction } from "@/application/services/write-transaction";
import { openDatabase, StorageError, type CoupleDatabase } from "@/infrastructure/db/database";
import { anniversary, couple, memory, photo, settings } from "../../fixtures/entities";

const opened: CoupleDatabase[] = [];
async function open(name: string) {
  const db = await openDatabase({ name });
  opened.push(db);
  return db;
}
async function seededDb(name = `test-${crypto.randomUUID()}`) {
  const db = await open(name);
  await db.settings.put(settings({ revision: 0 }));
  await db.couple.put(couple());
  return db;
}

afterEach(async () => {
  const names = new Set(opened.map((db) => db.name));
  for (const db of opened.splice(0)) db.close();
  for (const name of names) await indexedDB.deleteDatabase(name);
});

const fixedNow = () => new Date("2026-11-26T01:02:03.000Z");

describe("runWriteTransaction", () => {
  it("변경과 revision 증가를 함께 커밋하고 updatedAt 을 갱신한다 (DB-015)", async () => {
    const db = await seededDb();
    const { revision, result } = await runWriteTransaction(db, ["anniversaries"], { expectedRevision: 0, now: fixedNow }, async () => {
      await db.anniversaries.add(anniversary());
      return "added";
    });
    expect(result).toBe("added");
    expect(revision).toBe(1);
    expect(await db.settings.get("default")).toMatchObject({ revision: 1, updatedAt: "2026-11-26T01:02:03.000Z" });
    expect(await db.anniversaries.count()).toBe(1);
  });

  it("오래된 revision 으로 쓰면 충돌로 거부하고 아무것도 바꾸지 않는다 (TC-DB-006)", async () => {
    const db = await seededDb();
    await runWriteTransaction(db, ["couple"], { expectedRevision: 0 }, async () => {
      await db.couple.update("default", { myName: "새이름" });
    });
    const error = await runWriteTransaction(db, ["couple"], { expectedRevision: 0 }, async () => {
      await db.couple.update("default", { myName: "덮어쓰기" });
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RevisionConflictError);
    expect(error).toMatchObject({ expected: 0, actual: 1 });
    expect((await db.couple.get("default"))?.myName).toBe("새이름");
    expect((await db.settings.get("default"))?.revision).toBe(1);
  });

  it("두 연결(탭)이 같은 revision 으로 동시에 쓰면 하나만 성공한다 (PWA-E05)", async () => {
    const name = `test-${crypto.randomUUID()}`;
    const tabA = await seededDb(name);
    const tabB = await open(name);
    const results = await Promise.allSettled([
      runWriteTransaction(tabA, ["couple"], { expectedRevision: 0 }, async () => {
        await tabA.couple.update("default", { myName: "탭A" });
      }),
      runWriteTransaction(tabB, ["couple"], { expectedRevision: 0 }, async () => {
        await tabB.couple.update("default", { myName: "탭B" });
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(RevisionConflictError);
    expect((await tabA.settings.get("default"))?.revision).toBe(1);
  });

  it("작업 중 오류가 나면 모든 store 변경과 revision 증가를 롤백하고 원래 오류를 전달한다 (TC-DB-004, DB-013)", async () => {
    const db = await seededDb();
    const error = await runWriteTransaction(db, ["anniversaries", "memories", "photos"], { expectedRevision: 0 }, async () => {
      await db.anniversaries.add(anniversary());
      await db.memories.add(memory());
      await db.photos.add(photo());
      throw new ValidationError(["의도한 실패"]);
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(await db.anniversaries.count()).toBe(0);
    expect(await db.memories.count()).toBe(0);
    expect(await db.photos.count()).toBe(0);
    expect((await db.settings.get("default"))?.revision).toBe(0);
  });

  it("IndexedDB 제약 위반은 StorageError(constraint)로 변환하고 롤백한다", async () => {
    const db = await seededDb();
    const first = photo();
    await db.photos.add(first);
    const error = await runWriteTransaction(db, ["photos", "memories"], { expectedRevision: 0 }, async () => {
      await db.memories.add(memory());
      await db.photos.add(photo({ sourceHash: first.sourceHash, sortOrder: 1 }));
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StorageError);
    expect((error as StorageError).kind).toBe("constraint");
    expect(await db.memories.count()).toBe(0);
    expect((await db.settings.get("default"))?.revision).toBe(0);
  });

  it("작업이 settings 를 바꿔도 그 변경을 유지하며 revision 만 올린다", async () => {
    const db = await seededDb();
    await runWriteTransaction(db, [], { expectedRevision: 0 }, async () => {
      await db.settings.update("default", { dayOffset: 0 });
    });
    expect(await db.settings.get("default")).toMatchObject({ dayOffset: 0, revision: 1 });
  });

  it("settings 레코드가 없으면 쓰지 않고 무결성 오류 (DB-002)", async () => {
    const db = await open(`test-${crypto.randomUUID()}`);
    const error = await runWriteTransaction(db, ["couple"], { expectedRevision: 0 }, async () => {
      await db.couple.put(couple());
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(IntegrityError);
    expect(await db.couple.count()).toBe(0);
  });

  it("연속 쓰기마다 revision 이 1씩 증가한다", async () => {
    const db = await seededDb();
    let revision = 0;
    for (let i = 0; i < 3; i++) {
      ({ revision } = await runWriteTransaction(db, ["couple"], { expectedRevision: revision }, async () => {
        await db.couple.update("default", { myName: `이름${i}` });
      }));
    }
    expect(revision).toBe(3);
  });
});
