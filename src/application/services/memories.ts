/**
 * 추억 사진·메모 유스케이스 (MEM-001~016, MEM-E01~E12, ARC-B01~B08, DB-004~DB-008, ARCHITECTURE.md §9).
 *
 * 저장 흐름(2026-11-26 사용자 요청): 사진 선택·메모 입력·대표·순서·사진 빼기를 화면에서 모아 두고 "저장" 한 번으로 반영한다.
 * - 사진 디코딩·압축·해시는 선택 시점에 트랜잭션 밖에서 끝낸다(손상·중복 등 사진별 실패는 그때 안내, MEM-012).
 * - saveMemory 는 삭제·추가·순서·대표·메모를 하나의 트랜잭션으로 커밋한다. 실패 시 아무것도 바뀌지 않는다.
 * - 트랜잭션 안에서 발생 건의 현재 날짜(새 사진은 과거·당일만), 5장 제한, 같은 추억 내 원본 중복을 다시 검증한다.
 * - 대표가 지정되지 않았거나 빠지면 첫 사진이 대표(ARC-B03). 순서는 0부터 연속(DB-007).
 * - 사진 없는 메모 허용(ARC-B05). 미래가 된 기존 기록의 메모 수정 허용(ARC-B06), 기록 없는 미래 발생 건의 신규 기록은 제한.
 * - 사진도 메모도 없으면 추억 레코드를 남기지 않는다.
 */
import type { DraftImage, LocalDate } from "@/domain/entities";
import { resolveOccurrence, type ResolvedOccurrence } from "@/domain/anniversary/resolve";
import { toInstant } from "@/domain/date/instant";
import { canAddNewMemoryPhoto } from "@/domain/policies/date-rules";
import { MEMO_MAX_LENGTH, validateOptionalText } from "@/domain/policies/text-rules";
import type { CoupleDatabase } from "@/infrastructure/db/database";
import { IntegrityError, ValidationError } from "../errors";
import { draftImageSchema } from "../validation/entity-schemas";
import { MAX_MEMORY_PHOTOS } from "../validation/integrity";
import { runWriteTransaction } from "./write-transaction";

interface WriteContext {
  expectedRevision: number;
  now?: () => Date;
}

export type MemoryFailure = "future-occurrence" | "limit-reached" | "duplicate" | "unknown-occurrence";

/** 추억 등록 정책 위반 (사용자 안내용 사유 포함). */
export class MemoryPolicyError extends Error {
  constructor(readonly reason: MemoryFailure) {
    super(`추억 등록 불가: ${reason}`);
    this.name = "MemoryPolicyError";
  }
}

const MEMORY_STORES = ["couple", "anniversaries", "anniversaryExceptions", "memories", "photos"] as const;

/** 트랜잭션 안에서 현재 설정 기준으로 발생 건을 해석한다. */
async function resolveInTransaction(db: CoupleDatabase, occurrenceId: string): Promise<ResolvedOccurrence> {
  const [couple, settings, series, exceptions] = await Promise.all([
    db.couple.get("default"),
    db.settings.get("default"),
    db.anniversaries.toArray(),
    db.anniversaryExceptions.toArray(),
  ]);
  if (!couple || !settings?.onboardingCompleted) throw new IntegrityError([{ rule: "DB-002", store: "couple", ref: "default" }]);
  const resolved = resolveOccurrence(occurrenceId, { startDate: couple.startDate, dayOffset: settings.dayOffset, series, exceptions });
  if (!resolved) throw new MemoryPolicyError("unknown-occurrence");
  return resolved;
}

export interface MemoryEdit {
  /**
   * 저장 후 사진 순서. 기존 사진은 photo.id, 새 사진은 newPhotos 의 key.
   * 기존 사진 중 목록에 없는 것은 삭제된다.
   */
  order: readonly string[];
  newPhotos: readonly { key: string; image: DraftImage }[];
  /** 대표로 지정할 사진(photo.id 또는 새 사진 key). null 이면 첫 사진 */
  cover: string | null;
  memo: string;
}

