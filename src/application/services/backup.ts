/**
 * 데이터 백업·복원·초기화 (REQUIREMENTS.md §11~13 BAK/RES/RST, ARCHITECTURE.md §10·§11, ARC-D01~D04, AGENTS.md §6).
 *
 * 백업: 단일 읽기 트랜잭션 스냅샷 → ZIP 생성(트랜잭션 밖). 암호화 없음. 자동 기념일·임시 입력·앱 캐시·축하 재생 이력 제외.
 *       해제 총량 256MiB 를 넘는(복원 불가능한) 백업은 만들지 않는다. 마지막 백업 일시는 전달 성공 후 파일 생성 일시로 기록.
 * 복원: 구조 검사 → 실제 해제 바이트 제한 → manifest·스키마·버전·개수·경로·해시·실제 디코딩·참조 무결성·미래 시작일 검증
 *       → (사용자 확인) → 7개 store 전체 교체를 단일 트랜잭션으로. 병합 없음. 실패 시 기존 데이터 유지.
 *       lastBackupAt = manifest.createdAt, revision 은 백업 값을 쓰지 않고 현재 값에서 증가, 임시 입력 제거.
 * 초기화: 개인 데이터·예외·사진·임시 입력 삭제와 기본 설정 재생성을 단일 트랜잭션으로. 내부 revision 은 유지·증가.
 * 오류 메시지에 개인 데이터를 포함하지 않는다.
 */
import type { AnniversaryException, Couple, CustomAnniversary, DayOffset, Instant, LocalDate, Memory, Photo } from "@/domain/entities";
import { toInstant } from "@/domain/date/instant";
import { DATABASE_VERSION, type CoupleDatabase } from "@/infrastructure/db/database";
import { ArchiveError, buildArchive, DEFAULT_ARCHIVE_LIMITS, inspectArchive, readArchiveEntries, type ArchiveLimits } from "@/infrastructure/backup/archive";
import { canDecodeImage } from "@/infrastructure/image/compress";
import { sha256Hex } from "@/infrastructure/image/hash";
import { APP_VERSION } from "@/constants/app";
import { IntegrityError } from "../errors";
import {
  BACKUP_FILES,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  backupSchemas,
  imagePathFor,
  manifestSchema,
  type BackupManifest,
  type BackupPhoto,
} from "../validation/backup-schemas";
import { checkIntegrity, type DatabaseSnapshot } from "../validation/integrity";
import { runWriteTransaction } from "./write-transaction";

export type BackupFailure =
  | `archive:${ArchiveError["reason"]}`
  | "missing-file"
  | "invalid-json"
  | "schema"
  | "unsupported-version"
  | "count-mismatch"
  | "unexpected-entry"
  | "image-mismatch"
  | "image-decode"
  | "integrity"
  | "future-start-date"
  | "too-large-backup"
  | "not-completed";

export class BackupError extends Error {
  constructor(readonly reason: BackupFailure) {
    super(`백업 처리 실패: ${reason}`);
    this.name = "BackupError";
  }
}

