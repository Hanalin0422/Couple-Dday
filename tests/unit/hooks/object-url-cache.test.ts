/**
 * 객체 URL 캐시 (NFR-002). React StrictMode 의 "실행→정리→재실행" 순서에서도 URL 이 해제되지 않아야 한다(사진 깨짐 회귀 방지).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acquireObjectUrl, objectUrlFor, releaseObjectUrl, RELEASE_DELAY_MS } from "@/hooks/object-url-cache";

describe("object-url-cache", () => {
  let revoke: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers();
    revoke = vi.spyOn(URL, "revokeObjectURL");
  });
  afterEach(() => {
    vi.useRealTimers();
    revoke.mockRestore();
  });

  const image = () => ({ data: new Uint8Array([1, 2, 3]).buffer, mimeType: "image/jpeg" });

  it("같은 이미지 데이터는 같은 URL 을 재사용한다", () => {
    const img = image();
    expect(objectUrlFor(img)).toBe(objectUrlFor(img));
    expect(objectUrlFor(img)).toMatch(/^blob:/);
  });

  it("StrictMode 순서(획득→해제→즉시 재획득)에서는 해제하지 않는다", () => {
    const img = image();
    const url = objectUrlFor(img);
    acquireObjectUrl(img.data);
    releaseObjectUrl(img.data);
    acquireObjectUrl(img.data);
    vi.advanceTimersByTime(RELEASE_DELAY_MS * 2);
    expect(revoke).not.toHaveBeenCalled();
    expect(objectUrlFor(img)).toBe(url);
  });

  it("사용하는 곳이 없어지면 지연 후 해제하고, 이후 요청 시 새 URL 을 만든다", () => {
    const img = image();
    const url = objectUrlFor(img);
    acquireObjectUrl(img.data);
    releaseObjectUrl(img.data);
    vi.advanceTimersByTime(RELEASE_DELAY_MS - 1);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revoke).toHaveBeenCalledWith(url);
    expect(objectUrlFor(img)).not.toBe(url);
  });

  it("여러 컴포넌트가 함께 쓰면 마지막 사용이 끝날 때만 해제한다", () => {
    const img = image();
    objectUrlFor(img);
    acquireObjectUrl(img.data);
    acquireObjectUrl(img.data);
    releaseObjectUrl(img.data);
    vi.advanceTimersByTime(RELEASE_DELAY_MS * 2);
    expect(revoke).not.toHaveBeenCalled();
    releaseObjectUrl(img.data);
    vi.advanceTimersByTime(RELEASE_DELAY_MS);
    expect(revoke).toHaveBeenCalledTimes(1);
  });
});
