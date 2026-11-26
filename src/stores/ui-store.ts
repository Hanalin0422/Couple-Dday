/**
 * Bottom Sheet 표시 상태 (BTS-010: 동시에 하나만, NAV-004: 표시 중 화면 전환 제스처 차단).
 */
import { create } from "zustand";

interface UIState {
  activeSheet: string | null;
  /** 사진 확대·입력 조작 등 화면 전환 제스처를 막아야 하는 상태 수 */
  gestureLocks: number;
  openSheet: (id: string) => void;
  closeSheet: (id: string) => void;
  lockGestures: () => () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeSheet: null,
  gestureLocks: 0,
  openSheet: (id) => set({ activeSheet: id }),
  closeSheet: (id) => {
    if (get().activeSheet === id) set({ activeSheet: null });
  },
  lockGestures: () => {
    set((s) => ({ gestureLocks: s.gestureLocks + 1 }));
    let released = false;
    return () => {
      if (released) return;
      released = true;
      set((s) => ({ gestureLocks: Math.max(0, s.gestureLocks - 1) }));
    };
  },
}));

export const selectGesturesBlocked = (s: UIState) => s.activeSheet !== null || s.gestureLocks > 0;
