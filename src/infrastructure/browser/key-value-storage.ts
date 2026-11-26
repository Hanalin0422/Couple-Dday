/**
 * localStorage 안전 어댑터. 접근 실패(사파리 개인 정보 보호 모드, 저장소 차단 등)에도 예외를 던지지 않는다.
 * 일시적·비핵심 값(축하 효과 자동 재생 이력 등)에만 사용한다. 영속 데이터의 SSOT 는 IndexedDB 이다.
 */
export interface KeyValueStorage {
  get(key: string): string | null;
  /** @returns 저장 성공 여부 */
  set(key: string, value: string): boolean;
  remove(key: string): boolean;
}

export function createLocalStorage(): KeyValueStorage {
  const storage = (): Storage | null => {
    try {
      return typeof window === "undefined" ? null : window.localStorage;
    } catch {
      return null;
    }
  };
  return {
    get(key) {
      try {
        return storage()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        const s = storage();
        if (!s) return false;
        s.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try {
        const s = storage();
        if (!s) return false;
        s.removeItem(key);
        return true;
      } catch {
        return false;
      }
    },
  };
}
