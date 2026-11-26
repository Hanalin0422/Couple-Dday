/**
 * 영속 엔티티 타입 (ARCHITECTURE.md §5).
 * Domain 계층의 순수 타입이며 저장소 구현(Dexie)에 의존하지 않는다.
 */

/** 엄격한 `YYYY-MM-DD` 현지 달력 날짜. 시간·시간대를 포함하지 않는다. */
export type LocalDate = string;
/** UTC ISO 8601 일시 (`YYYY-MM-DDTHH:mm:ss(.sss)Z`). */
export type Instant = string;
export type DayOffset = 0 | 1;
export type RepeatType = "none" | "yearly";

export interface Couple {
  id: "default";
  myName: string;
  partnerName: string;
  startDate: LocalDate;
  myPhotoId: string | null;
  partnerPhotoId: string | null;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface Settings {
  id: "default";
  dayOffset: DayOffset;
  onboardingCompleted: boolean;
  lastBackupAt: Instant | null;
  revision: number;
  updatedAt: Instant;
}

/**
 * 사용자 지정 기념일(일회성 또는 매년 반복 시리즈).
 * `id`는 crypto.randomUUID() 값 자체이며, 발생 ID는 `custom:{id}` / `custom:{id}:{year}`로 만든다.
 */
export interface CustomAnniversary {
  id: string;
  title: string;
  date: LocalDate;
  repeatType: RepeatType;
  createdAt: Instant;
  updatedAt: Instant;
}

/** 매년 반복 시리즈의 특정 발생 연도 예외. `seriesId`는 CustomAnniversary.id. */
export interface AnniversaryException {
  seriesId: string;
  occurrenceYear: number;
  kind: "override" | "cancelled";
  overrideTitle?: string;
  overrideDate?: LocalDate;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface Memory {
  occurrenceId: string;
  memo: string;
  coverPhotoId: string | null;
  createdAt: Instant;
  updatedAt: Instant;
}

/**
 * 사진 이미지는 압축된 바이트(ArrayBuffer)와 mimeType 으로 저장한다(2026-11-26 사용자 승인, ARC-B08).
 * Safari(WebKit) 임시 세션에서 IndexedDB Blob 저장이 실패하는 문제를 피하기 위함이며, 표시·내보내기 시 Blob 으로 변환한다.
 */
export interface Photo {
  id: string;
  ownerType: "profile" | "memory";
  ownerId: string;
  data: ArrayBuffer;
  sourceHash: string;
  contentHash: string;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  sortOrder: number;
  createdAt: Instant;
}

export interface DraftImage {
  data: ArrayBuffer;
  sourceHash: string;
  contentHash: string;
  mimeType: string;
  width: number;
  height: number;
  size: number;
}

export interface OnboardingDraft {
  id: "default";
  myName: string;
  partnerName: string;
  startDate: LocalDate | null;
  dayOffset: DayOffset;
  myPhoto: DraftImage | null;
  partnerPhoto: DraftImage | null;
  updatedAt: Instant;
}
