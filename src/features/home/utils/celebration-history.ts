/**
 * 주년 축하 효과 자동 재생 이력 (ARCHITECTURE.md §8 "주년 축하 애니메이션 상태 관리", HOME-023, HOME-E20, HOME-E29).
 *
 * - localStorage 별도 키에 "마지막 자동 재생 대상(현지 날짜 + 시작일)"을 저장한다. IndexedDB 스키마를 변경하지 않는다.
 *   대상 날짜는 자동 주년 또는 100일 단위 자동 기념일 당일(HOME-033)이다.
 * - 자동 재생 직전에 기록한다. 수동 재생은 이력을 바꾸지 않는다.
 * - localStorage 접근이 실패해도 현재 실행 세션 안에서는 중복 자동 재생을 막는다.
 * - 사용자 추억 데이터가 아니므로 백업에 포함하지 않으며, 전체 초기화 시 clear() 로 제거한다.
 */
import type { LocalDate } from "@/domain/entities";
import type { KeyValueStorage } from "@/infrastructure/browser/key-value-storage";

export const CELEBRATION_STORAGE_KEY = "couple-dday:celebration:last-auto-played";

export function celebrationTargetId(anniversaryDate: LocalDate, startDate: LocalDate): string {
  return `${anniversaryDate}|${startDate}`;
}

export interface CelebrationHistory {
  shouldAutoPlay(targetId: string): boolean;
  markAutoPlayed(targetId: string): void;
  clear(): void;
}

export function createCelebrationHistory(storage: KeyValueStorage): CelebrationHistory {
  const playedThisSession = new Set<string>();
  return {
    shouldAutoPlay(targetId) {
      if (playedThisSession.has(targetId)) return false;
      return storage.get(CELEBRATION_STORAGE_KEY) !== targetId;
    },
    markAutoPlayed(targetId) {
      playedThisSession.add(targetId);
      storage.set(CELEBRATION_STORAGE_KEY, targetId);
    },
    clear() {
      playedThisSession.clear();
      storage.remove(CELEBRATION_STORAGE_KEY);
    },
  };
}