/** 추억 저장: 사진 삭제·추가·순서·대표·메모를 하나의 트랜잭션으로 반영 (MEM-001~013). */
export async function saveMemory(
  db: CoupleDatabase,
  occurrenceId: string,
  edit: MemoryEdit,
  context: WriteContext & { today: LocalDate },
): Promise<number> {
  if (validateOptionalText(edit.memo, MEMO_MAX_LENGTH)) throw new ValidationError(["memo:too-long"]);
  for (const { image } of edit.newPhotos) {
    const parsed = draftImageSchema.safeParse(image);
    if (!parsed.success) throw new ValidationError(parsed.error.issues.map((i) => i.path.join(".")));
  }
  if (new Set(edit.order).size !== edit.order.length) throw new ValidationError(["order"]);
  if (edit.order.length > MAX_MEMORY_PHOTOS) throw new MemoryPolicyError("limit-reached");
  const newByKey = new Map(edit.newPhotos.map((p) => [p.key, p.image]));
  if (newByKey.size !== edit.newPhotos.length || ![...newByKey.keys()].every((key) => edit.order.includes(key))) throw new ValidationError(["newPhotos"]);

  const now = context.now ?? (() => new Date());
  const timestamp = toInstant(now());
  const newIds = new Map(edit.newPhotos.map((p) => [p.key, crypto.randomUUID()]));

  const { revision } = await runWriteTransaction(db, MEMORY_STORES, { ...context, now }, async () => {
    const occurrence = await resolveInTransaction(db, occurrenceId);
    const existingMemory = await db.memories.get(occurrenceId);
    const existingPhotos = await db.photos.where("[ownerType+ownerId]").equals(["memory", occurrenceId]).toArray();
    const existingById = new Map(existingPhotos.map((p) => [p.id, p]));
    const canAddNew = canAddNewMemoryPhoto(occurrence.date, context.today);

    for (const key of edit.order) if (!existingById.has(key) && !newByKey.has(key)) throw new ValidationError(["order"]);
    if (newByKey.size > 0 && !canAddNew) throw new MemoryPolicyError("future-occurrence");
    const keptHashes = edit.order.map((key) => existingById.get(key)?.sourceHash ?? newByKey.get(key)!.sourceHash);
    if (new Set(keptHashes).size !== keptHashes.length) throw new MemoryPolicyError("duplicate");

    const finalIds = edit.order.map((key) => (existingById.has(key) ? key : newIds.get(key)!));
    const hasContent = finalIds.length > 0 || edit.memo.trim().length > 0;
    if (!existingMemory && hasContent && !canAddNew) throw new MemoryPolicyError("future-occurrence");

    // 1) 목록에서 빠진 기존 사진 삭제
    for (const photo of existingPhotos) if (!edit.order.includes(photo.id)) await db.photos.delete(photo.id);
    // 2) 기존 사진의 최종 순서 반영 후 새 사진 추가 (순서 인덱스는 고유 제약이 아님)
    for (const [index, key] of edit.order.entries()) {
      if (existingById.has(key)) await db.photos.update(key, { sortOrder: index });
    }
    for (const [index, key] of edit.order.entries()) {
      const image = newByKey.get(key);
      if (image) await db.photos.add({ id: newIds.get(key)!, ownerType: "memory", ownerId: occurrenceId, ...image, sortOrder: index, createdAt: timestamp });
    }
    // 3) 추억 레코드
    if (!hasContent) {
      await db.memories.delete(occurrenceId);
      return;
    }
    const coverId = edit.cover === null ? null : existingById.has(edit.cover) ? edit.cover : (newIds.get(edit.cover) ?? null);
    await db.memories.put({
      occurrenceId,
      memo: edit.memo,
      coverPhotoId: finalIds.length === 0 ? null : coverId && finalIds.includes(coverId) ? coverId : finalIds[0],
      createdAt: existingMemory?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
  });
  return revision;
}

/** 추억 전체 삭제: 해당 발생 건의 사진·메모를 하나의 트랜잭션으로 삭제 (MEM-005, 사전 확인은 UI 담당). */
export async function deleteMemory(db: CoupleDatabase, occurrenceId: string, context: WriteContext): Promise<number> {
  const { revision } = await runWriteTransaction(db, ["memories", "photos"], context, async () => {
    await db.photos.where("[ownerType+ownerId]").equals(["memory", occurrenceId]).delete();
    await db.memories.delete(occurrenceId);
  });
  return revision;
}
