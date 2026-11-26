/**
 * 금빛 꽃가루 입자 모델 (SKILL.md §7.2, ARCHITECTURE.md §12 "주년 축하 애니메이션 구현").
 *
 * 약 65개, 기본 크기 2~6px, 작은 타원형 꽃가루와 4각 별빛 혼합, celebration 토큰 색상,
 * 좌우로 살랑거리며 천천히 낙하, 입자별 미세 회전, 은은한 반짝임, 약 7초 후 자연스럽게 투명해지며 종료.
 * 시간은 실제 경과 시간(ms)으로 계산하여 기기 주사율과 무관하게 같은 속도를 낸다.
 */
export const CELEBRATION_DURATION_MS = 7_000;
export const CELEBRATION_FADE_MS = 1_600;
export const PARTICLE_COUNT = 65;

/** SKILL.md §3 celebration 계열 토큰 (축하 효과 전용). */
export const CELEBRATION_COLORS = ["#D4AF37", "#F5D77B", "#E9C65B", "#FFF0B0", "#C9A24C"] as const;

export type ParticleShape = "pollen" | "sparkle";

export interface Particle {
  shape: ParticleShape;
  color: string;
  size: number;
  startX: number;
  startY: number;
  fallSpeed: number; // px/s
  swayAmplitude: number; // px
  swayFrequency: number; // Hz
  phase: number;
  rotation: number;
  rotationSpeed: number; // rad/s
  twinkleFrequency: number; // Hz
  baseAlpha: number;
  delay: number; // ms
}

export interface ParticleFrame {
  x: number;
  y: number;
  rotation: number;
  alpha: number;
}

/** 재현 가능한 테스트를 위한 결정적 난수(mulberry32). */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createParticles(width: number, height: number, random: () => number = Math.random, count = PARTICLE_COUNT): Particle[] {
  const between = (min: number, max: number) => min + (max - min) * random();
  return Array.from({ length: count }, () => {
    const shape: ParticleShape = random() < 0.7 ? "pollen" : "sparkle";
    return {
      shape,
      color: CELEBRATION_COLORS[Math.floor(random() * CELEBRATION_COLORS.length)],
      size: between(2, 6),
      startX: between(0, width),
      startY: between(-height * 0.35, -8),
      fallSpeed: between(height / 7.5, height / 4.5),
      swayAmplitude: between(6, 22),
      swayFrequency: between(0.25, 0.6),
      phase: between(0, Math.PI * 2),
      rotation: between(0, Math.PI * 2),
      rotationSpeed: between(-1.2, 1.2),
      twinkleFrequency: between(0.6, 1.6),
      baseAlpha: between(0.55, 0.95),
      delay: between(0, 1_800),
    };
  });
}

/** 경과 시간 t(ms)에서의 입자 상태. 시작 전이면 null. */
export function particleFrame(p: Particle, t: number, duration = CELEBRATION_DURATION_MS, fade = CELEBRATION_FADE_MS): ParticleFrame | null {
  const local = (t - p.delay) / 1000;
  if (local < 0 || t >= duration) return null;
  const twinkle = 0.75 + 0.25 * Math.sin(local * Math.PI * 2 * p.twinkleFrequency + p.phase);
  const fadeIn = Math.min(1, local / 0.4);
  const fadeOut = t > duration - fade ? Math.max(0, (duration - t) / fade) : 1;
  return {
    x: p.startX + Math.sin(local * Math.PI * 2 * p.swayFrequency + p.phase) * p.swayAmplitude,
    y: p.startY + p.fallSpeed * local,
    rotation: p.rotation + p.rotationSpeed * local,
    alpha: p.baseAlpha * twinkle * fadeIn * fadeOut,
  };
}