interface WriteContext {
  expectedRevision: number;
  now?: () => Date;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** couple-dday-backup-YYYYMMDD-HHmmss.zip (기기 현지 시각) */
export function backupFileName(now: Date): string {
  return `couple-dday-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.zip`;
}

export interface BackupFile {
  bytes: Uint8Array;
  fileName: string;
  createdAt: Instant;
  /** 스냅샷 시점 revision (전달 성공 기록 시 충돌 검사용) */
  revision: number;
}

/** 백업 파일 생성 (BAK-001~011). DB 는 읽기만 한다. */
export async function createBackupFile(db: CoupleDatabase, now: () => Date = () => new Date()): Promise<BackupFile> {
  const snapshot = await db.transaction("r", db.tables, async () => ({
    couple: await db.couple.get("default"),
    settings: await db.settings.get("default"),
    anniversaries: await db.anniversaries.toArray(),
    anniversaryExceptions: await db.anniversaryExceptions.toArray(),
    memories: await db.memories.toArray(),
    photos: await db.photos.toArray(),
  }));
  if (!snapshot.couple || !snapshot.settings?.onboardingCompleted) throw new BackupError("not-completed");
  const createdNow = now();
  const createdAt = toInstant(createdNow);
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    databaseVersion: DATABASE_VERSION,
    appVersion: APP_VERSION,
    createdAt,
    encrypted: false,
    counts: {
      couples: 1,
      anniversaries: snapshot.anniversaries.length,
      anniversaryExceptions: snapshot.anniversaryExceptions.length,
      memories: snapshot.memories.length,
      photos: snapshot.photos.length,
    },
  };
  const photosJson: BackupPhoto[] = snapshot.photos.map((photo) => {
    const meta = {
      id: photo.id,
      ownerType: photo.ownerType,
      ownerId: photo.ownerId,
      sourceHash: photo.sourceHash,
      contentHash: photo.contentHash,
      mimeType: photo.mimeType as BackupPhoto["mimeType"],
      width: photo.width,
      height: photo.height,
      size: photo.size,
      sortOrder: photo.sortOrder,
      createdAt: photo.createdAt,
    };
    return { ...meta, path: imagePathFor(meta) };
  });
  const json = (value: unknown) => JSON.stringify(value, null, 2);
  const files = [
    { path: BACKUP_FILES.manifest, data: json(manifest), compress: true },
    { path: BACKUP_FILES.couple, data: json(snapshot.couple), compress: true },
    { path: BACKUP_FILES.settings, data: json({ dayOffset: snapshot.settings.dayOffset }), compress: true },
    { path: BACKUP_FILES.anniversaries, data: json(snapshot.anniversaries), compress: true },
    { path: BACKUP_FILES.anniversaryExceptions, data: json(snapshot.anniversaryExceptions), compress: true },
    { path: BACKUP_FILES.memories, data: json(snapshot.memories), compress: true },
    { path: BACKUP_FILES.photos, data: json(photosJson), compress: true },
    ...snapshot.photos.map((photo, i) => ({ path: photosJson[i].path, data: new Uint8Array(photo.data), compress: false })),
  ];
  const encoder = new TextEncoder();
  const total = files.reduce((sum, f) => sum + (typeof f.data === "string" ? encoder.encode(f.data).byteLength : f.data.byteLength), 0);
  // 복원 상한(256MiB)을 넘는 백업은 복원할 수 없으므로 성공으로 만들지 않는다(§10.1).
  if (total > DEFAULT_ARCHIVE_LIMITS.maxTotalUncompressedBytes) throw new BackupError("too-large-backup");
  return { bytes: await buildArchive(files), fileName: backupFileName(createdNow), createdAt, revision: snapshot.settings.revision };
}

/**
 * 백업 전달(공유·다운로드) 성공 기록 (BAK-012, ARC-D04). 마지막 백업 일시 = 성공한 파일의 생성 일시.
 * 백업 이후 다른 곳에서 데이터가 바뀌었으면(revision 불일치) 기록하지 않고 false 를 돌려준다.
 */
export async function recordBackupDelivered(db: CoupleDatabase, file: Pick<BackupFile, "createdAt" | "revision">, now?: () => Date): Promise<boolean> {
  try {
    await runWriteTransaction(db, [], { expectedRevision: file.revision, now }, async () => {
      await db.settings.update("default", { lastBackupAt: file.createdAt });
    });
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "RevisionConflictError") return false;
    throw error;
  }
}

export interface RestorePayload {
  manifest: BackupManifest;
  couple: Couple;
  dayOffset: DayOffset;
  anniversaries: CustomAnniversary[];
  anniversaryExceptions: AnniversaryException[];
  memories: Memory[];
  photos: Photo[];
}

export interface ParseOptions {
  today: LocalDate;
  limits?: ArchiveLimits;
  /** 실제 이미지 디코딩 검증(테스트 주입용) */
  verifyImage?: (data: ArrayBuffer, mimeType: string) => Promise<boolean>;
}

