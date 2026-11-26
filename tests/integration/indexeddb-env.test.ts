/**
 * Phase 0 환경 검증: Dexie + fake-indexeddb 에서 트랜잭션 원자성(롤백)이 동작하는지 확인한다.
 * 실제 스키마(7개 store)는 Phase 3 에서 구현·테스트한다.
 */
import Dexie, { type Table } from "dexie";
import { afterEach, describe, expect, it } from "vitest";

interface Row {
  id: string;
  value: number;
}

class EnvCheckDb extends Dexie {
  rows!: Table<Row, string>;
  meta!: Table<Row, string>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ rows: "id", meta: "id" });
  }
}

const opened: EnvCheckDb[] = [];
function createDb() {
  const db = new EnvCheckDb(`env-check-${crypto.randomUUID()}`);
  opened.push(db);
  return db;
}

afterEach(async () => {
  for (const db of opened.splice(0)) await db.delete();
});

describe("IndexedDB 테스트 환경 (fake-indexeddb + Dexie)", () => {
  it("여러 store 쓰기를 하나의 트랜잭션으로 커밋한다", async () => {
    const db = createDb();
    await db.transaction("rw", db.rows, db.meta, async () => {
      await db.rows.add({ id: "a", value: 1 });
      await db.meta.put({ id: "revision", value: 1 });
    });
    expect(await db.rows.count()).toBe(1);
    expect((await db.meta.get("revision"))?.value).toBe(1);
  });

  it("트랜잭션 중 오류가 발생하면 모든 변경을 롤백한다 (NFR-006)", async () => {
    const db = createDb();
    await db.rows.add({ id: "existing", value: 0 });
    await expect(
      db.transaction("rw", db.rows, db.meta, async () => {
        await db.rows.put({ id: "existing", value: 99 });
        await db.meta.put({ id: "revision", value: 2 });
        throw new Error("의도한 실패");
      }),
    ).rejects.toThrow("의도한 실패");
    expect((await db.rows.get("existing"))?.value).toBe(0);
    expect(await db.meta.count()).toBe(0);
  });
});
