/**
 * 현재 현지 날짜 (ARCHITECTURE.md §8 useDateStore). 앱 실행·복귀·자정에 갱신한다.
 * SSR 중에는 값이 없으며(null) 클라이언트 마운트 후 설정된다.
 */
import { create } from "zustand";
import type { LocalDate } from "@/domain/entities";

interface DateState {
  today: LocalDate | null;
  setToday: (today: LocalDate) => void;
}

export const useDateStore = create<DateState>((set, get) => ({
  today: null,
  setToday: (today) => {
    if (get().today !== today) set({ today });
  },
}));