const ALLOWED_DIRECTORIES = new Set(["images/", "images/profiles/", "images/memories/"]);

function parseJson(data: Uint8Array | undefined): unknown {
  if (!data) throw new BackupError("missing-file");
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
  } catch {
    throw new BackupError("invalid-json");
  }
}

function parseWith<T>(schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BackupError("schema");
  return result.data;
}

/** 백업 ZIP 검증 및 복원 데이터 구성 (RES-001~003, RES-E01~E05, RES-E09). DB 는 건드리지 않는다. */
export async function parseBackupFile(file: Blob | Uint8Array, options: ParseOptions): Promise<RestorePayload> {
  const limits = options.limits ?? DEFAULT_ARCHIVE_LIMITS;
  const verifyImage = options.verifyImage ?? canDecodeImage;
  if (file instanceof Blob && file.size > limits.maxArchiveBytes) throw new BackupError("archive:too-large");
  const bytes = file instanceof Blob ? new Uint8Array(await file.arrayBuffer()) : file;
  try {
    // 1) 압축 해제 전 구조 검사
    const entries = inspectArchive(bytes, limits);
    const fileNames = entries.filter((e) => !e.isDirectory).map((e) => e.name);
    for (const entry of entries) if (entry.isDirectory && !ALLOWED_DIRECTORIES.has(entry.name)) throw new BackupError("unexpected-entry");
    const required = Object.values(BACKUP_FILES);
    for (const name of required) if (!fileNames.includes(name)) throw new BackupError("missing-file");

    // 2) JSON 읽기(실제 해제 바이트 제한)
    const jsonData = await readArchiveEntries(bytes, required, limits);
    const manifest = parseWith(manifestSchema, parseJson(jsonData.get(BACKUP_FILES.manifest)));
    if (manifest.formatVersion !== BACKUP_FORMAT_VERSION || manifest.databaseVersion > DATABASE_VERSION) throw new BackupError("unsupported-version");
    const couple = parseWith(backupSchemas.couple, parseJson(jsonData.get(BACKUP_FILES.couple)));
    const settings = parseWith(backupSchemas.settings, parseJson(jsonData.get(BACKUP_FILES.settings)));
    const anniversaries = parseWith(backupSchemas.anniversaries, parseJson(jsonData.get(BACKUP_FILES.anniversaries)));
    const anniversaryExceptions = parseWith(backupSchemas.anniversaryExceptions, parseJson(jsonData.get(BACKUP_FILES.anniversaryExceptions)));
    const memories = parseWith(backupSchemas.memories, parseJson(jsonData.get(BACKUP_FILES.memories)));
    const photoMeta = parseWith(backupSchemas.photos, parseJson(jsonData.get(BACKUP_FILES.photos)));

    const { counts } = manifest;
    if (counts.couples !== 1 || counts.anniversaries !== anniversaries.length || counts.anniversaryExceptions !== anniversaryExceptions.length || counts.memories !== memories.length || counts.photos !== photoMeta.length) {
      throw new BackupError("count-mismatch");
    }

    // 3) 예상하지 않은 엔트리 거부, 이미지 존재 확인
    const expected = new Set<string>([...required, ...photoMeta.map((p) => p.path)]);
    if (expected.size !== required.length + photoMeta.length) throw new BackupError("integrity"); // 이미지 경로(ID) 중복
    for (const name of fileNames) if (!expected.has(name)) throw new BackupError("unexpected-entry");
    for (const photo of photoMeta) if (!fileNames.includes(photo.path)) throw new BackupError("missing-file");

    // 4) 이미지: 실제 해제 제한, 크기·해시·실제 디코딩 검증
    const imageData = await readArchiveEntries(bytes, photoMeta.map((p) => p.path), limits);
    const photos: Photo[] = [];
    for (const meta of photoMeta) {
      const raw = imageData.get(meta.path)!;
      const data = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
      if (data.byteLength !== meta.size || (await sha256Hex(data)) !== meta.contentHash) throw new BackupError("image-mismatch");
      if (!(await verifyImage(data, meta.mimeType))) throw new BackupError("image-decode");
      photos.push({
        id: meta.id,
        ownerType: meta.ownerType,
        ownerId: meta.ownerId,
        data,
        sourceHash: meta.sourceHash,
        contentHash: meta.contentHash,
        mimeType: meta.mimeType,
        width: meta.width,
        height: meta.height,
        size: meta.size,
        sortOrder: meta.sortOrder,
        createdAt: meta.createdAt,
      });
    }

    // 5) 참조 무결성(DB-001~011, DB-014)
    const snapshot: DatabaseSnapshot = {
      couple: [couple],
      settings: [{ id: "default", dayOffset: settings.dayOffset, onboardingCompleted: true, lastBackupAt: manifest.createdAt, revision: 0, updatedAt: manifest.createdAt }],
      anniversaries,
      anniversaryExceptions,
      memories,
      photos,
      onboardingDraft: [],
    };
    if (checkIntegrity(snapshot).length > 0) throw new BackupError("integrity");

    // 6) 미래 시작일 차단 (ARC-D02)
    if (couple.startDate > options.today) throw new BackupError("future-start-date");

    return { manifest, couple, dayOffset: settings.dayOffset, anniversaries, anniversaryExceptions, memories, photos };
  } catch (error) {
    if (error instanceof ArchiveError) throw new BackupError(`archive:${error.reason}`);
    throw error;
  }
}

