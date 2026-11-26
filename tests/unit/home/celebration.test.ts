/**
 * 주년 축하 효과 순수 로직 (TC-CEL-001, TC-CEL-002, TC-CEL-003, TC-CEL-004, TC-CEL-008 일부, TC-CEL-019).
 */
import { describe, expect, it } from "vitest";
import type { KeyValueStorage } from "@/infrastructure/browser/key-value-storage";
import { msUntilNextLocalMidnight } from "@/infrastructure/browser/clock";
import {
  CELEBRATION_STORAGE_KEY,
  celebrationTargetId,
  createCelebrationHistory,
} from "@/features/home/utils/celebration-history";
import {
  CELEBRATION_COLORS,
  CELEBRATION_DURATION_MS,
  createParticles,
  createRandom,
  particleFrame,
  PARTICLE_COUNT,
} from "@/features/home/utils/particles";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: (k) => data.get(k) ?? null,
    set: (k, v) => (data.set(k, v), true),
    remove: (k) => data.delete(k),
  };
}

const brokenStorage: KeyValueStorage = { get: () => null, set: () => false, remove: () => false };

describe("자동 재생 이력", () => {
  const id = celebrationTargetId("2027-07-01", "2026-07-01");

  it("최초 1회만 자동 재생하고 기록한다 (HOME-023)", () => {
    const storage = memoryStorage();
    const history = createCelebrationHistory(storage);
    expect(history.shouldAutoPlay(id)).toBe(true);
    history.markAutoPlayed(id);
    expect(history.shouldAutoPlay(id)).toBe(false);
    expect(storage.data.get(CELEBRATION_STORAGE_KEY)).toBe("2027-07-01|2026-07-01");
  });

  it("같은 날 앱 재실행(새 세션)에도 반복하지 않는다 (HOME-E20)", () => {
    const storage = memoryStorage();
    createCelebrationHistory(storage).markAutoPlayed(id);
    expect(createCelebrationHistory(storage).shouldAutoPlay(id)).toBe(false);
  });

  it("다음 주년 또는 시작일 변경 시 새 대상으로 판단한다 (TC-CEL-002)", () => {
    const storage = memoryStorage();
    const history = createCelebrationHistory(storage);
    history.markAutoPlayed(id);
    expect(history.shouldAutoPlay(celebrationTargetId("2028-07-01", "2026-07-01"))).toBe(true);
    expect(history.shouldAutoPlay(celebrationTargetId("2027-07-01", "2026-06-30"))).toBe(true);
  });

  it("localStorage 실패 시에도 같은 세션에서는 반복하지 않는다 (HOME-E29)", () => {
    const history = createCelebrationHistory(brokenStorage);
    expect(history.shouldAutoPlay(id)).toBe(true);
    expect(() => history.markAutoPlayed(id)).not.toThrow();
    expect(history.shouldAutoPlay(id)).toBe(false);
  });

  it("clear 는 이력을 제거한다 (RST-006)", () => {
    const storage = memoryStorage();
    const history = createCelebrationHistory(storage);
    history.markAutoPlayed(id);
    history.clear();
    expect(storage.data.has(CELEBRATION_STORAGE_KEY)).toBe(false);
    expect(history.shouldAutoPlay(id)).toBe(true);
  });
});

describe("입자 모델 (SKILL.md §7.2)", () => {
  const particles = createParticles(390, 700, createRandom(42));

  it("약 65개, 2~6px, 꽃가루·별빛 혼합, celebration 토큰 색상", () => {
    expect(particles).toHaveLength(PARTICLE_COUNT);
    expect(particles.every((p) => p.size >= 2 && p.size <= 6)).toBe(true);
    expect(new Set(particles.map((p) => p.shape))).toEqual(new Set(["pollen", "sparkle"]));
    expect(particles.every((p) => (CELEBRATION_COLORS as readonly string[]).includes(p.color))).toBe(true);
  });

  it("약 7초 후 모든 입자가 사라지고, 종료 직전 투명도가 감소한다", () => {
    const p = { ...particles[0], delay: 0 };
    expect(particleFrame(p, CELEBRATION_DURATION_MS)).toBeNull();
    const mid = particleFrame(p, 3_000)!;
    const late = particleFrame(p, CELEBRATION_DURATION_MS - 100)!;
    expect(late.alpha).toBeLessThan(mid.alpha);
    expect(late.alpha).toBeGreaterThanOrEqual(0);
  });

  it("시간에 따라 아래로 떨어지며 좌우로 흔들린다", () => {
    const p = { ...particles[1], delay: 0 };
    const a = particleFrame(p, 1_000)!;
    const b = particleFrame(p, 3_000)!;
    expect(b.y).toBeGreaterThan(a.y);
    expect(Math.abs(a.x - p.startX)).toBeLessThanOrEqual(p.swayAmplitude + 1e-9);
  });

  it("지연 시작 전에는 그리지 않는다", () => {
    expect(particleFrame({ ...particles[2], delay: 500 }, 100)).toBeNull();
  });

  it("같은 시드는 같은 입자를 만든다 (시각 회귀 고정 조건)", () => {
    expect(createParticles(390, 700, createRandom(42))).toEqual(particles);
  });
});

describe("자정 타이머 (PWA-009)", () => {
  it("다음 현지 자정까지 남은 시간", () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 10, 25, 23, 59, 0))).toBe(61_000);
    expect(msUntilNextLocalMidnight(new Date(2026, 10, 25, 0, 0, 0))).toBe(86_401_000);
  });
});
