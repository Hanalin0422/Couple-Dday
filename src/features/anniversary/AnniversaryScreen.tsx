"use client";

/**
 * 기념일 화면 (SKILL.md §9, REQUIREMENTS.md §6~8 ANN/CUS/TML).
 * - 제목 "우리의 기념일", 우측 + 아이콘(기념일 추가). 제목과 필터는 고정, 타임라인만 세로 스크롤 (TML-008~010).
 * - 필터: 지난 날 / 전체 / 다가오는 날, 동일 너비, 기본 전체 (TML-003, TML-004).
 * - 과거→미래 세로 타임라인, 전체 필터에 "오늘 · N일째" 구분선, 최초 진입 시 오늘 근처로 자동 스크롤 (TML-001, TML-002, TML-007).
 * - 미래 자동·반복 기념일은 오늘부터 1년, 끝에 도달하면 1년씩 추가 로딩 (TML-014, ARC-C03).
 * - 가장 가까운 예정 날짜의 기념일(동일 날짜는 모두)을 강조하고 별도 진행률을 표시 (ARC-C01, ARC-C02).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { Couple, LocalDate, Settings } from "@/domain/entities";
import type { TimelineFilter } from "@/domain/anniversary/timeline";
import { PageHeader, SegmentedControl } from "@/components/ui/primitives";
import { useAnniversaryExceptions, useCustomAnniversaries, useMemories } from "@/hooks/useDatabase";
import { MemorySheet, type MemoryTarget } from "@/features/memories/MemorySheet";
import { futureEndFor, useTimelineStore } from "@/stores/timeline-store";
import { AnniversaryEditorSheet, type EditorTarget } from "./components/AnniversaryEditorSheet";
import { TimelineItem, TodayDivider } from "./components/TimelineItem";
import { buildTimeline } from "./timeline-model";

const FILTER_OPTIONS = [
  { value: "past" as TimelineFilter, label: "지난 날" },
  { value: "all" as TimelineFilter, label: "전체" },
  { value: "upcoming" as TimelineFilter, label: "다가오는 날" },
] as const;

export function AnniversaryScreen({ couple, settings, today }: { couple: Couple; settings: Settings; today: LocalDate }) {
  const series = useCustomAnniversaries();
  const exceptions = useAnniversaryExceptions();
  const filter = useTimelineStore((s) => s.filter);
  const setFilter = useTimelineStore((s) => s.setFilter);
  const extraYears = useTimelineStore((s) => s.extraYears);
  const extend = useTimelineStore((s) => s.extend);
  const resetTimeline = useTimelineStore((s) => s.reset);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [memoryTarget, setMemoryTarget] = useState<MemoryTarget | null>(null);
  const memories = useMemories();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);

  // 화면에 들어올 때마다 기본 필터(전체)와 최초 1년 범위로 시작한다 (TML-004).
  useEffect(() => resetTimeline, [resetTimeline]);

  const futureEnd = futureEndFor(today, extraYears);
  const model = useMemo(
    () =>
      series && exceptions
        ? buildTimeline({ startDate: couple.startDate, dayOffset: settings.dayOffset, today, futureEnd, filter, series, exceptions })
        : null,
    [series, exceptions, couple.startDate, settings.dayOffset, today, futureEnd, filter],
  );
  const seriesById = useMemo(() => new Map((series ?? []).map((s) => [s.id, s])), [series]);

  // 최초 진입·필터 변경 시 위치: 전체는 오늘 근처, 지난 날은 가장 최근(아래), 다가오는 날은 맨 위 (TML-007)
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || !model) return;
    const key = `${filter}|${today}`;
    if (scrolledFor.current === key) return;
    scrolledFor.current = key;
    if (filter === "past") container.scrollTop = container.scrollHeight;
    else if (filter === "upcoming") container.scrollTop = 0;
    else {
      const anchor = container.querySelector<HTMLElement>("[data-testid=today-divider]");
      container.scrollTop = anchor ? Math.max(0, anchor.offsetTop - container.clientHeight * 0.3) : 0;
    }
  }, [model, filter, today]);

  // 목록 끝에 도달하면 미래 범위를 1년 확장 (추가 로딩, 기존 항목 위치 유지)
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    // 데이터를 불러오기 전(빈 목록)에는 감시하지 않는다: 빈 목록에서 끝 표시가 보여 범위가 잘못 확장되는 것을 막는다.
    if (!sentinel || !root || filter === "past" || !model) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && extend(), { root, rootMargin: "120px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [extend, filter, model]);

  const emptyMessage = filter === "past" ? "아직 지난 기념일이 없어요." : "표시할 기념일이 없어요.";

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="우리의 기념일"
        action={
          <button
            type="button"
            aria-label="기념일 추가"
            onClick={() => setEditor({ mode: "add" })}
            className="flex size-touch items-center justify-center text-text-body focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Plus className="size-6" aria-hidden="true" />
          </button>
        }
      />
      <div className="shrink-0 px-gutter pb-4">
        <SegmentedControl label="기념일 필터" options={FILTER_OPTIONS} value={filter} onChange={setFilter} />
      </div>
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto px-gutter pb-6" data-testid="timeline-scroll">
        {model && model.entries.length === 0 ? (
          <p className="pt-10 text-center text-ui-caption text-text-secondary" role="status">
            {emptyMessage}
          </p>
        ) : (
          <div className="relative pl-8">
            <span className="absolute bottom-0 left-2 top-0 w-px bg-timeline-track" aria-hidden="true" />
            <ol className="flex flex-col gap-4" aria-label="기념일 타임라인">
              {model?.entries.map((entry) =>
                entry.type === "today" ? (
                  <TodayDivider key="today" dayCount={entry.dayCount} />
                ) : (
                  <TimelineItem
                    key={entry.occurrence.id}
                    occurrence={entry.occurrence}
                    status={entry.status}
                    ddayLabel={entry.ddayLabel}
                    highlighted={entry.highlighted}
                    progress={entry.highlighted ? (model.highlight?.progress.percentage ?? null) : null}
                    memory={memories?.get(entry.occurrence.id) ?? null}
                    canAddMemory={entry.occurrence.date <= today}
                    onOpenMemory={() => setMemoryTarget({ occurrenceId: entry.occurrence.id, title: entry.occurrence.title, date: entry.occurrence.date })}
                    onEdit={
                      entry.occurrence.kind === "custom" && seriesById.has(entry.occurrence.seriesId)
                        ? () => {
                            const occurrence = entry.occurrence;
                            if (occurrence.kind === "custom") setEditor({ mode: "edit", occurrence, series: seriesById.get(occurrence.seriesId)! });
                          }
                        : undefined
                    }
                  />
                ),
              )}
            </ol>
          </div>
        )}
        <div ref={sentinelRef} className="h-px" aria-hidden="true" />
      </div>
      <MemorySheet target={memoryTarget} today={today} onClose={() => setMemoryTarget(null)} />
      <AnniversaryEditorSheet target={editor} onClose={() => setEditor(null)} startDate={couple.startDate} today={today} revision={settings.revision} />
    </div>
  );
}
