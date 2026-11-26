"use client";

/**
 * 금빛 꽃가루 축하 효과 Canvas 오버레이 (ARCHITECTURE.md §12, SKILL.md §7.2, HOME-022~032).
 * - 메인 콘텐츠 영역 위 absolute 오버레이, pointer-events: none → 터치·스와이프·하단 메뉴를 가로채지 않는다.
 * - requestAnimationFrame + 실제 경과 시간, devicePixelRatio 반영, 약 7초 후 종료·Canvas 초기화.
 * - 언마운트 시 cancelAnimationFrame 으로 정리. 실행 오류는 메인 렌더링과 분리(HOME-E25).
 * - 사운드 없음.
 */
import { useEffect, useRef } from "react";
import { CELEBRATION_DURATION_MS, createParticles, particleFrame, type Particle } from "../utils/particles";

function drawSparkle(ctx: CanvasRenderingContext2D, size: number) {
  const r = size * 1.1;
  const w = r * 0.28;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(w, -w, r, 0);
  ctx.quadraticCurveTo(w, w, 0, r);
  ctx.quadraticCurveTo(-w, w, -r, 0);
  ctx.quadraticCurveTo(-w, -w, 0, -r);
  ctx.fill();
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, x: number, y: number, rotation: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p.color;
  ctx.translate(x, y);
  ctx.rotate(rotation);
  if (p.shape === "pollen") {
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size / 2, p.size / 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    drawSparkle(ctx, p.size);
  }
  ctx.restore();
}

export function CelebrationCanvas({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    let frame = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onDoneRef.current();
    };
    try {
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        finish();
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.scale(dpr, dpr);
      const particles = createParticles(width, height);
      let start: number | null = null;
      const tick = (now: number) => {
        start ??= now;
        const elapsed = now - start;
        ctx.clearRect(0, 0, width, height);
        if (elapsed >= CELEBRATION_DURATION_MS) {
          canvas.width = 0;
          canvas.height = 0;
          finish();
          return;
        }
        for (const p of particles) {
          const f = particleFrame(p, elapsed);
          if (f && f.alpha > 0.01 && f.y < height + 12) drawParticle(ctx, p, f.x, f.y, f.rotation, f.alpha);
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    } catch {
      finish();
    }
    return () => {
      cancelAnimationFrame(frame);
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-10 h-full w-full" aria-hidden="true" data-testid="celebration-canvas" />;
}