/** 검증된 백업으로 전체 교체 (RES-004~009, RES-E06, RES-E08, ARC-D01). */
export async function restoreFromBackup(db: CoupleDatabase, payload: RestorePayload, context: WriteContext & { today: LocalDate }): Promise<number> {
  // 확인 이후 날짜 재검증 (§11.1)
  if (payload.couple.startDate > context.today) throw new BackupError("future-start-date");
  const { revision } = await runWriteTransaction(db, ["couple", "anniversaries", "anniversaryExceptions", "memories", "photos", "onboardingDraft"], context, async () => {
    const settings = await db.settings.get("default");
    if (!settings) throw new IntegrityError([{ rule: "DB-002", store: "settings", ref: "default" }]);
    await Promise.all([db.couple.clear(), db.anniversaries.clear(), db.anniversaryExceptions.clear(), db.memories.clear(), db.photos.clear(), db.onboardingDraft.clear()]);
    await db.couple.add(payload.couple);
    await db.anniversaries.bulkAdd(payload.anniversaries);
    await db.anniversaryExceptions.bulkAdd(payload.anniversaryExceptions);
    await db.memories.bulkAdd(payload.memories);
    await db.photos.bulkAdd(payload.photos);
    // revision 은 runWriteTransaction 이 현재 값에서 증가시킨다(백업의 revision 은 사용하지 않음).
    await db.settings.put({ ...settings, dayOffset: payload.dayOffset, onboardingCompleted: true, lastBackupAt: payload.manifest.createdAt });
  });
  return revision;
}

/** 전체 데이터 초기화 (RST-001~009). 앱 리소스 캐시·외부 백업·사진 앱 원본은 건드리지 않는다. */
export async function resetAllData(db: CoupleDatabase, context: WriteContext): Promise<number> {
  const { revision } = await runWriteTransaction(db, ["couple", "anniversaries", "anniversaryExceptions", "memories", "photos", "onboardingDraft"], context, async () => {
    const settings = await db.settings.get("default");
    if (!settings) throw new IntegrityError([{ rule: "DB-002", store: "settings", ref: "default" }]);
    await Promise.all([db.couple.clear(), db.anniversaries.clear(), db.anniversaryExceptions.clear(), db.memories.clear(), db.photos.clear(), db.onboardingDraft.clear()]);
    await db.settings.put({ ...settings, dayOffset: 1, onboardingCompleted: false, lastBackupAt: null });
  });
  return revision;
}
