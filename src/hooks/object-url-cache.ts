/**
 * 이미지 바이트(ArrayBuffer)별 객체 URL 캐시와 사용 수 관리. 사용 수가 0 이 되고 잠시 후 해제한다(NFR-002).
 * React 와 무관한 순수 모듈로 분리하여 단위 테스트한다(tests/unit/hooks/object-url-cache.test.ts).
 */
export interface StoredImage {
  data: ArrayBuffer;
  mimeType: string;
}

interface Entry {
  url: string;
  users: number;
  timer: ReturnType<typeof setTimeout> | undefined;
}

export const RELEASE_DELAY_MS = 1_000;
const cache = new WeakMap<ArrayBuffer, Entry>();

export function objectUrlFor(image: StoredImage): string {
  let entry = cache.get(image.data);
  if (!entry) {
    entry = { url: URL.createObjectURL(new Blob([image.data], { type: image.mimeType })), users: 0, timer: undefined };
    cache.set(image.data, entry);
  }
  return entry.url;
}

export function acquireObjectUrl(data: ArrayBuffer): void {
  const entry = cache.get(data);
  if (!entry) return;
  clearTimeout(entry.timer);
  entry.timer = undefined;
  entry.users += 1;
}

export function releaseObjectUrl(data: ArrayBuffer): void {
  const entry = cache.get(data);
  if (!entry) return;
  entry.users = Math.max(0, entry.users - 1);
  if (entry.users > 0) return;
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    if (entry.users === 0) {
      URL.revokeObjectURL(entry.url);
      cache.delete(data);
    }
  }, RELEASE_DELAY_MS);
}

