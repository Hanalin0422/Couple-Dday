"use client";

/**
 * 단일 AppShell (ARC-C05, ARCHITECTURE.md §12): 설정 / 메인 / 기념일을 URL 라우팅 없이 전환한다.
 * - 공통 콘텐츠 영역(하단 메뉴 위 전체)과 하단 메뉴를 관리한다. 하단 메뉴는 화면 전환과 무관하게 같은 크기·위치를 유지한다.
 * - 메인은 콘텐츠 영역 안에서 스크롤 없이, 설정·기념일은 각 화면의 지정 영역만 스크롤한다.
 * - 하단 메뉴 터치와 좌우 스와이프 모두 지원 (NAV-002). 양 끝에서는 이동하지 않는다 (ARC-C04).
 * - Sheet·사진 확대·입력 조작 중에는 스와이프를 막는다 (NAV-004). 임계값 60px 은 초기 제안값(§17).
 */
import type { ReactNode } from "react";
import { motion, type PanInfo } from "motion/react";
import { selectGesturesBlocked, useUIStore } from "@/stores/ui-store";
import { useNavigationStore, type Screen } from "@/stores/navigation-store";
import { BottomNavigation } from "./BottomNavigation";

export const SWIPE_THRESHOLD_PX = 60;
const SWIPE_VELOCITY = 500;

export function AppShell({ screens }: { screens: Record<Screen, ReactNode> }) {
  const screen = useNavigationStore((s) => s.screen);
  const direction = useNavigationStore((s) => s.direction);
  const step = useNavigationStore((s) => s.step);
  const blocked = useUIStore(selectGesturesBlocked);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (Math.abs(offset.x) < Math.abs(offset.y)) return;
    if (offset.x <= -SWIPE_THRESHOLD_PX || velocity.x <= -SWIPE_VELOCITY) step("next");
    else if (offset.x >= SWIPE_THRESHOLD_PX || velocity.x >= SWIPE_VELOCITY) step("prev");
  };

  return (
    <div className="flex h-full flex-col" data-testid="app-shell">
      <div className="relative min-h-0 flex-1 overflow-hidden" data-testid="screen-area">
        {/* 이전 화면은 즉시 언마운트하여 애니메이션·타이머 등 실행 리소스를 정리한다(HOME-E23). 새 화면만 짧게 슬라이드 인. */}
        <motion.div
          key={screen}
          className="absolute inset-0"
          data-screen={screen}
          initial={direction === 0 ? false : { x: `${direction * 16}%`, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "tween", duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          drag={blocked ? false : "x"}
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          dragSnapToOrigin
          onDragEnd={onDragEnd}
        >
          {screens[screen]}
        </motion.div>
      </div>
      <BottomNavigation />
    </div>
  );
}
