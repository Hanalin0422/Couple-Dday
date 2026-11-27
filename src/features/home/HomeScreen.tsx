"use client";

/**
 * 메인 화면 (SKILL.md §7, REQUIREMENTS.md §5 HOME-001~032).
 * 스크롤 없는 단일 화면: TOGETHER → 원형 디데이 → 두 프로필. 다음 기념일 이름·남은 일수는 표시하지 않는다.
 * 주년 표시·축하 효과로 원 크기·프로필 위치·레이아웃을 바꾸지 않는다(HOME-029).
 */
import { useMemo } from "react";
import type { Couple, LocalDate, Settings } from "@/domain/entities";
import { getCelebrationOccasion } from "@/domain/anniversary/celebration";
import { getHomeDdayDisplay } from "@/domain/anniversary/home-display";
import { calculateHomeProgress } from "@/domain/anniversary/progress";
import { formatDisplayDate } from "@/domain/date/local-date";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { DdayInner } from "./components/AnniversaryDdayDisplay";
import { CelebrationCanvas } from "./components/CelebrationCanvas";
import { CircularProgress } from "./components/CircularProgress";
import { CoupleProfiles } from "./components/CoupleProfiles";
import { useNavigationStore } from "@/stores/navigation-store";
import { useCelebration } from "./hooks/useCelebration";
import { celebrationTargetId } from "./utils/celebration-history";

/**
 * 메인 구성 (SKILL.md §7: 원형 SVG 272×272, 프로필 76px, TOGETHER 18px).
 * 별도 배율을 두지 않고 AppFrame 의 공통 반응형 단위(--u)만 사용한다. 하단 메뉴·다른 화면과 같은 기준으로 크기가 정해지며
 * 공통 단위가 프레임 높이(÷720)도 반영하므로 지원 범위의 기기에서 스크롤 없이 표시된다(HOME-012, HOME-E09).
 */
const u = (px: number) => `calc(${px} * var(--u))`;
const CIRCLE_SIZE = u(272);

export function HomeScreen({ couple, settings, today }: { couple: Couple; settings: Settings; today: LocalDate }) {
  const display = useMemo(() => getHomeDdayDisplay(couple.startDate, settings.dayOffset, today), [couple.startDate, settings.dayOffset, today]);
  const progress = useMemo(() => calculateHomeProgress(couple.startDate, settings.dayOffset, today), [couple.startDate, settings.dayOffset, today]);
  // 축하 효과 대상: 자동 주년 당일 + 100일 단위 자동 기념일 당일(HOME-022, HOME-033). 100일 단위는 일반 디데이 표시 유지.
  const occasion = useMemo(() => getCelebrationOccasion(couple.startDate, settings.dayOffset, today), [couple.startDate, settings.dayOffset, today]);
  const celebrating = occasion !== null;
  const reducedMotion = useReducedMotion();
  // 화면을 유지하는 AppShell 에서 메인을 벗어나면 재생 중인 효과를 중단·정리한다 (HOME-E23, PWA-015).
  const visible = useNavigationStore((s) => s.screen === "home");
  const { runKey, replay, stop } = useCelebration({
    active: celebrating && visible,
    targetId: celebrating ? celebrationTargetId(today, couple.startDate) : null,
    reducedMotion,
  });

  const startDateLabel = formatDisplayDate(couple.startDate);
  const circleLabel = display
    ? display.type === "anniversary"
      ? `우리가 함께한 지 ${display.label}, ${display.value}일째. 시작일 ${startDateLabel}. 눌러서 축하 효과 다시 보기`
      : `우리가 함께한 지 ${display.value}일. 시작일 ${startDateLabel}${celebrating ? ". 눌러서 축하 효과 다시 보기" : ""}`
    : "기기 날짜를 확인해 주세요";

  const circleContent = (
    <div data-circle className="relative flex items-center justify-center" style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}>
      <CircularProgress percentage={progress?.percentage ?? 0} />
      {display ? (
        <DdayInner display={display} startDateLabel={startDateLabel} />
      ) : (
        <div className="px-8 text-center" role="alert">
          <p className="text-ui-body font-semibold text-text-primary">기기 날짜를 확인해 주세요</p>
          <p className="mt-2 text-ui-caption text-text-secondary">오늘 날짜가 연애 시작일보다 이전으로 설정되어 있어요.</p>
        </div>
      )}
    </div>
  );

  return (
    <main className="relative h-full overflow-hidden" aria-label="메인">
      <h1 className="sr-only">메인</h1>
      <div className="flex h-full flex-col items-center justify-center gap-8" data-testid="home-composition">
        <p className="mb-4 font-maruburi text-ui-together font-semibold leading-[1.35] tracking-[0.3em] text-accent" aria-label="TOGETHER">
          TOGETHER
        </p>
        {celebrating ? (
          <button type="button" onClick={replay} aria-label={circleLabel} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            {circleContent}
          </button>
        ) : (
          <div role="img" aria-label={circleLabel}>
            {circleContent}
          </div>
        )}
        <CoupleProfiles couple={couple} />
      </div>
      {runKey !== null && <CelebrationCanvas key={runKey} onDone={stop} />}
    </main>
  );
}
