"use client";

/**
 * 단일 AppShell (ARC-C05, ARCHITECTURE.md §12.2): 설정 / 메인 / 기념일을 URL 라우팅 없이 전환한다.
 * 브라우저 기본 가로 스크롤 + CSS Scroll Snap 방식(2026-11-27, Motion 드래그 방식 대체).
 * - 세 화면을 가로로 연속 배치하고, 손가락 추적·관성·정렬은 브라우저 스크롤 엔진이 처리한다(JS 애니메이션·opacity·will-change 없음).
 * - scroll-snap-stop: always 로 한 번에 한 화면씩만 이동, overscroll-behavior-x: none 으로 양 끝 튕김·배경 노출 방지.
 * - 하단 메뉴 선택 상태는 실제 스크롤 위치에서 가장 가까운 화면으로 동기화한다(스크롤 중 화면 절반을 넘으면 변경).
 * - 하단 메뉴 터치: 해당 화면으로 scrollTo(모션 감소 설정이면 즉시). 이동 중 사용자가 다시 터치하면 사용자 조작을 우선한다.
 * - 수직 스크롤(설정·기념일 내부)과의 축 판정은 브라우저가 처리한다.
 * - Sheet·사진 확대 등 제스처 차단 상태에서는 가로 스크롤을 막는다(overflow-x: hidden, NAV-004).
 * - 화면은 전환 때마다 다시 만들지 않는다(데이터 구독·사진 URL·화면별 스크롤 위치 유지). 처음에는 메인만 렌더링하고
 *   첫 표시 후 유휴 시점에 나머지를 렌더링한다. 현재 화면이 아닌 화면은 inert·aria-hidden(보조기기·포커스 제외).
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { selectGesturesBlocked, useUIStore } from "@/stores/ui-store";
import { SCREENS, useNavigationStore, type Screen } from "@/stores/navigation-store";
import { BottomNavigation } from "./BottomNavigation";

const nearestIndex = (scroller: HTMLElement) =>
  Math.min(SCREENS.length - 1, Math.max(0, Math.round(scroller.scrollLeft / Math.max(1, scroller.clientWidth))));

export function AppShell({ screens }: { screens: Record<Screen, ReactNode> }) {
  const screen = useNavigationStore((s) => s.screen);
  const blocked = useUIStore(selectGesturesBlocked);
  const reducedMotion = useReducedMotion();
  const index = SCREENS.indexOf(screen);
  const scrollerRef = useRef<HTMLDivElement>(null);
  /** 하단 메뉴로 시작한 이동의 목표 화면. 도착 전 중간 화면을 지나며 선택 상태가 흔들리지 않게 한다. */
  const programmaticTarget = useRef<number | null>(null);

  const [mountedAll, setMountedAll] = useState(false);
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => setMountedAll(true), { timeout: 600 });
    return () => cancel(handle);
  }, []);

  // 스크롤 위치 → 선택 상태 동기화. 사용자가 터치하면 진행 중인 하단 메뉴 이동보다 사용자 조작을 우선한다.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onScroll = () => {
      const target = programmaticTarget.current;
      if (target !== null) {
        if (Math.abs(scroller.scrollLeft - target * scroller.clientWidth) > 1) return; // 하단 메뉴 이동 중
        programmaticTarget.current = null;
      }
      const nearest = SCREENS[nearestIndex(scroller)];
      const store = useNavigationStore.getState();
      if (store.screen !== nearest) store.navigate(nearest);
    };
    const onUserInput = () => {
      programmaticTarget.current = null;
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("touchstart", onUserInput, { passive: true });
    scroller.addEventListener("wheel", onUserInput, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("touchstart", onUserInput);
      scroller.removeEventListener("wheel", onUserInput);
    };
  }, []);

  // 선택 상태 → 스크롤 위치 (하단 메뉴 터치·외부 navigate/reset). 스크롤로 바뀐 선택(이미 가장 가까운 화면)이면 그대로 둔다.
  const firstRun = useRef(true);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const first = firstRun.current;
    firstRun.current = false;
    if (!first && programmaticTarget.current === null && nearestIndex(scroller) === index) return;
    const instant = first || reducedMotion;
    programmaticTarget.current = instant ? null : index;
    scroller.scrollTo({ left: index * scroller.clientWidth, behavior: instant ? "instant" : "smooth" });
  }, [index, reducedMotion]);

  // 회전·창 크기 변경: 현재 화면 위치 유지
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let lastWidth = scroller.clientWidth;
    const observer = new ResizeObserver(() => {
      const width = scroller.clientWidth;
      if (width === lastWidth) return;
      lastWidth = width;
      programmaticTarget.current = null;
      scroller.scrollTo({ left: SCREENS.indexOf(useNavigationStore.getState().screen) * width, behavior: "instant" });
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex h-full flex-col" data-testid="app-shell">
      <div
        ref={scrollerRef}
        className="relative flex min-h-0 flex-1 snap-x snap-mandatory overflow-y-hidden bg-background [overscroll-behavior-x:none]"
        style={{ overflowX: blocked ? "hidden" : "auto" }}
        data-testid="screen-area"
      >
        {SCREENS.map((name, i) => {
          const active = i === index;
          return (
            <div
              key={name}
              className="relative h-full w-full shrink-0 snap-start snap-always bg-background"
              data-screen={name}
              data-active={active ? "true" : undefined}
              aria-hidden={active ? undefined : true}
              inert={!active}
            >
              {active || mountedAll ? screens[name] : null}
            </div>
          );
        })}
      </div>
      <BottomNavigation />
    </div>
  );
}
