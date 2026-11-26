/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * 앱 리소스 캐시 전용 Service Worker.
 * 개인 데이터(IndexedDB)는 다루지 않는다. 외부 요청/분석 스크립트 없음.
 * skipWaiting/clientsClaim 은 저장·복원 중 강제 교체를 막기 위해 비활성화하며,
 * 안전한 업데이트 활성화 흐름은 Phase 8에서 구현한다.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: { ignoreURLParametersMatching: [/.*/] },
  skipWaiting: false,
  clientsClaim: false,
  navigationPreload: false,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
