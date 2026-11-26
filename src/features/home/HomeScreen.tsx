"use client";

/**
 * 메인 화면 (SKILL.md §7, REQUIREMENTS.md §5 HOME-001~032).
 * 스크롤 없는 단일 화면: TOGETHER → 원형 디데이 → 두 프로필. 다음 기념일 이름·남은 일수는 표시하지 않는다.
 * 주년 표시·축하 효과로 원 크기·프로필 위치·레이아웃을 바꾸지 않는다(HOME-029).
 */
import { useMemo } from "react";
import type { Couple, LocalDate, Settings } from "@/domain/entities";
import { getHomeDdayDisplay } from "@/domain/anniversary/home-display";
import { calculateHomeProgress } from "@/domain/anniversary/progress";
import { formatDisplayDate } from "@/domain/date/local-date";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { DdayInner } from "./components/AnniversaryDdayDisplay";
import { CelebrationCanvas } from "./components/CelebrationCanvas";
import { CircularProgress } from "./components/CircularProgress";
import { CoupleProfiles } from "./components/CoupleProfiles";
import { useCelebration } from "./hooks/useCelebration";
import { celebrationTargetId } from "./utils/celebration-history";

/** 원 크기: 시안 272px, 작은 화면에서 너비·높이에 맞춰 비례 축소 (HOME-E09). */
const CIRCLE_SIZE = "min(272px, calc(100vw - 80px), calc(100dvh - 380px - env(safe-area-inset-top) - env(safe-area-inset-bottom)))";
const AVATAR_SIZE = "min(76px, 11dvh)";

export function HomeScreen({ couple, settings, today }: { couple: Couple; settings: Settings; today: LocalDate }) {
  const display = useMemo(() => getHomeDdayDisplay(couple.startDate, settings.dayOffset, today), [couple.startDate, settings.dayOffset, today]);
  const progress = useMemo(() => calculateHomeProgress(couple.startDate, settings.dayOffset, today), [couple.startDate, settings.dayOffset, today]);
  const isAnniversary = display?.type === "anniversary";
  const reducedMotion = useReducedMotion();
  const { runKey, replay, stop } = useCelebration({
    active: isAnniversary,
    targetId: isAnniversary ? celebrationTargetId(today, couple.startDate) : null,
    reducedMotion,
  });

  const startDateLabel = formatDisplayDate(couple.startDate);
  const circleLabel = display
    ? display.type === "anniversary"
      ? `우리가 함께한 지 ${display.label}, ${display.value}일째. 시작일 ${startDateLabel}. 눌러서 축하 효과 다시 보기`
      : `우리가 함께한 지 ${display.value}일. 시작일 ${startDateLabel}`
    : "기기 날짜를 확인해 주세요";

  const circleContent = (
    <div data-circle className="relative flex items-center justify-center" style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE, containerType: "inline-size" }}>
      <CircularProgress percentage={progress?.percentage ?? 0} />
      {display ? (
        <DdayInner display={display} startDateLabel={startDateLabel} />
      ) : (
        <div className="px-[12cqw] text-center" role="alert">
          <p className="text-[5.5cqw] font-semibold text-text-primary">기기 날짜를 확인해 주세요</p>
          <p className="mt-[3cqw] text-[4.6cqw] text-text-secondary">오늘 날짜가 연애 시작일보다 이전으로 설정되어 있어요.</p>
        </div>
      )}
    </div>
  );

  return (
    <main className="relative flex h-full flex-col items-center justify-center overflow-hidden px-gutter pb-[2dvh] pt-[env(safe-area-inset-top)]" aria-label="메인">
      <h1 className="sr-only">메인</h1>
      <div className="flex flex-col items-center gap-[min(32px,4dvh)]">
        <p className="mb-[min(16px,2dvh)] font-maruburi text-[18px] font-semibold tracking-[0.3em] text-accent" aria-label="TOGETHER">
          TOGETHER
        </p>
        {isAnniversary ? (
          <button type="button" onClick={replay} aria-label={circleLabel} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            {circleContent}
          </button>
        ) : (
          <div role="img" aria-label={circleLabel}>
            {circleContent}
          </div>
        )}
        <CoupleProfiles couple={couple} size={AVATAR_SIZE} />
      </div>
      {runKey !== null && <CelebrationCanvas key={runKey} onDone={stop} />}
    </main>
  );
}
