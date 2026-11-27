"use client";

/**
 * 단일 AppShell (ARC-C05, ARCHITECTURE.md §12): 설정 / 메인 / 기념일을 URL 라우팅 없이 전환한다.
 * - 세 화면을 가로로 나란히 붙여 두고(항상 표시), 트랙 전체를 transform(x)으로 옮긴다. 화면은 다시 만들지 않는다.
 * - 스와이프: 손가락을 따라 트랙이 그대로 움직이고(옆 화면이 같이 들어옴), 손을 떼면 임계값 60px 또는 속도 500px/s 로
 *   다음 화면에 정착, 미만이면 제자리로 돌아간다. 양 끝에서는 약한 저항만 있고 넘어가지 않는다(ARC-C04).
 * - 하단 메뉴 터치도 같은 방식으로 이동한다. 모션 감소 설정이면 즉시 이동한다.
 * - 수직 스크롤과의 충돌은 Motion 방향 잠금으로 막는다. Sheet·사진 확대·입력 조작 중에는 스와이프를 막는다(NAV-004).
 * - 드래그로 끝난 터치는 클릭으로 처리하지 않는다(스와이프를 시작한 위치의 버튼·행이 열리지 않게).
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, type PanInfo } from "motion/react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { selectGesturesBlocked, useUIStore } from "@/stores/ui-store";
import { SCREENS, useNavigationStore, type Screen } from "@/stores/navigation-store";
import { BottomNavigation } from "./BottomNavigation";

export const SWIPE_THRESHOLD_PX = 60;
const SWIPE_VELOCITY = 500;
/** 손을 뗀 뒤 정착: 되튐 없는 스프링 */
const SETTLE = { type: "spring", stiffness: 500, damping: 50, restDelta: 0.5 } as const;

export function AppShell({ screens }: { screens: Record<Screen, ReactNode> }) {
  const screen = useNavigationStore((s) => s.screen);
  const navigate = useNavigationStore((s) => s.navigate);
  const blocked = useUIStore(selectGesturesBlocked);
  const reducedMotion = useReducedMotion();
  const index = SCREENS.indexOf(screen);

  const areaRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const x = useMotionValue(0);
  const dragged = useRef(false);

  // 화면 폭 측정(회전·창 크기 변경 포함)
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const update = () => setWidth(area.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  // 현재 화면 위치로 이동(하단 메뉴·스와이프 결정·폭 변경)
  const first = useRef(true);
  useEffect(() => {
    if (width === 0) return;
    const target = -index * width;
    if (first.current || reducedMotion) {
      first.current = false;
      x.set(target);
      return;
    }
    const controls = animate(x, target, SETTLE);
    return () => controls.stop();
  }, [index, width, reducedMotion, x]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    let target = index;
    if (Math.abs(offset.x) >= Math.abs(offset.y)) {
      if (offset.x <= -SWIPE_THRESHOLD_PX || velocity.x <= -SWIPE_VELOCITY) target = Math.min(index + 1, SCREENS.length - 1);
      else if (offset.x >= SWIPE_THRESHOLD_PX || velocity.x >= SWIPE_VELOCITY) target = Math.max(index - 1, 0);
    }
    if (target !== index) navigate(SCREENS[target]);
    else if (reducedMotion) x.set(-index * width);
    else animate(x, -index * width, SETTLE); // 제자리로
  };

  return (
    <div className="flex h-full flex-col" data-testid="app-shell">
      <div ref={areaRef} className="relative min-h-0 flex-1 overflow-hidden bg-background" data-testid="screen-area">
        <motion.div
          className="absolute inset-0"
          style={{ x }}
          drag={blocked || width === 0 ? false : "x"}
          dragDirectionLock
          dragConstraints={{ left: -(SCREENS.length - 1) * width, right: 0 }}
          dragElastic={0.1}
          dragMomentum={false}
          onDragStart={() => {
            dragged.current = true;
          }}
          onDragEnd={onDragEnd}
          onPointerDownCapture={() => {
            dragged.current = false;
          }}
          onClickCapture={(event) => {
            if (!dragged.current) return;
            dragged.current = false;
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {SCREENS.map((name, i) => (
            <div
              key={name}
              className="absolute inset-y-0 w-full bg-background"
              style={{ left: `${i * 100}%` }}
              data-screen={name}
              data-active={i === index ? "true" : undefined}
              aria-hidden={i === index ? undefined : true}
            >
              {screens[name]}
            </div>
          ))}
        </motion.div>
      </div>
      <BottomNavigation />
    </div>
  );
}
