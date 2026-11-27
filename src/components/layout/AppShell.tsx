"use client";

/**
 * 단일 AppShell (ARC-C05, ARCHITECTURE.md §12): 설정 / 메인 / 기념일을 URL 라우팅 없이 전환한다.
 * - 세 화면을 가로로 나란히 둔 트랙을 transform(translateX)으로만 이동한다. 화면은 전환 때마다 다시 만들지 않으므로
 *   데이터 구독·사진 URL·스크롤 위치가 유지되고, 전환 중 빈 화면이나 투명 단계가 없다(깜빡임 방지).
 * - 스와이프: 손가락 이동은 MotionValue 로 직접 반영(React 리렌더 없음), 손을 떼면 임계값 60px 또는 속도 500px/s 로
 *   다음 화면에 스냅, 미만이면 제자리로 복귀. 양 끝에서는 이동하지 않는다(ARC-C04, 약한 저항만 허용).
 * - 수직 스크롤과의 충돌은 방향 잠금(dragDirectionLock)과 touch-action: pan-y 로 막는다.
 * - Sheet·사진 확대·입력 조작 중에는 스와이프를 막는다 (NAV-004).
 * - 정지 상태에서는 현재 화면만 보이고 나머지는 visibility:hidden·inert 로 페인트·포커스·보조기기 대상에서 제외한다.
 *   이동 중에만 모든 화면을 보이게 하고 will-change 를 켠다.
 * - 처음에는 메인만 렌더링하고, 첫 화면 표시 후 유휴 시점에 나머지 화면을 미리 렌더링한다(초기 실행 비용 분산).
 * - 모션 감소 설정에서는 스냅·메뉴 전환을 애니메이션 없이 즉시 이동한다.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, type PanInfo } from "motion/react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { selectGesturesBlocked, useUIStore } from "@/stores/ui-store";
import { SCREENS, useNavigationStore, type Screen } from "@/stores/navigation-store";
import { BottomNavigation } from "./BottomNavigation";

export const SWIPE_THRESHOLD_PX = 60;
const SWIPE_VELOCITY = 500;
/** 손을 뗀 뒤 스냅: 임계 감쇠 스프링(되튐 없음, damping = 2√stiffness), 약 0.3초 안에 정지 */
const SNAP = { type: "spring", stiffness: 900, damping: 60, mass: 1, restDelta: 0.5, restSpeed: 5 } as const;

export function AppShell({ screens }: { screens: Record<Screen, ReactNode> }) {
  const screen = useNavigationStore((s) => s.screen);
  const navigate = useNavigationStore((s) => s.navigate);
  const blocked = useUIStore(selectGesturesBlocked);
  const reducedMotion = useReducedMotion();
  const index = SCREENS.indexOf(screen);

  const areaRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const widthRef = useRef(0);
  const [width, setWidth] = useState(0);
  const x = useMotionValue(0);
  const animation = useRef<ReturnType<typeof animate> | null>(null);
  /** 가장 최근 이동 동작 번호: 중단된 이전 애니메이션의 늦은 완료 콜백이 이동 중인 화면을 숨기지 않게 한다 */
  const moveToken = useRef(0);
  const indexRef = useRef(index);
  /** 드래그로 끝난 포인터 동작은 클릭으로 처리하지 않는다(스와이프 시작 지점의 버튼·행이 열리는 것 방지) */
  const draggedRef = useRef(false);

  // 처음에는 메인만, 첫 표시 후 유휴 시점에 나머지 화면을 렌더링한다.
  const [mountedAll, setMountedAll] = useState(false);
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => setMountedAll(true), { timeout: 600 });
    return () => cancel(handle);
  }, []);

  /** 이동 중: 모든 화면 표시 + 합성 레이어 준비 / 정지: 현재 화면만 표시 */
  const setMoving = useCallback((moving: boolean) => {
    const track = trackRef.current;
    if (track) track.style.willChange = moving ? "transform" : "";
    panelRefs.current.forEach((panel, i) => {
      if (panel) panel.style.visibility = moving || i === indexRef.current ? "visible" : "hidden";
    });
  }, []);

  const settleTo = useCallback(
    (target: number, instant: boolean) => {
      const token = ++moveToken.current;
      animation.current?.stop();
      const destination = -target * widthRef.current;
      if (instant || Math.abs(x.get() - destination) < 0.5) {
        x.set(destination);
        setMoving(false);
        return;
      }
      setMoving(true);
      animation.current = animate(x, destination, {
        ...SNAP,
        onComplete: () => {
          if (token === moveToken.current) setMoving(false);
        },
      });
    },
    [x, setMoving],
  );

  // 화면 폭 측정 (회전·창 크기 변경 시 현재 화면 위치를 즉시 맞춘다)
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const apply = () => {
      const next = area.clientWidth;
      if (next === widthRef.current) return;
      widthRef.current = next;
      setWidth(next);
      moveToken.current++;
      animation.current?.stop();
      x.set(-indexRef.current * next);
      setMoving(false);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(area);
    return () => observer.disconnect();
  }, [x, setMoving]);

  // 화면 선택 변경(하단 메뉴·스와이프 결정) → 트랙 이동. 연속 전환 시 진행 중인 애니메이션을 이어받는다.
  const firstRun = useRef(true);
  useLayoutEffect(() => {
    indexRef.current = index;
    const instant = firstRun.current || reducedMotion;
    firstRun.current = false;
    settleTo(index, instant);
  }, [index, reducedMotion, settleTo]);

  // 언마운트 시 진행 중인 애니메이션 정리
  useEffect(() => () => animation.current?.stop(), []);

  const onDragStart = () => {
    draggedRef.current = true;
    moveToken.current++;
    animation.current?.stop();
    setMoving(true);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    const current = indexRef.current;
    let target = current;
    if (Math.abs(offset.x) >= Math.abs(offset.y)) {
      if (offset.x <= -SWIPE_THRESHOLD_PX || velocity.x <= -SWIPE_VELOCITY) target = Math.min(current + 1, SCREENS.length - 1);
      else if (offset.x >= SWIPE_THRESHOLD_PX || velocity.x >= SWIPE_VELOCITY) target = Math.max(current - 1, 0);
    }
    if (target === current) settleTo(current, reducedMotion);
    else navigate(SCREENS[target]); // 위치 이동은 index 변경 effect 에서 처리
  };

  return (
    <div className="flex h-full flex-col" data-testid="app-shell">
      <div ref={areaRef} className="relative min-h-0 flex-1 overflow-hidden bg-background" data-testid="screen-area">
        <motion.div
          ref={trackRef}
          className="absolute inset-0"
          style={{ x }}
          drag={blocked || width === 0 ? false : "x"}
          dragDirectionLock
          dragConstraints={{ left: -(SCREENS.length - 1) * width, right: 0 }}
          dragElastic={0.12}
          dragMomentum={false}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onPointerDownCapture={() => {
            draggedRef.current = false;
          }}
          onClickCapture={(event) => {
            if (!draggedRef.current) return;
            draggedRef.current = false;
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {SCREENS.map((name, i) => {
            const active = i === index;
            const render = active || mountedAll;
            return (
              <div
                key={name}
                ref={(el) => {
                  panelRefs.current[i] = el;
                }}
                className="absolute inset-y-0 w-full bg-background"
                style={{ left: `${i * 100}%` }}
                data-screen={name}
                data-active={active ? "true" : undefined}
                aria-hidden={active ? undefined : true}
                inert={!active}
              >
                {render ? screens[name] : null}
              </div>
            );
          })}
        </motion.div>
      </div>
      <BottomNavigation />
    </div>
  );
}
