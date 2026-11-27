/**
 * [LAB] 계측 카운터. /lab 페이지에서만 import 된다(일반 앱 번들 경로에서는 실행되지 않음).
 * - React 커밋: LAB_DEVTOOLS_HOOK_SCRIPT 가 센 window.__labCommits (프로덕션 빌드라 커밋 소요 시간은 측정 불가)
 * - 화면 Mount/Unmount: MountProbe (화면 요소를 감싸서 사용, AppShell 은 수정하지 않음)
 * - IndexedDB 요청: IDBObjectStore/IDBIndex 조회 메서드 호출 수
 * - Blob URL 생성/해제, <img> load(디코딩 근사), Zustand 스토어 변경
 */
import { useEffect } from "react";

type Counter = Record<string, number>;
export interface ProbeSnapshot {
  commits: number;
  mounts: Counter;
  unmounts: Counter;
  idbRequests: number;
  objectUrlCreate: number;
  objectUrlRevoke: number;
  imgLoads: number;
  storeChanges: Record<string, number>;
}

const fresh = (): Omit<ProbeSnapshot, "commits"> => ({ mounts: {}, unmounts: {}, idbRequests: 0, objectUrlCreate: 0, objectUrlRevoke: 0, imgLoads: 0, storeChanges: {} });
let state = fresh();
let commitBase = 0;
let installed = false;

const commitsNow = () => (window as unknown as { __labCommits?: number }).__labCommits ?? 0;

export function installProbe(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  for (const proto of [IDBObjectStore.prototype, IDBIndex.prototype] as unknown as Record<string, (...a: unknown[]) => unknown>[]) {
    for (const name of ["get", "getAll", "getAllKeys", "count", "openCursor", "openKeyCursor"]) {
      const original = proto[name];
      if (typeof original !== "function") continue;
      proto[name] = function (this: unknown, ...args: unknown[]) {
        state.idbRequests++;
        return original.apply(this, args);
      };
    }
  }
  const create = URL.createObjectURL.bind(URL);
  const revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (obj: Blob | MediaSource) => {
    state.objectUrlCreate++;
    return create(obj);
  };
  URL.revokeObjectURL = (url: string) => {
    state.objectUrlRevoke++;
    revoke(url);
  };
  document.addEventListener("load", (e) => e.target instanceof HTMLImageElement && state.imgLoads++, true);
}

export const probe = {
  reset(): void {
    state = fresh();
    commitBase = commitsNow();
  },
  snapshot(): ProbeSnapshot {
    return { ...JSON.parse(JSON.stringify(state)), commits: commitsNow() - commitBase };
  },
  commitHookActive(): boolean {
    return typeof (window as unknown as { __labCommits?: number }).__labCommits === "number";
  },
};

export function MountProbe({ id }: { id: string }) {
  useEffect(() => {
    state.mounts[id] = (state.mounts[id] ?? 0) + 1;
    return () => {
      state.unmounts[id] = (state.unmounts[id] ?? 0) + 1;
    };
  }, [id]);
  return null;
}

export function watchStore(name: string, store: { subscribe: (fn: () => void) => () => void }): () => void {
  return store.subscribe(() => {
    state.storeChanges[name] = (state.storeChanges[name] ?? 0) + 1;
  });
}
