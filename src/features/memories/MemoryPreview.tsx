"use client";

/**
 * 타임라인 카드 안의 추억 미리보기 (TML-011, MEM-004, MEM-007, MEM-E12, NFR-002).
 * - 접힘: 대표 사진·사진 수·메모 두 줄. 펼침: 모든 사진 그리드(눌러서 전체 화면 보기).
 * - 화면 근처에 왔을 때만 이미지를 읽는다(지연 로딩). 사진이 없으면 임의 예시 사진을 표시하지 않는다.
 * 상세 배치는 미확정 UI(사용자 검수 대상).
 */
import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Memory } from "@/domain/entities";
import { cx } from "@/components/ui/primitives";
import { useInView } from "@/hooks/useInView";
import { useOccurrencePhotoCount, useOccurrencePhotos, usePhoto } from "@/hooks/useDatabase";
import { PhotoThumb, PhotoViewer } from "./PhotoViewer";

export function MemoryPreview({ memory, title }: { memory: Memory; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [expanded, setExpanded] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const cover = usePhoto(inView ? memory.coverPhotoId : null);
  const count = useOccurrencePhotoCount(memory.occurrenceId, inView) ?? 0;
  const photos = useOccurrencePhotos(memory.occurrenceId, inView && (expanded || viewer !== null));

  return (
    <div ref={ref} className="mt-3 flex flex-col gap-2" data-testid="memory-preview">
      {count > 0 && (
        <div className="flex items-center gap-3">
          <span className="size-12 shrink-0 overflow-hidden rounded-xl bg-input">{cover && <PhotoThumb photo={cover} label={`${title} 대표 사진`} />}</span>
          <span className="flex-1 text-ui-caption text-text-secondary">사진 {count}장</span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex min-h-touch items-center gap-1 px-2 text-ui-caption-sm font-medium text-text-secondary"
          >
            {expanded ? "접기" : "펼치기"}
            <ChevronDown className={cx("size-4 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
          </button>
        </div>
      )}
      {expanded && photos && photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2" data-testid="memory-photo-grid">
          {photos.map((photo, index) => (
            <button key={photo.id} type="button" onClick={() => setViewer(index)} aria-label={`${title} 사진 ${index + 1} 크게 보기`} className="aspect-square overflow-hidden rounded-xl">
              <PhotoThumb photo={photo} label="" />
            </button>
          ))}
        </div>
      )}
      {memory.memo.trim().length > 0 && <p className="line-clamp-2 whitespace-pre-line break-keep text-ui-caption text-text-body">{memory.memo}</p>}
      {viewer !== null && photos && photos.length > 0 && <PhotoViewer photos={photos} startIndex={viewer} title={title} onClose={() => setViewer(null)} />}
    </div>
  );
}
