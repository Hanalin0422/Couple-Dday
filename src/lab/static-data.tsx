"use client";
/**
 * [LAB] 조건 B: 같은 화면 UI 에 정적 데이터를 주입한다. hooks/useDatabase.tsx 의 조회 훅은 이 컨텍스트가 있을 때만
 * IndexedDB 대신 여기 값을 반환한다(일반 앱에는 Provider 가 없어 항상 null → 기존 동작 그대로).
 */
import { createContext, useContext, type ReactNode } from "react";
import type { AnniversaryException, Couple, CustomAnniversary, Memory, Photo, Settings } from "@/domain/entities";

export interface StaticData {
  couple: Couple;
  settings: Settings;
  anniversaries: CustomAnniversary[];
  exceptions: AnniversaryException[];
  memories: Map<string, Memory>;
  photos: Map<string, Photo>;
}

const StaticDataContext = createContext<StaticData | null>(null);
export const useStaticData = () => useContext(StaticDataContext);
export function StaticDataProvider({ data, children }: { data: StaticData; children: ReactNode }) {
  return <StaticDataContext.Provider value={data}>{children}</StaticDataContext.Provider>;
}
