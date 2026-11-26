/**
 * DB 스냅샷 참조 무결성 검사 (ARCHITECTURE.md §5.2 DB-001~011, DB-014).
 *
 * 앱 시작 시 상세 점검, 백업 생성/복원 검증, 테스트에서 공통으로 사용한다.
 * 위반을 발견해도 데이터를 수정하거나 삭제하지 않고 목록으로만 보고한다(자동 덮어쓰기 금지).
 * 오류 메시지에는 이름·메모 등 개인 데이터를 넣지 않고 ID만 포함한다.
 */
import type { z } from "zod";
import type {
  AnniversaryException,
  Couple,
  CustomAnniversary,
  Memory,
  OnboardingDraft,
  Photo,
  Settings,
} from "@/domain/entities";
import { parseOccurrenceId } from "@/domain/anniversary/occurrence-id";
import { exceptionKey } from "@/domain/anniversary/exceptions";
import { isAutoDayMilestoneNumber } from "@/domain/anniversary/milestones";
import { getLocalDateYear } from "@/domain/date/local-date";
import {
  anniversaryExceptionSchema,
  coupleSchema,
  customAnniversarySchema,
  memorySchema,
  onboardingDraftSchema,
  photoSchema,
  settingsSchema,
} from "./entity-schemas";

export const MAX_MEMORY_PHOTOS = 5;

export interface DatabaseSnapshot {
  couple: Couple[];
  settings: Settings[];
  anniversaries: CustomAnniversary[];
  anniversaryExceptions: AnniversaryException[];
  memories: Memory[];
  photos: Photo[];
  onboardingDraft: OnboardingDraft[];
}

export type IntegrityRule =
  | "DB-001"
  | "DB-002"
  | "DB-003"
  | "DB-004"
  | "DB-005"
  | "DB-006"
  | "DB-007"
  | "DB-008"
  | "DB-009"
  | "DB-010"
  | "DB-011"
  | "DB-014";

export interface IntegrityViolation {
  rule: IntegrityRule;
  store: keyof DatabaseSnapshot;
  ref: string;
  message: string;
}


const DATE_FIELDS = new Set(["startDate", "date", "overrideDate", "createdAt", "updatedAt", "lastBackupAt"]);

/** 스키마 위반을 규칙 코드로 분류한다: 날짜·일시 형식은 DB-014, 그 외 필드 형식·길이는 DB-003. */
function schemaViolations(
  store: keyof DatabaseSnapshot,
  schema: z.ZodType,
  rows: readonly unknown[],
  refOf: (row: unknown, index: number) => string,
): IntegrityViolation[] {
  const violations: IntegrityViolation[] = [];
  rows.forEach((row, index) => {
    const result = schema.safeParse(row);
    if (!result.success) {
      const paths = [...new Set(result.error.issues.map((issue) => issue.path.join(".") || "(root)"))];
      const datePaths = paths.filter((path) => DATE_FIELDS.has(path));
      const otherPaths = paths.filter((path) => !DATE_FIELDS.has(path));
      const ref = refOf(row, index);
      if (datePaths.length) violations.push({ rule: "DB-014", store, ref, message: `날짜/일시 형식 위반: ${datePaths.join(", ")}` });
      if (otherPaths.length) violations.push({ rule: "DB-003", store, ref, message: `스키마 위반: ${otherPaths.join(", ")}` });
    }
  });
  return violations;
}

function field(row: unknown, key: string): string {
  if (row && typeof row === "object" && key in row) return String((row as Record<string, unknown>)[key]);
  return "?";
}

