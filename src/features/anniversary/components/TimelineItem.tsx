"use client";

/**
 * 타임라인 항목 (SKILL.md §9, TML-011~013, MEM-001, MEM-002).
 * - 지난 기념일: 흰 카드, 이름·날짜·사진 추가 아이콘. 저장된 추억은 카드에서 조회하고 사진을 접기/펼치기
 * - 다음 기념일(강조): anniversary-surface 카드, "다가오는 기념일", 이름, 우측 큰 D-N, 날짜, 하단 진행률 바
 * - 이후 기념일: 흰 카드, 이름·날짜·우측 D-N
 * - 사진 아이콘: 지난 기념일·당일(신규 등록 가능), 그리고 기록이 남아 있는 미래 기념일(조회·메모 수정)
 * - 왼쪽 연결선 위의 점: 지난 timeline-past, 이후 timeline-track, 강조 accent
 * 사용자 지정 기념일만 이름 영역을 눌러 수정할 수 있다(자동 기념일은 수정·삭제 불가, ANN-010).
 */
import { ImagePlus } from "lucide-react";
import type { Memory } from "@/domain/entities";
import { cx } from "@/components/ui/primitives";
import { formatDisplayDate } from "@/domain/date/local-date";
import type { AnniversaryOccurrence } from "@/domain/anniversary/types";
import { MemoryPreview } from "@/features/memories/MemoryPreview";

export function TimelineItem({
  occurrence,
  status,
  ddayLabel,
  highlighted,
  progress,
  memory,
  canAddMemory,
  onEdit,
  onOpenMemory,
}: {
  occurrence: AnniversaryOccurrence;
  status: "past" | "upcoming";
  ddayLabel: string | null;
  highlighted: boolean;
  progress: number | null;
  memory: Memory | null;
  /** 과거·당일 */
  canAddMemory: boolean;
  onEdit?: () => void;
  onOpenMemory: () => void;
}) {
  const date = formatDisplayDate(occurrence.date);
  const showMemoryButton = canAddMemory || memory !== null;
  const memoryButton = showMemoryButton && (
    <button
      type="button"
      onClick={onOpenMemory}
      aria-label={`${occurrence.title} ${memory ? "추억 보기" : "추억 사진 추가"}`}
      className="-m-2 flex size-touch shrink-0 items-center justify-center text-accent/70 focus-visible:outline-2 focus-visible:outline-accent"
    >
      <ImagePlus className="size-4.5" aria-hidden="true" />
    </button>
  );

  const titleBlock = (
    <>
      <p className="break-keep text-ui-section font-semibold text-text-primary">{occurrence.title}</p>
      <p className="mt-1 text-ui-caption-sm text-text-secondary tabular-nums">{date}</p>
    </>
  );
  const titleArea = onEdit ? (
    <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-accent" aria-label={`${occurrence.title} ${date} 수정`}>
      {titleBlock}
    </button>
  ) : (
    <div className="min-w-0 flex-1">{titleBlock}</div>
  );

  return (
    <li className="relative" data-testid="timeline-item" data-occurrence-id={occurrence.id} data-status={status} data-highlighted={highlighted || undefined}>
      <span
        className={cx(
          "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
          highlighted ? "size-2.5 bg-accent" : status === "past" ? "size-1.5 bg-timeline-past" : "size-1.5 bg-timeline-track",
        )}
        style={{ left: "calc(-24 * var(--u))" }}
        aria-hidden="true"
      />
      <div className={cx("rounded-card p-(--card-padding)", highlighted ? "bg-anniversary-surface" : "bg-surface")}>
        {highlighted ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-ui-caption-sm font-medium text-anniversary-text">다가오는 기념일</p>
              {memoryButton}
            </div>
            <div className="mt-1 flex items-start justify-between gap-3">
              {titleArea}
              <p className="shrink-0 text-ui-sheet-title font-bold text-anniversary-text tabular-nums" data-testid="highlight-dday">
                {ddayLabel}
              </p>
            </div>
            <div
              className="mt-3 h-1 overflow-hidden rounded-full bg-surface"
              role="progressbar"
              aria-label="다가오는 기념일까지 진행률"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress ?? 0)}
            >
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, progress ?? 0))}%` }} />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            {titleArea}
            {status === "upcoming" && <p className="shrink-0 text-ui-body font-bold text-text-primary tabular-nums">{ddayLabel}</p>}
            {memoryButton}
          </div>
        )}
        {memory && <MemoryPreview memory={memory} title={occurrence.title} />}
      </div>
    </li>
  );
}

/** 오늘 구분선 "오늘 · N일째" (TML-002). */
export function TodayDivider({ dayCount }: { dayCount: number }) {
  return (
    <li className="relative flex items-center gap-2 py-1" data-testid="today-divider" style={{ marginLeft: "calc(-20 * var(--u))" }}>
      <span className="shrink-0 text-ui-caption-sm font-semibold text-accent">오늘 · {dayCount}일째</span>
      <span className="h-px flex-1 bg-timeline-track" aria-hidden="true" />
    </li>
  );
}
