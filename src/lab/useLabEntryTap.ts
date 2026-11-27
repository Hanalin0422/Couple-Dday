"use client";
/**
 * [LAB] 홈 화면 앱(Standalone PWA)에서 주소창 없이 /lab 에 들어가기 위한 숨은 진입: 설정 제목 "설정"을 3초 안에 7번 탭.
 * 화면·디자인은 바뀌지 않는다. 전체 새로고침으로 이동한다(일반 앱과 계측 코드를 섞지 않음).
 */
import { useCallback, useRef } from "react";
import { LAB_PATH } from "./config";

export function useLabEntryTap(): () => void {
  const taps = useRef<number[]>([]);
  return useCallback(() => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 3000), now];
    if (taps.current.length >= 7) {
      taps.current = [];
      location.assign(LAB_PATH);
    }
  }, []);
}