export function checkIntegrity(snapshot: DatabaseSnapshot): IntegrityViolation[] {
  const violations: IntegrityViolation[] = [];
  const push = (rule: IntegrityRule, store: keyof DatabaseSnapshot, ref: string, message: string) =>
    violations.push({ rule, store, ref, message });

  // DB-003/DB-014: 엔티티 형식 (길이, ID 형식 / 날짜, 일시)
  violations.push(
    ...schemaViolations("couple", coupleSchema, snapshot.couple, (r) => field(r, "id")),
    ...schemaViolations("settings", settingsSchema, snapshot.settings, (r) => field(r, "id")),
    ...schemaViolations("anniversaries", customAnniversarySchema, snapshot.anniversaries, (r) => field(r, "id")),
    ...schemaViolations("anniversaryExceptions", anniversaryExceptionSchema, snapshot.anniversaryExceptions, (r) =>
      `${field(r, "seriesId")}:${field(r, "occurrenceYear")}`,
    ),
    ...schemaViolations("memories", memorySchema, snapshot.memories, (r) => field(r, "occurrenceId")),
    ...schemaViolations("photos", photoSchema, snapshot.photos, (r) => field(r, "id")),
    ...schemaViolations("onboardingDraft", onboardingDraftSchema, snapshot.onboardingDraft, (r) => field(r, "id")),
  );

  // DB-001: 단일 레코드 store
  for (const store of ["couple", "settings", "onboardingDraft"] as const) {
    const rows = snapshot[store];
    if (rows.length > 1) push("DB-001", store, String(rows.length), `${store} 레코드는 최대 1건이어야 합니다.`);
    for (const row of rows) if (row.id !== "default") push("DB-001", store, String(row.id), "ID는 default 여야 합니다.");
  }

  // DB-002: 완료 상태 ↔ 커플 데이터 일치
  const settings = snapshot.settings.find((s) => s.id === "default");
  const couple = snapshot.couple.find((c) => c.id === "default");
  if (!settings) {
    const hasData = snapshot.couple.length + snapshot.anniversaries.length + snapshot.memories.length + snapshot.photos.length > 0;
    if (hasData) push("DB-002", "settings", "default", "설정 레코드 없이 데이터가 존재합니다.");
  } else if (settings.onboardingCompleted && !couple) {
    push("DB-002", "couple", "default", "완료 상태이지만 커플 정보가 없습니다.");
  } else if (!settings.onboardingCompleted) {
    const leftovers = snapshot.couple.length + snapshot.anniversaries.length + snapshot.anniversaryExceptions.length + snapshot.memories.length + snapshot.photos.length;
    if (leftovers > 0) push("DB-002", "settings", "default", "미완료 상태이지만 완료 데이터가 존재합니다.");
  }

  // 사진 그룹화
  const photosById = new Map(snapshot.photos.map((p) => [p.id, p]));
  const photosByOwner = new Map<string, Photo[]>();
  for (const photo of snapshot.photos) {
    const key = `${photo.ownerType}|${photo.ownerId}`;
    photosByOwner.set(key, [...(photosByOwner.get(key) ?? []), photo]);
  }
  if (photosById.size !== snapshot.photos.length) push("DB-011", "photos", "id", "사진 ID가 중복됩니다.");

  // 프로필 사진: DB-004(역할당 1장), 참조 일치
  for (const role of ["self", "partner"] as const) {
    const owned = photosByOwner.get(`profile|${role}`) ?? [];
    if (owned.length > 1) push("DB-004", "photos", role, "프로필 사진은 역할당 최대 1장입니다.");
    const referencedId = role === "self" ? couple?.myPhotoId : couple?.partnerPhotoId;
    if (referencedId) {
      const photo = photosById.get(referencedId);
      if (!photo || photo.ownerType !== "profile" || photo.ownerId !== role) {
        push("DB-011", "couple", role, "프로필 사진 참조가 올바르지 않습니다.");
      }
    }
    for (const photo of owned) {
      if (photo.id !== referencedId) push("DB-011", "photos", photo.id, "참조되지 않는 프로필 사진입니다.");
    }
  }

  // 사용자 지정 시리즈 / 예외
  const seriesById = new Map(snapshot.anniversaries.map((a) => [a.id, a]));
  if (seriesById.size !== snapshot.anniversaries.length) push("DB-011", "anniversaries", "id", "기념일 ID가 중복됩니다.");
  const cancelled = new Set<string>();
  const exceptionKeys = new Set<string>();
  for (const exception of snapshot.anniversaryExceptions) {
    const key = exceptionKey(exception.seriesId, exception.occurrenceYear);
    const ref = `${exception.seriesId}:${exception.occurrenceYear}`;
    if (exceptionKeys.has(key)) push("DB-009", "anniversaryExceptions", ref, "같은 연도 예외가 중복됩니다.");
    exceptionKeys.add(key);
    const series = seriesById.get(exception.seriesId);
    if (!series || series.repeatType !== "yearly") {
      push("DB-009", "anniversaryExceptions", ref, "반복 예외는 존재하는 매년 반복 시리즈에만 연결됩니다.");
    } else if (exception.occurrenceYear < getLocalDateYear(series.date)) {
      push("DB-009", "anniversaryExceptions", ref, "등록 연도 이전 발생 건에는 예외를 둘 수 없습니다.");
    }
    if (exception.kind === "cancelled") cancelled.add(`custom:${exception.seriesId}:${exception.occurrenceYear}`);
  }

  // 발생 ID 유효성 (DB-011) 및 취소 발생 건 (DB-010)
  const occurrenceProblem = (occurrenceId: string): { rule: IntegrityRule; message: string } | null => {
    const parsed = parseOccurrenceId(occurrenceId);
    if (!parsed) return { rule: "DB-011", message: "발생 ID 형식이 올바르지 않습니다." };
    if (parsed.kind === "auto-day" && !isAutoDayMilestoneNumber(parsed.days)) return { rule: "DB-011", message: "존재하지 않는 자동 일수 기념일입니다." };
    if (parsed.kind === "custom") {
      const series = seriesById.get(parsed.seriesId);
      if (!series) return { rule: "DB-011", message: "존재하지 않는 사용자 지정 기념일입니다." };
      if (series.repeatType === "none" && parsed.occurrenceYear !== null) return { rule: "DB-011", message: "일회성 기념일에 연도 발생 ID를 사용했습니다." };
      if (series.repeatType === "yearly") {
        if (parsed.occurrenceYear === null) return { rule: "DB-011", message: "반복 기념일에는 발생 연도가 필요합니다." };
        if (parsed.occurrenceYear < getLocalDateYear(series.date)) return { rule: "DB-011", message: "등록 연도 이전 발생 건입니다." };
        if (cancelled.has(occurrenceId)) return { rule: "DB-010", message: "취소된 발생 건에 기록이 연결되어 있습니다." };
      }
    }
    return null;
  };

  const memoriesById = new Map(snapshot.memories.map((m) => [m.occurrenceId, m]));
  if (memoriesById.size !== snapshot.memories.length) push("DB-001", "memories", "occurrenceId", "같은 발생 건의 추억이 중복됩니다.");

  for (const memory of snapshot.memories) {
    const problem = occurrenceProblem(memory.occurrenceId);
    if (problem) push(problem.rule, "memories", memory.occurrenceId, problem.message);
    const owned = photosByOwner.get(`memory|${memory.occurrenceId}`) ?? [];
    // DB-005: 대표 사진은 해당 추억 소유 사진, 사진이 없으면 null
    if (memory.coverPhotoId !== null && !owned.some((p) => p.id === memory.coverPhotoId)) {
      push("DB-005", "memories", memory.occurrenceId, "대표 사진이 해당 추억의 사진이 아닙니다.");
    }
    // DB-006: 사진이 있으면 대표 사진 존재
    if (owned.length > 0 && memory.coverPhotoId === null) push("DB-006", "memories", memory.occurrenceId, "사진이 있지만 대표 사진이 없습니다.");
  }

  for (const [key, owned] of photosByOwner) {
    const [ownerType, ownerId] = key.split("|") as ["profile" | "memory", string];
    if (ownerType !== "memory") continue;
    const problem = occurrenceProblem(ownerId);
    if (problem) push(problem.rule, "photos", ownerId, problem.message);
    if (!memoriesById.has(ownerId)) push("DB-011", "photos", ownerId, "추억 레코드 없이 사진이 존재합니다.");
    // DB-004: 발생 건당 최대 5장
    if (owned.length > MAX_MEMORY_PHOTOS) push("DB-004", "photos", ownerId, `기념일당 사진은 최대 ${MAX_MEMORY_PHOTOS}장입니다.`);
    // DB-007: sortOrder 0부터 연속, 중복 없음
    const orders = owned.map((p) => p.sortOrder).sort((a, b) => a - b);
    if (orders.some((order, index) => order !== index)) push("DB-007", "photos", ownerId, "사진 순서가 0부터 연속되지 않습니다.");
    // DB-008: 같은 추억 내 sourceHash 중복 금지
    if (new Set(owned.map((p) => p.sourceHash)).size !== owned.length) push("DB-008", "photos", ownerId, "같은 추억에 동일한 원본 사진이 있습니다.");
  }

  return violations;
}
