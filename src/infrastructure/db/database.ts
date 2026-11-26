/**
 * IndexedDB 스키마 및 연결 (ARCHITECTURE.md §5.1, §5.3).
 *
 * - 영속 데이터의 단일 진실 공급원(SSOT). Blob 에는 인덱스를 만들지 않는다.
 * - 이름/날짜는 UNIQUE 가 아니다. 사진 중복 방지 unique 인덱스는 소유자 단위로 적용한다.
 * - 모든 ID 참조 검증은 애플리케이션 계층에서 수행한다.
 * - 오류 해결을 위해 DB 를 자동 삭제하지 않는다.
 */
import Dexie, { type Table } from "dexie";
import type {
  AnniversaryException,
  Couple,
  CustomAnniversary,
  Memory,
  OnboardingDraft,
  Photo,
  Settings,
} from "@/domain/entities";

export const DATABASE_NAME = "couple-dday";
export const DATABASE_VERSION = 1;

export const STORE_NAMES = [
  "couple",
  "settings",
  "anniversaries",
  "anniversaryExceptions",
  "memories",
  "photos",
  "onboardingDraft",
] as const;
export type StoreName = (typeof STORE_NAMES)[number];

export const SCHEMA_V1: Record<StoreName, string> = {
  couple: "id",
  settings: "id",
  anniversaries: "id, date, repeatType",
  anniversaryExceptions: "[seriesId+occurrenceYear], seriesId, overrideDate",
  memories: "occurrenceId",
  photos: "id, [ownerType+ownerId], [ownerType+ownerId+sortOrder], &[ownerType+ownerId+sourceHash]",
  onboardingDraft: "id",
};

export class CoupleDatabase extends Dexie {
  couple!: Table<Couple, string>;
  settings!: Table<Settings, string>;
  anniversaries!: Table<CustomAnniversary, string>;
  anniversaryExceptions!: Table<AnniversaryException, [string, number]>;
  memories!: Table<Memory, string>;
  photos!: Table<Photo, string>;
  onboardingDraft!: Table<OnboardingDraft, string>;

  constructor(name: string = DATABASE_NAME) {
    super(name);
    this.version(DATABASE_VERSION).stores(SCHEMA_V1);
    // v2 이상은 this.version(n).stores(...).upgrade(...) 로 추가한다. 실패 시 Dexie 가 트랜잭션을 롤백하며 데이터를 삭제하지 않는다.
  }
}

export interface OpenDatabaseOptions {
  name?: string;
  /** 다른 탭이 새 버전으로 업그레이드하려 할 때 호출된다. 연결은 이미 닫힌 상태이며 UI는 재실행을 안내한다. */
  onVersionChange?: () => void;
}

/** Dexie 는 선언 버전 × 10 을 IndexedDB 네이티브 버전으로 사용한다. */
const NATIVE_VERSION = DATABASE_VERSION * 10;

/** 설치된 DB 의 네이티브 버전. indexedDB.databases() 미지원 환경에서는 null. */
async function getInstalledNativeVersion(name: string): Promise<number | null> {
  if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") return null;
  const list = await indexedDB.databases();
  return list.find((info) => info.name === name)?.version ?? null;
}

/**
 * DB 연결을 연다. 실패하면 StorageError 로 변환하여 던진다(자동 삭제·재생성 없음).
 * Dexie 4 는 더 높은 버전의 DB 도 열면서 누락 store 를 추가하므로, 열기 전에 버전을 확인하여
 * 신버전 앱이 만든 DB 를 구버전 앱이 수정하지 않도록 거부한다(PWA-E04).
 */
export async function openDatabase(options: OpenDatabaseOptions = {}): Promise<CoupleDatabase> {
  const name = options.name ?? DATABASE_NAME;
  const installed = await getInstalledNativeVersion(name).catch(() => null);
  if (installed !== null && installed > NATIVE_VERSION) throw new StorageError("version", "NewerDatabaseVersion");
  const db = new CoupleDatabase(name);
  db.on("versionchange", () => {
    db.close();
    options.onVersionChange?.();
    return false; // Dexie 기본 동작(reload 등)을 막고 앱이 안내하도록 한다.
  });
  try {
    await db.open();
  } catch (error) {
    db.close();
    throw toStorageError(error);
  }
  return db;
}

export type StorageErrorKind = "version" | "quota" | "open-failed" | "closed" | "constraint" | "unknown";

/** IndexedDB/Dexie 오류를 앱이 다루기 쉬운 형태로 변환한다. 메시지에 개인 데이터를 포함하지 않는다. */
export class StorageError extends Error {
  constructor(
    readonly kind: StorageErrorKind,
    readonly causeName: string,
  ) {
    super(`저장소 오류 (${kind}: ${causeName})`);
    this.name = "StorageError";
  }
}

function errorName(error: unknown): string {
  if (error instanceof Error) {
    const inner = (error as Error & { inner?: unknown }).inner;
    if (inner instanceof Error && error.name === "OpenFailedError") return inner.name || error.name;
    return error.name;
  }
  return "UnknownError";
}

export function toStorageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  const name = errorName(error);
  const kind: StorageErrorKind =
    name === "VersionError"
      ? "version"
      : name === "QuotaExceededError"
        ? "quota"
        : name === "ConstraintError"
          ? "constraint"
          : name === "DatabaseClosedError"
            ? "closed"
            : name === "OpenFailedError" || name === "InvalidStateError" || name === "UnknownError" || name === "MissingAPIError"
              ? "open-failed"
              : "unknown";
  return new StorageError(kind, name);
}
