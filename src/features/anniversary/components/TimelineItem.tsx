"use client";

/**
 * 타임라인 항목 (SKILL.md §9).
 * - 지난 기념일: 흰 카드, 이름·날짜·사진 추가 아이콘(추억 등록은 Phase 6에서 연결)
 * - 다음 기념일(강조): anniversary-surface 카드, "다가오는 기념일", 이름, 우측 큰 D-N, 날짜, 하단 진행률 바
 * - 이후 기념일: 흰 카드, 이름·날짜·우측 D-N
 * - 왼쪽 연결선 위의 점: 지난 timeline-past, 이후 timeline-track, 강조 accent
 * 사용자 지정 기념일만 눌러서 수정할 수 있다(자동 기념일은 수정·삭제 불가, ANN-010).
 */
import { ImagePlus } from "lucide-react";
import { cx } from "@/components/ui/primitives";
import { formatDisplayDate } from "@/domain/date/local-date";
import type { AnniversaryOccurrence } from "@/domain/anniversary/types";

export function TimelineItem({
  occurrence,
  status,
  ddayLabel,
  highlighted,
  progress,
  onEdit,
}: {
  occurrence: AnniversaryOccurrence;
  status: "past" | "upcoming";
  ddayLabel: string | null;
  highlighted: boolean;
  progress: number | null;
  onEdit?: () => void;
}) {
  const date = formatDisplayDate(occurrence.date);
  const body = highlighted ? (
    <>
      <p className="text-ui-caption-sm font-medium text-anniversary-text">다가오는 기념일</p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-keep text-ui-section font-semibold text-text-primary">{occurrence.title}</p>
          <p className="mt-1 text-ui-caption-sm text-text-secondary tabular-nums">{date}</p>
        </div>
        <p className="shrink-0 text-ui-sheet-title font-bold text-anniversary-text tabular-nums" data-testid="highlight-dday">
          {ddayLabel}
        </p>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label="다가오는 기념일까지 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress ?? 0)}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, progress ?? 0))}%` }} />
      </div>
    </>
  ) : (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="break-keep text-ui-section font-semibold text-text-primary">{occurrence.title}</p>
        <p className="mt-1 text-ui-caption-sm text-text-secondary tabular-nums">{date}</p>
      </div>
      {status === "past" ? (
        <ImagePlus className="size-4.5 shrink-0 text-accent/70" aria-hidden="true" />
      ) : (
        <p className="shrink-0 text-ui-body font-bold text-text-primary tabular-nums">{ddayLabel}</p>
      )}
    </div>
  );

  const cardClass = cx("block w-full rounded-card p-(--card-padding) text-left", highlighted ? "bg-anniversary-surface" : "bg-surface");
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
      {onEdit ? (
        <button type="button" onClick={onEdit} className={cx(cardClass, "focus-visible:outline-2 focus-visible:outline-accent")} aria-label={`${occurrence.title} ${date} 수정`}>
          {body}
        </button>
      ) : (
        <div className={cardClass}>{body}</div>
      )}
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
