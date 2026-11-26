/**
 * Dexie 스키마 v1 통합 테스트 (ARCHITECTURE.md §5.1, TC-MEM-003 인덱스 부분, TC-DB-007, TC-DB-008).
 */
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase, STORE_NAMES, StorageError, type CoupleDatabase } from "@/infrastructure/db/database";
import { photo, settings } from "../../fixtures/entities";

const opened: CoupleDatabase[] = [];
async function freshDb() {
  const db = await openDatabase({ name: `test-${crypto.randomUUID()}` });
  opened.push(db);
  return db;
}

afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await indexedDB.deleteDatabase(db.name);
  }
});

describe("스키마 v1", () => {
  it("7개 store 와 명세의 인덱스를 생성한다", async () => {
    const db = await freshDb();
    expect(db.tables.map((t) => t.name).sort()).toEqual([...STORE_NAMES].sort());
    const photos = db.table("photos").schema;
    expect(photos.primKey.keyPath).toBe("id");
    const unique = photos.indexes.find((i) => i.name === "[ownerType+ownerId+sourceHash]");
    expect(unique?.unique).toBe(true);
    expect(photos.indexes.map((i) => i.name)).toEqual(
      expect.arrayContaining(["[ownerType+ownerId]", "[ownerType+ownerId+sortOrder]", "[ownerType+ownerId+sourceHash]"]),
    );
    expect(db.table("anniversaryExceptions").schema.primKey.keyPath).toEqual(["seriesId", "occurrenceYear"]);
  });

  it("Blob 사진을 저장·조회한다 (MEM-006)", async () => {
    const db = await freshDb();
    const p = photo();
    await db.photos.add(p);
    const loaded = await db.photos.get(p.id);
    expect(loaded?.blob).toBeInstanceOf(Blob);
    expect(loaded?.blob.size).toBe(p.size);
    expect(new Uint8Array(await loaded!.blob.arrayBuffer())).toEqual(new Uint8Array(await p.blob.arrayBuffer()));
  });

  it("같은 소유자 내 동일 sourceHash 는 unique 인덱스로 차단, 다른 소유자는 허용 (DB-008, ARC-B01)", async () => {
    const db = await freshDb();
    const first = photo({ ownerId: "auto:day:100" });
    await db.photos.add(first);
    await expect(db.photos.add(photo({ ownerId: "auto:day:100", sourceHash: first.sourceHash, sortOrder: 1 }))).rejects.toMatchObject({
      name: "ConstraintError",
    });
    await expect(db.photos.add(photo({ ownerId: "auto:day:200", sourceHash: first.sourceHash }))).resolves.toBeDefined();
    expect(await db.photos.count()).toBe(2);
  });

  it("소유자별 사진을 순서대로 조회한다", async () => {
    const db = await freshDb();
    await db.photos.bulkAdd([photo({ sortOrder: 2 }), photo({ sortOrder: 0 }), photo({ sortOrder: 1 }), photo({ ownerId: "auto:day:200" })]);
    const ordered = await db.photos
      .where("[ownerType+ownerId+sortOrder]")
      .between(["memory", "auto:day:100", 0], ["memory", "auto:day:100", Infinity])
      .toArray();
    expect(ordered.map((p) => p.sortOrder)).toEqual([0, 1, 2]);
  });
});

describe("연결 오류 처리 (자동 삭제 금지)", () => {
  it("더 높은 버전의 DB 가 있으면 VersionError 를 StorageError(version)로 알리고 데이터를 보존한다 (TC-DB-007)", async () => {
    const name = `test-${crypto.randomUUID()}`;
    // 미래 버전 앱이 v20 으로 만든 DB 를 흉내낸다(Dexie 내부 버전 = 선언 버전 × 10).
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(name, 20);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("settings", { keyPath: "id" });
        store.put(settings({ revision: 7 }));
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    const error = await openDatabase({ name }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StorageError);
    expect((error as StorageError).kind).toBe("version");

    const after = await new Promise<{ revision: number; version: number; stores: string[] }>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => {
        const idb = request.result;
        const get = idb.transaction("settings").objectStore("settings").get("default");
        get.onsuccess = () => {
          resolve({ revision: get.result.revision, version: idb.version, stores: Array.from(idb.objectStoreNames) });
          idb.close();
        };
        get.onerror = () => reject(get.error);
      };
    });
    // 데이터·버전·store 구성 모두 변경 없음 (구버전 앱이 신버전 DB 를 수정하지 않음)
    expect(after).toEqual({ revision: 7, version: 20, stores: ["settings"] });
    await indexedDB.deleteDatabase(name);
  });

  it("다른 탭의 버전 업그레이드 시 연결을 닫고 콜백으로 알린다 (§5.3)", async () => {
    const name = `test-${crypto.randomUUID()}`;
    let notified = false;
    const db = await openDatabase({ name, onVersionChange: () => (notified = true) });
    await new Promise<void>((resolve) => {
      const request = indexedDB.open(name, 30);
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
    });
    expect(notified).toBe(true);
    expect(db.isOpen()).toBe(false);
    await indexedDB.deleteDatabase(name);
  });
});
