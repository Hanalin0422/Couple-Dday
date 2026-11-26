/**
 * 테스트용 가상 엔티티 생성기 (실제 사용자 데이터 사용 금지).
 */
import type {
  AnniversaryException,
  Couple,
  CustomAnniversary,
  Memory,
  OnboardingDraft,
  Photo,
  Settings,
} from "@/domain/entities";
import type { DatabaseSnapshot } from "@/application/validation/integrity";

export const T0 = "2026-11-25T06:30:00.000Z";
export const SERIES_A = "11111111-1111-4111-8111-111111111111";
export const SERIES_B = "22222222-2222-4222-8222-222222222222";

let counter = 0;
/** 결정적인 UUID v4 형식 값. */
export function uuid(): string {
  counter += 1;
  const hex = counter.toString(16).padStart(12, "0");
  return `aaaaaaaa-aaaa-4aaa-8aaa-${hex}`;
}

export function hash(seed: string | number): string {
  return String(seed).padStart(64, "0").replace(/[^0-9a-f]/g, "a").slice(-64);
}

export function couple(overrides: Partial<Couple> = {}): Couple {
  return {
    id: "default",
    myName: "하늘",
    partnerName: "바다",
    startDate: "2026-07-01",
    myPhotoId: null,
    partnerPhotoId: null,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

export function settings(overrides: Partial<Settings> = {}): Settings {
  return { id: "default", dayOffset: 1, onboardingCompleted: true, lastBackupAt: null, revision: 0, updatedAt: T0, ...overrides };
}

export function anniversary(overrides: Partial<CustomAnniversary> = {}): CustomAnniversary {
  return { id: SERIES_A, title: "첫 여행", date: "2026-08-15", repeatType: "yearly", createdAt: T0, updatedAt: T0, ...overrides };
}

export function exception(overrides: Partial<AnniversaryException> = {}): AnniversaryException {
  return { seriesId: SERIES_A, occurrenceYear: 2027, kind: "cancelled", createdAt: T0, updatedAt: T0, ...overrides };
}

export function memory(overrides: Partial<Memory> = {}): Memory {
  return { occurrenceId: "auto:day:100", memo: "", coverPhotoId: null, createdAt: T0, updatedAt: T0, ...overrides };
}

export function photo(overrides: Partial<Photo> = {}): Photo {
  const blob = overrides.blob ?? new Blob([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], { type: "image/jpeg" });
  return {
    id: uuid(),
    ownerType: "memory",
    ownerId: "auto:day:100",
    blob,
    sourceHash: hash(uuid()),
    contentHash: hash("c"),
    mimeType: "image/jpeg",
    width: 100,
    height: 80,
    size: blob.size,
    sortOrder: 0,
    createdAt: T0,
    ...overrides,
  };
}

export function draft(overrides: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return {
    id: "default",
    myName: "하늘",
    partnerName: "",
    startDate: null,
    dayOffset: 1,
    myPhoto: null,
    partnerPhoto: null,
    updatedAt: T0,
    ...overrides,
  };
}

export function emptySnapshot(): DatabaseSnapshot {
  return { couple: [], settings: [], anniversaries: [], anniversaryExceptions: [], memories: [], photos: [], onboardingDraft: [] };
}

/** 무결성 위반이 없는 완료 상태 스냅샷: 프로필 사진 1장, 반복 기념일 + 예외, 사진 2장이 있는 추억. */
export function validSnapshot(): DatabaseSnapshot {
  const profile = photo({ ownerType: "profile", ownerId: "self", sortOrder: 0 });
  const m1 = photo({ ownerId: "auto:day:100", sortOrder: 0 });
  const m2 = photo({ ownerId: "auto:day:100", sortOrder: 1 });
  return {
    couple: [couple({ myPhotoId: profile.id })],
    settings: [settings()],
    anniversaries: [anniversary(), anniversary({ id: SERIES_B, title: "기념", date: "2026-12-01", repeatType: "none" })],
    anniversaryExceptions: [exception({ occurrenceYear: 2027, kind: "override", overrideTitle: "제주 여행" })],
    memories: [
      memory({ occurrenceId: "auto:day:100", coverPhotoId: m1.id, memo: "가상 메모" }),
      memory({ occurrenceId: `custom:${SERIES_A}:2026`, memo: "사진 없는 메모" }),
    ],
    photos: [profile, m1, m2],
    onboardingDraft: [],
  };
}
