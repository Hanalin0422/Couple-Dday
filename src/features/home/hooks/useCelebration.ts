"use client";

/**
 * 축하 효과 재생 제어 (HOME-022~028, HOME-E20~E26, PWA-015).
 * - 자동 주년 당일 및 100일 단위 자동 기념일 당일 최초 메인 진입 시 1회 자동 재생(모션 감소 설정이면 자동 재생 생략).
 * - 원형 터치로 수동 재생(모션 감소 설정에서도 허용, 2026-11-26 사용자 승인). 재생 중 재터치 시 처음부터 다시.
 * - 앱 백그라운드 전환·대상 날짜 종료(자정)·화면 이탈(메인이 보이지 않게 됨: active=false) 시 중단.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createLocalStorage } from "@/infrastructure/browser/key-value-storage";
import { createCelebrationHistory } from "../utils/celebration-history";

const history = createCelebrationHistory(createLocalStorage());

/** 전체 데이터 초기화 시 축하 효과 자동 재생 이력도 제거한다 (ARCHITECTURE.md §8, RST-006). */
export function clearCelebrationHistory(): void {
  history.clear();
}

export function useCelebration({ active, targetId, reducedMotion }: { active: boolean; targetId: string | null; reducedMotion: boolean }) {
  const [run, setRun] = useState<{ id: number; target: string } | null>(null);
  // 비활성(메인을 벗어남 등)이 되면 재생 상태를 버린다: 다시 활성화돼도 이어서 재생하지 않는다 (HOME-E21, HOME-E23).
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) setRun(null);
  }

  useEffect(() => {
    if (!active || !targetId || reducedMotion) return;
    // 렌더와 분리된 다음 프레임에 판정·기록하여 이력 기록과 재생 시작을 원자적으로 처리한다.
    const frame = requestAnimationFrame(() => {
      if (!history.shouldAutoPlay(targetId)) return;
      history.markAutoPlayed(targetId);
      setRun({ id: Date.now(), target: targetId });
    });
    return () => cancelAnimationFrame(frame);
  }, [active, targetId, reducedMotion]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") setRun(null);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const replay = useCallback(() => {
    if (active && targetId) setRun({ id: Date.now(), target: targetId });
  }, [active, targetId]);

  const stop = useCallback(() => setRun(null), []);

  // 주년이 아니게 되면(자정 경과 등) 재생 상태를 무효화한다.
  const runKey = useMemo(() => (run && active && run.target === targetId ? run.id : null), [run, active, targetId]);

  return { runKey, replay, stop };
}
