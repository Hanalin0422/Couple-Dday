"use client";

import { useEffect, useMemo } from "react";

export interface StoredImage {
  data: ArrayBuffer;
  mimeType: string;
}

/** 저장된 이미지 바이트로 객체 URL 을 만들고 변경·언마운트 시 해제한다 (NFR-002). */
export function useObjectUrl(image: StoredImage | null | undefined): string | null {
  const data = image?.data;
  const mimeType = image?.mimeType;
  const url = useMemo(() => (data && mimeType ? URL.createObjectURL(new Blob([data], { type: mimeType })) : null), [data, mimeType]);
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);
  return url;
}
