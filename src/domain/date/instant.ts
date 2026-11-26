/**
 * UTC 일시(Instant) 엄격 검증 (DB-014). 생성/수정/백업 일시에 사용한다.
 * 허용 형식: `YYYY-MM-DDTHH:mm:ssZ` 또는 `YYYY-MM-DDTHH:mm:ss.sssZ`.
 */
import type { Instant } from "@/domain/entities";

const INSTANT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/;

export function validateInstant(value: unknown): value is Instant {
  if (typeof value !== "string") return false;
  const match = INSTANT_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  if (year < 1) return false;
  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  const date = new Date(ms);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
}

/** 현재 시각을 Instant로 변환한다. now는 테스트를 위해 주입 가능하다. */
export function toInstant(now: Date): Instant {
  return now.toISOString();
}
