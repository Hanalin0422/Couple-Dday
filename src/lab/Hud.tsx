"use client";
/**
 * [LAB] 실기기 측정 표시. 화면 영역 또는 하단 메뉴를 누른 순간부터 손을 뗀 뒤 1초까지를 한 구간으로 기록한다.
 * 구간 동안만 rAF 로 프레임 간격을 기록하고, 구간이 끝난 뒤에만 다시 그린다(측정 중 추가 렌더 없음).
 */
import { useEffect, useState } from "react";
import { probe } from "./probe";

interface Result {
  kind: string;
  ms: number;
  frames: number;
  over20: number;
  over33: number;
  max: number;
  commitsDuring: number;
  commitsAfter: number;
  idb: number;
  urls: number;
  imgs: number;
  mounts: number;
}

export function Hud() {
  const [last, setLast] = useState<Result | null>(null);
  const [history, setHistory] = useState<Result[]>([]);

  useEffect(() => {
    let active = false;
    let kind = "";
    let t0 = 0;
    let lastT = 0;
    let deltas: number[] = [];
    let commitsDuring = 0;
    let endTimer: ReturnType<typeof setTimeout> | undefined;
    const tick = (t: number) => {
      if (!active) return;
      deltas.push(t - lastT);
      lastT = t;
      requestAnimationFrame(tick);
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element;
      const inNav = !!target.closest("[data-testid=bottom-navigation]");
      if (!inNav && !target.closest("[data-testid=screen-area]")) return;
      clearTimeout(endTimer);
      active = true;
      kind = inNav ? "메뉴" : "스와이프";
      t0 = lastT = performance.now();
      deltas = [];
      probe.reset();
      requestAnimationFrame(tick);
    };
    const onUp = () => {
      if (!active) return;
      commitsDuring = probe.snapshot().commits;
      clearTimeout(endTimer);
      endTimer = setTimeout(() => {
        active = false;
        const s = probe.snapshot();
        const d = deltas.slice(1);
        const r: Result = {
          kind,
          ms: Math.round(performance.now() - t0),
          frames: d.length,
          over20: d.filter((x) => x > 20).length,
          over33: d.filter((x) => x > 33).length,
          max: Math.round(Math.max(0, ...d)),
          commitsDuring,
          commitsAfter: s.commits - commitsDuring,
          idb: s.idbRequests,
          urls: s.objectUrlCreate,
          imgs: s.imgLoads,
          mounts: Object.values(s.mounts).reduce((a, b) => a + b, 0),
        };
        setLast(r);
        setHistory((h) => [r, ...h].slice(0, 20));
      }, 1000);
    };
    document.addEventListener("pointerdown", onDown, { capture: true, passive: true });
    document.addEventListener("pointerup", onUp, { capture: true, passive: true });
    document.addEventListener("pointercancel", onUp, { capture: true, passive: true });
    return () => {
      clearTimeout(endTimer);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
    };
  }, []);

  const avg = (k: keyof Result) => (history.length ? (history.reduce((s, r) => s + (r[k] as number), 0) / history.length).toFixed(1) : "-");
  return (
    <div data-testid="lab-hud" style={{ position: "absolute", left: 4, top: "calc(env(safe-area-inset-top) + 4px)", zIndex: 60, pointerEvents: "none", background: "rgba(0,0,0,0.72)", color: "#fff", font: "11px/1.35 ui-monospace, Menlo, monospace", padding: "4px 6px", borderRadius: 6, maxWidth: 220 }}>
      {last ? (
        <>
          <div>마지막 {last.kind} · {last.ms}ms</div>
          <div>프레임 {last.frames} · 20ms↑ {last.over20} · 33ms↑ {last.over33}</div>
          <div>최대 프레임 {last.max}ms</div>
          <div>commit 이동중 {last.commitsDuring} · 뗀후 {last.commitsAfter}</div>
          <div>DB {last.idb} · 사진URL {last.urls} · img {last.imgs} · mount {last.mounts}</div>
          <div>최근 {history.length}회 평균 20ms↑ {avg("over20")} · 최대 {avg("max")}ms</div>
        </>
      ) : (
        <div>HUD: 스와이프하거나 메뉴를 눌러 주세요</div>
      )}
    </div>
  );
}
