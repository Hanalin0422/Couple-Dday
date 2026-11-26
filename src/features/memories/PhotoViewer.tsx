"use client";

/**
 * 사진 확대 보기 — 전체 화면 (MEM-004, REQUIREMENTS.md §14 "사진 확대는 전체 화면").
 * 앱 프레임 overlay 영역에 표시하며, 표시 중에는 화면 전환 스와이프를 막는다(NAV-004). Esc/닫기로 종료.
 * 상세 디자인은 미확정 UI(사용자 검수 대상).
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { OVERLAY_ROOT_ID } from "@/components/layout/AppFrame";
import { useIsClient } from "@/hooks/useIsClient";
import { useObjectUrl, type StoredImage } from "@/hooks/useObjectUrl";
import { useUIStore } from "@/stores/ui-store";

export function PhotoViewer({ photos, startIndex, title, onClose }: { photos: StoredImage[]; startIndex: number; title: string; onClose: () => void }) {
  const [index, setIndex] = useState(startIndex);
  const lockGestures = useUIStore((s) => s.lockGestures);
  const isClient = useIsClient();
  const photo = photos[Math.min(index, photos.length - 1)];
  const url = useObjectUrl(photo);

  useEffect(() => lockGestures(), [lockGestures]);
  useEffect(() => {
    // 캡처 단계에서 먼저 처리하여 아래 Bottom Sheet 의 Esc 닫기가 함께 실행되지 않게 한다.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        onClose();
      }
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (event.key === "ArrowRight") setIndex((i) => Math.min(photos.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, photos.length]);

  if (!isClient || !photo) return null;
  return createPortal(
    <div className="absolute inset-0 flex flex-col bg-text-primary" role="dialog" aria-modal="true" aria-label={`${title} 사진 ${index + 1}/${photos.length}`} data-testid="photo-viewer">
      <div className="flex shrink-0 items-center justify-between px-2 pt-[calc(env(safe-area-inset-top)+8*var(--u))]">
        <span className="px-3 text-ui-caption text-surface tabular-nums">
          {index + 1} / {photos.length}
        </span>
        <button type="button" onClick={onClose} aria-label="닫기" className="flex size-touch items-center justify-center text-surface">
          <X className="size-6" aria-hidden="true" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- 로컬 이미지 바이트의 객체 URL
          <img src={url} alt={`${title} 사진 ${index + 1}`} className="absolute inset-0 h-full w-full object-contain" draggable={false} />
        )}
        {index > 0 && (
          <button type="button" aria-label="이전 사진" onClick={() => setIndex(index - 1)} className="absolute left-1 top-1/2 flex size-touch -translate-y-1/2 items-center justify-center text-surface">
            <ChevronLeft className="size-7" aria-hidden="true" />
          </button>
        )}
        {index < photos.length - 1 && (
          <button type="button" aria-label="다음 사진" onClick={() => setIndex(index + 1)} className="absolute right-1 top-1/2 flex size-touch -translate-y-1/2 items-center justify-center text-surface">
            <ChevronRight className="size-7" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="h-[calc(env(safe-area-inset-bottom)+16*var(--u))] shrink-0" />
    </div>,
    document.getElementById(OVERLAY_ROOT_ID) ?? document.body,
  );
}

/** 정사각 썸네일. */
export function PhotoThumb({ photo, label, className }: { photo: StoredImage; label: string; className?: string }) {
  const url = useObjectUrl(photo);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- 로컬 이미지 바이트의 객체 URL
    <img src={url} alt={label} loading="lazy" className={`h-full w-full object-cover ${className ?? ""}`} draggable={false} />
  ) : (
    <span className={`block h-full w-full bg-input ${className ?? ""}`} aria-hidden="true" />
  );
}
