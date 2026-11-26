/**
 * 화면 선택 (ARCHITECTURE.md §8, §12). 단일 AppShell 안에서 설정 / 메인 / 기념일을 전환한다(ARC-C05).
 * 일시적 UI 상태이므로 영속화하지 않는다. 앱 시작 시 항상 메인(HOME-001).
 */
import { create } from "zustand";

export const SCREENS = ["settings", "home", "anniversary"] as const;
export type Screen = (typeof SCREENS)[number];

interface NavigationState {
  screen: Screen;
  /** 직전 전환 방향(슬라이드 애니메이션용): -1 왼쪽 화면으로, 1 오른쪽 화면으로 */
  direction: -1 | 0 | 1;
  navigate: (screen: Screen) => void;
  /** 스와이프: 'next' = 오른쪽 화면, 'prev' = 왼쪽 화면. 양 끝에서는 이동하지 않는다(ARC-C04). */
  step: (to: "next" | "prev") => void;
  reset: () => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  screen: "home",
  direction: 0,
  navigate: (screen) => {
    const current = SCREENS.indexOf(get().screen);
    const target = SCREENS.indexOf(screen);
    if (current === target) return;
    set({ screen, direction: target > current ? 1 : -1 });
  },
  step: (to) => {
    const index = SCREENS.indexOf(get().screen) + (to === "next" ? 1 : -1);
    if (index < 0 || index >= SCREENS.length) return;
    set({ screen: SCREENS[index], direction: to === "next" ? 1 : -1 });
  },
  reset: () => set({ screen: "home", direction: 0 }),
}));
