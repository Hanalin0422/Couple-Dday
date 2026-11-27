"use client";

/**
 * DB 연결 컨텍스트와 커밋된 데이터 반응형 조회 (ARCHITECTURE.md §8: useLiveQuery 로 커밋된 DB 데이터 조회, ARC-E01).
 * 화면은 이 훅으로 읽기만 하고, 변경은 application/services 를 통해서만 한다.
 */
import { createContext, useContext, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { AnniversaryException, Couple, CustomAnniversary, Memory, Photo, Settings } from "@/domain/entities";
import type { CoupleDatabase } from "@/infrastructure/db/database";

const DatabaseContext = createContext<CoupleDatabase | null>(null);

export function DatabaseProvider({ db, children }: { db: CoupleDatabase; children: ReactNode }) {
  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): CoupleDatabase {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error("DatabaseProvider 밖에서 useDatabase 를 사용했습니다.");
  return db;
}

/** undefined = 조회 중, null = 없음 */
export function useCouple(): Couple | null | undefined {
  const db = useDatabase();
  return useLiveQuery(async () => (await db.couple.get("default")) ?? null, [db]);
}

export function useSettings(): Settings | null | undefined {
  const db = useDatabase();
  return useLiveQuery(async () => (await db.settings.get("default")) ?? null, [db]);
}

export function usePhoto(id: string | null | undefined): Photo | null | undefined {
  const db = useDatabase();
  return useLiveQuery(async () => (id ? ((await db.photos.get(id)) ?? null) : null), [db, id]);
}

export function useCustomAnniversaries(): CustomAnniversary[] | undefined {
  const db = useDatabase();
  return useLiveQuery(() => db.anniversaries.toArray(), [db]);
}

export function useAnniversaryExceptions(): AnniversaryException[] | undefined {
  const db = useDatabase();
  return useLiveQuery(() => db.anniversaryExceptions.toArray(), [db]);
}

/** 모든 추억 레코드(메모·대표 사진 ID, 이미지 바이트 미포함). */
export function useMemories(): Map<string, Memory> | undefined {
  const db = useDatabase();
  return useLiveQuery(async () => new Map((await db.memories.toArray()).map((m) => [m.occurrenceId, m])), [db]);
}

/** 발생 건의 사진(순서대로). enabled=false 이면 조회하지 않는다(이미지 지연 로딩, NFR-002). */
export function useOccurrencePhotos(occurrenceId: string, enabled = true): Photo[] | undefined {
  const db = useDatabase();
  return useLiveQuery(
    async () =>
      enabled
        ? db.photos.where("[ownerType+ownerId+sortOrder]").between(["memory", occurrenceId, 0], ["memory", occurrenceId, Infinity]).toArray()
        : [],
    [db, occurrenceId, enabled],
  );
}

/** 발생 건의 사진 수 (이미지 바이트를 읽지 않음). */
export function useOccurrencePhotoCount(occurrenceId: string, enabled = true): number | undefined {
  const db = useDatabase();
  return useLiveQuery(async () => (enabled ? db.photos.where("[ownerType+ownerId]").equals(["memory", occurrenceId]).count() : 0), [db, occurrenceId, enabled]);
}
