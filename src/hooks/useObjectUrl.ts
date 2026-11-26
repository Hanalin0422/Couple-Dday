"use client";

/**
 * 저장된 이미지 바이트의 객체 URL (NFR-002: 사용 종료 시 revokeObjectURL).
 *
 * 같은 ArrayBuffer 에 대한 URL 을 캐시하고 사용 중인 컴포넌트 수를 센다. 아무도 쓰지 않게 된 뒤 잠시 기다려 해제한다.
 * React StrictMode(개발 모드)는 효과를 "실행 → 정리 → 재실행" 하므로, 정리 시 즉시 해제하면 재실행 때 이미 해제된 URL 을
 * 쓰게 되어 이미지가 깨진다(2026-11-26 수정). 지연 해제로 재사용 기회를 남긴다.
 */
import { useEffect } from "react";
import { acquireObjectUrl, objectUrlFor, releaseObjectUrl } from "./object-url-cache";

export type { StoredImage } from "./object-url-cache";
import type { StoredImage } from "./object-url-cache";

export function useObjectUrl(image: StoredImage | null | undefined): string | null {
  const data = image?.data;
  const url = image ? objectUrlFor(image) : null;
  useEffect(() => {
    if (!data) return;
    acquireObjectUrl(data);
    return () => releaseObjectUrl(data);
  }, [data]);
  return url;
}
