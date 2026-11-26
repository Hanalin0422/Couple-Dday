"use client";

/**
 * DB 연결 컨텍스트와 커밋된 데이터 반응형 조회 (ARCHITECTURE.md §8: useLiveQuery 로 커밋된 DB 데이터 조회, ARC-E01).
 * 화면은 이 훅으로 읽기만 하고, 변경은 application/services 를 통해서만 한다.
 */
import { createContext, useContext, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Couple, Photo, Settings } from "@/domain/entities";
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
