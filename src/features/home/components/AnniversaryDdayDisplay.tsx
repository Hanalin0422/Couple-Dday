"use client";

/**
 * 원 내부 표시 (SKILL.md §4, §7-3, §7.1, HOME-014~016, HOME-E16).
 * - 일반: "우리가 함께한 지" / 디데이 숫자(Pretendard 72/700) / DAYS / 시작일
 * - 자동 주년: "우리가 함께한 지" / N(Cormorant Garamond Italic 88/500) + 주년(마루 부리 38/400) 한 줄 / HAPPY ANNIVERSARY / 시작일
 * 모든 크기는 시안 원(272px) 기준이며 원 크기에 비례한다(cqw). 두 자릿수 이상 주년은 원 내부 가용 너비에 맞춰 축소하며
 * 줄바꿈·말줄임·잘림을 허용하지 않는다.
 */
import { useLayoutEffect, useRef } from "react";
import type { HomeDdayDisplay } from "@/domain/anniversary/home-display";

/** 시안 px → 원 너비 대비 cqw */
const cq = (px: number) => `${((px / 272) * 100).toFixed(3)}cqw`;
const MAX_ROW_WIDTH_RATIO = 0.7;

function useFitToCircle(deps: unknown[]) {
  const rowRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const row = rowRef.current;
    const circle = row?.closest<HTMLElement>("[data-circle]");
    if (!row || !circle) return;
    const fit = () => {
      row.style.setProperty("--fit", "1");
      const natural = row.scrollWidth;
      const max = circle.clientWidth * MAX_ROW_WIDTH_RATIO;
      row.style.setProperty("--fit", natural > max && natural > 0 ? String(max / natural) : "1");
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(circle);
    let cancelled = false;
    document.fonts?.ready.then(() => !cancelled && fit());
    return () => {
      cancelled = true;
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 표시 값이 바뀔 때만 다시 맞춘다.
  }, deps);
  return rowRef;
}

export function DdayInner({ display, startDateLabel }: { display: HomeDdayDisplay; startDateLabel: string }) {
  const rowRef = useFitToCircle([display.type, display.label]);
  return (
    <div className="flex flex-col items-center text-center">
      <p className="font-medium text-text-body" style={{ fontSize: cq(15) }}>
        우리가 함께한 지
      </p>
      {display.type === "days" ? (
        <>
          <p
            className="font-bold leading-none tracking-[-0.02em] text-text-primary tabular-nums"
            style={{ fontSize: cq(72), marginTop: cq(10) }}
            data-testid="dday-number"
          >
            {display.value}
          </p>
          <p className="font-semibold text-accent" style={{ fontSize: cq(13), letterSpacing: cq(2.6), marginTop: cq(10) }}>
            {display.subtitle}
          </p>
        </>
      ) : (
        <>
          <div
            ref={rowRef}
            className="flex items-baseline whitespace-nowrap leading-none text-text-primary"
            style={{ ["--fit" as string]: 1, marginTop: cq(6) }}
            data-testid="anniversary-label"
            aria-label={display.label}
          >
            <span className="font-cormorant font-medium italic" style={{ fontSize: `calc(${cq(88)} * var(--fit))` }}>
              {display.anniversaryYear}
            </span>
            <span className="font-maruburi font-normal" style={{ fontSize: `calc(${cq(38)} * var(--fit))`, marginLeft: cq(4) }}>
              주년
            </span>
          </div>
          <p className="font-cormorant font-normal text-accent" style={{ fontSize: cq(12), letterSpacing: cq(2), marginTop: cq(8) }}>
            {display.subtitle}
          </p>
        </>
      )}
      <p className="text-text-secondary tabular-nums" style={{ fontSize: cq(14), marginTop: cq(10) }}>
        {startDateLabel}
      </p>
    </div>
  );
}
