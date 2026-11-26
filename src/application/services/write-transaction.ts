/**
 * 영속 변경 공통 트랜잭션 (ARCHITECTURE.md §8.1, DB-013, DB-015, ARC-E03).
 *
 * 1. 입력 검증·이미지 처리·해시 등 비동기 외부 작업은 이 함수 호출 전에 끝낸다.
 *    (IndexedDB 트랜잭션 안에서 Dexie 외 Promise 를 기다리면 트랜잭션이 자동 커밋된다.)
 * 2. settings store 를 항상 트랜잭션 범위에 포함하고, 호출자가 읽었던 revision 과 현재 revision 을 비교한다.
 * 3. work 안의 변경과 revision 증가를 하나의 트랜잭션으로 원자적으로 커밋한다. 실패 시 전체 롤백.
 * 4. 호출자는 커밋 성공(Promise resolve) 후에만 UI를 갱신한다. Optimistic Update 금지.
 */
import Dexie, { type Table } from "dexie";
import type { CoupleDatabase, StoreName } from "@/infrastructure/db/database";
import { toStorageError } from "@/infrastructure/db/database";
import { toInstant } from "@/domain/date/instant";
import { IntegrityError, RevisionConflictError } from "../errors";

export interface WriteOptions {
  /** 호출자가 변경 전에 읽은 settings.revision. 현재 값과 다르면 RevisionConflictError. */
  expectedRevision: number;
  now?: () => Date;
}

export interface WriteResult<T> {
  result: T;
  revision: number;
}

export async function runWriteTransaction<T>(
  db: CoupleDatabase,
  stores: readonly StoreName[],
  options: WriteOptions,
  work: () => Promise<T>,
): Promise<WriteResult<T>> {
  const now = options.now ?? (() => new Date());
  const tables: Table[] = [...new Set<StoreName>(["settings", ...stores])].map((name) => db.table(name));
  try {
    return await db.transaction("rw", tables, async () => {
      const current = await db.settings.get("default");
      if (!current) throw new IntegrityError([{ rule: "DB-002", store: "settings", ref: "default" }]);
      if (current.revision !== options.expectedRevision) {
        throw new RevisionConflictError(options.expectedRevision, current.revision);
      }
      const result = await work();
      // work 가 settings 를 변경했을 수 있으므로 다시 읽어 revision 만 올린다.
      const latest = (await db.settings.get("default")) ?? current;
      const revision = current.revision + 1;
      await db.settings.put({ ...latest, revision, updatedAt: toInstant(now()) });
      return { result, revision };
    });
  } catch (error) {
    // 저장소 오류(Dexie/DOMException)만 변환하고, 애플리케이션 오류는 원인을 보존해 그대로 전달한다.
    if (error instanceof Dexie.DexieError || error instanceof DOMException) throw toStorageError(error);
    throw error;
  }
}
