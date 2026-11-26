"use client";

/**
 * 하단 내비게이션 (SKILL.md §5, NAV-001, HOME-013).
 * 순서 설정 / 하트 / 기념일. 가운데 하트는 글씨 없음. 활성 하트 accent, 활성 설정·기념일은 짙은 본문색, 비활성 icon-inactive.
 * 높이·아이콘·글자는 공통 반응형 토큰(--nav-h, --icon-nav, --fs-nav)을 따르며 터치 영역은 최소 44px.
 * 하단 Safe Area 를 이 영역에서 반영한다.
 */
import type { ReactNode } from "react";
import { CalendarFilledIcon, GearFilledIcon, HeartFilledIcon } from "@/components/ui/icons";
import { cx } from "@/components/ui/primitives";
import { useNavigationStore, type Screen } from "@/stores/navigation-store";

export function BottomNavigation() {
  const screen = useNavigationStore((s) => s.screen);
  const navigate = useNavigationStore((s) => s.navigate);

  const item = (target: Screen, label: string, icon: ReactNode, showLabel: boolean) => {
    const active = screen === target;
    return (
      <button
        type="button"
        onClick={() => navigate(target)}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className="flex h-nav min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className={cx("flex", target === "home" ? (active ? "text-accent" : "text-icon-inactive") : active ? "text-text-body" : "text-icon-inactive")}>
          {icon}
        </span>
        {showLabel && <span className={cx("text-ui-nav font-medium leading-none", active ? "text-text-body" : "text-text-inactive")}>{label}</span>}
      </button>
    );
  };

  return (
    <nav aria-label="주요 화면" className="relative z-20 shrink-0 rounded-t-sheet bg-surface px-gutter pb-[env(safe-area-inset-bottom)]" data-testid="bottom-navigation">
      <div className="flex">
        {item("settings", "설정", <GearFilledIcon className="size-(--icon-nav)" />, true)}
        {item("home", "메인", <HeartFilledIcon className="size-(--icon-nav-heart)" />, false)}
        {item("anniversary", "기념일", <CalendarFilledIcon className="size-(--icon-nav)" />, true)}
      </div>
    </nav>
  );
}
