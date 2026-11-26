/**
 * 사용자 지정 기념일 유스케이스 (CUS-001~011, CUS-E01~E07, SET-017, ARC-A01~A05, ARCHITECTURE.md §6).
 *
 * - 모든 변경은 runWriteTransaction(단일 트랜잭션 + revision)으로 처리한다.
 * - 삭제는 연결된 추억(메모)·사진을 같은 트랜잭션에서 함께 삭제한다(사전 확인은 UI 담당).
 * - 해당 연도 삭제는 cancelled tombstone 으로 남겨 재생성을 막는다.
 */
import type { AnniversaryException, CustomAnniversary, LocalDate, RepeatType } from "@/domain/entities";
import { customOccurrenceId } from "@/domain/anniversary/occurrence-id";
import { exceptionKey, getYearlyOccurrenceDate } from "@/domain/anniversary/exceptions";
import { toInstant } from "@/domain/date/instant";
import { getLocalDateYear } from "@/domain/date/local-date";
import {
  validateEditedDate,
  validateOccurrenceDateEdit,
  validateSeriesDateEdit,
} from "@/domain/policies/anniversary-rules";
import {
  ANNIVERSARY_TITLE_MAX_LENGTH,
  normalizeRequiredText,
  validateRequiredText,
} from "@/domain/policies/text-rules";
import type { CoupleDatabase } from "@/infrastructure/db/database";
import { IntegrityError, ValidationError } from "../errors";
import { runWriteTransaction } from "./write-transaction";

interface WriteContext {
  expectedRevision: number;
  now?: () => Date;
}

export interface AnniversaryInput {
  title: string;
  date: LocalDate;
}

function checkTitle(title: string): string {
  const issue = validateRequiredText(title, ANNIVERSARY_TITLE_MAX_LENGTH);
  if (issue) throw new ValidationError([`title:${issue}`]);
  return normalizeRequiredText(title);
}

async function requireStartDate(db: CoupleDatabase): Promise<LocalDate> {
  const [couple, settings] = await Promise.all([db.couple.get("default"), db.settings.get("default")]);
  if (!couple || !settings?.onboardingCompleted) throw new IntegrityError([{ rule: "DB-002", store: "couple", ref: "default" }]);
  return couple.startDate;
}

async function requireSeries(db: CoupleDatabase, id: string, repeatType: RepeatType): Promise<CustomAnniversary> {
  const series = await db.anniversaries.get(id);
  if (!series || series.repeatType !== repeatType) throw new IntegrityError([{ rule: "DB-011", store: "anniversaries", ref: id }]);
  return series;
}

/** 발생 ID 목록 또는 접두사에 연결된 추억·사진 삭제 (같은 트랜잭션 안에서 호출). */
async function deleteLinkedRecords(db: CoupleDatabase, target: { ids?: string[]; prefix?: string }): Promise<void> {
  if (target.ids?.length) {
    await db.memories.bulkDelete(target.ids);
    for (const id of target.ids) await db.photos.where("[ownerType+ownerId]").equals(["memory", id]).delete();
  }
  if (target.prefix) {
    await db.memories.where("occurrenceId").startsWith(target.prefix).delete();
    await db.photos.where("[ownerType+ownerId]").between(["memory", target.prefix], ["memory", `${target.prefix}￿`]).delete();
  }
}

export interface LinkedRecordCount {
  memos: number;
  photos: number;
}

/** 삭제 전 안내용: 연결된 메모·사진 수 (CUS-E05). */
export async function countLinkedRecords(db: CoupleDatabase, target: { ids?: string[]; prefix?: string }): Promise<LinkedRecordCount> {
  let memos = 0;
  let photos = 0;
  const countMemory = (memo: string) => (memo.trim().length > 0 ? 1 : 0);
  for (const id of target.ids ?? []) {
    const memory = await db.memories.get(id);
    if (memory) memos += countMemory(memory.memo);
    photos += await db.photos.where("[ownerType+ownerId]").equals(["memory", id]).count();
  }
  if (target.prefix) {
    const memories = await db.memories.where("occurrenceId").startsWith(target.prefix).toArray();
    memos += memories.reduce((sum, m) => sum + countMemory(m.memo), 0);
    photos += await db.photos.where("[ownerType+ownerId]").between(["memory", target.prefix], ["memory", `${target.prefix}￿`]).count();
  }
  return { memos, photos };
}

/** 신규 등록 (CUS-001~004, CUS-009): 같은 이름·날짜도 독립 UUID 로 등록. */
export async function addCustomAnniversary(
  db: CoupleDatabase,
  input: AnniversaryInput & { repeatType: RepeatType },
  context: WriteContext,
): Promise<{ id: string; revision: number }> {
  const title = checkTitle(input.title);
  if (input.repeatType !== "none" && input.repeatType !== "yearly") throw new ValidationError(["repeatType"]);
  const now = context.now ?? (() => new Date());
  const id = crypto.randomUUID();
  const timestamp = toInstant(now());
  const { revision } = await runWriteTransaction(db, ["couple", "anniversaries"], { ...context, now }, async () => {
    const startDate = await requireStartDate(db);
    const issue = validateEditedDate(input.date, null, startDate);
    if (issue) throw new ValidationError([`date:${issue}`]);
    await db.anniversaries.add({ id, title, date: input.date, repeatType: input.repeatType, createdAt: timestamp, updatedAt: timestamp });
  });
  return { id, revision };
}

/** 일회성 수정 (CUS-005): ID 유지. 날짜를 바꾸면 시작일 이상. */
export async function updateOneTimeAnniversary(db: CoupleDatabase, id: string, input: AnniversaryInput, context: WriteContext): Promise<number> {
  const title = checkTitle(input.title);
  const now = context.now ?? (() => new Date());
  const { revision } = await runWriteTransaction(db, ["couple", "anniversaries"], { ...context, now }, async () => {
    const startDate = await requireStartDate(db);
    const series = await requireSeries(db, id, "none");
    const issue = validateEditedDate(input.date, series.date, startDate);
    if (issue) throw new ValidationError([`date:${issue}`]);
    await db.anniversaries.put({ ...series, title, date: input.date, updatedAt: toInstant(now()) });
  });
  return revision;
}

/** 전체 반복 수정 (ARC-A02): 월·일만 변경, 개별 연도 예외 유지. */
export async function updateAnniversarySeries(db: CoupleDatabase, id: string, input: AnniversaryInput, context: WriteContext): Promise<number> {
  const title = checkTitle(input.title);
  const now = context.now ?? (() => new Date());
  const { revision } = await runWriteTransaction(db, ["couple", "anniversaries"], { ...context, now }, async () => {
    const startDate = await requireStartDate(db);
    const series = await requireSeries(db, id, "yearly");
    const issue = validateSeriesDateEdit(input.date, series.date, startDate);
    if (issue) throw new ValidationError([`date:${issue}`]);
    await db.anniversaries.put({ ...series, title, date: input.date, updatedAt: toInstant(now()) });
  });
  return revision;
}

/**
 * 해당 연도만 수정 (ARC-A02): override upsert, 발생 ID 유지, 같은 연도 안에서만 이동.
 * 시리즈 값과 같은 필드는 저장하지 않으며, 차이가 없으면 기존 override 를 제거한다.
 */
export async function updateAnniversaryOccurrence(
  db: CoupleDatabase,
  seriesId: string,
  occurrenceYear: number,
  input: AnniversaryInput,
  context: WriteContext,
): Promise<number> {
  const title = checkTitle(input.title);
  const now = context.now ?? (() => new Date());
  const { revision } = await runWriteTransaction(db, ["couple", "anniversaries", "anniversaryExceptions"], { ...context, now }, async () => {
    const startDate = await requireStartDate(db);
    const series = await requireSeries(db, seriesId, "yearly");
    if (occurrenceYear < getLocalDateYear(series.date)) throw new ValidationError(["occurrenceYear"]);
    const existing = await db.anniversaryExceptions.get([seriesId, occurrenceYear]);
    if (existing?.kind === "cancelled") throw new IntegrityError([{ rule: "DB-010", store: "anniversaryExceptions", ref: exceptionKey(seriesId, occurrenceYear) }]);
    const baseDate = getYearlyOccurrenceDate(series.date, occurrenceYear);
    const previousDate = existing?.overrideDate ?? baseDate;
    const issue = validateOccurrenceDateEdit(input.date, occurrenceYear, previousDate, startDate);
    if (issue) throw new ValidationError([`date:${issue}`]);
    const timestamp = toInstant(now());
    const overrideTitle = title !== series.title ? title : undefined;
    const overrideDate = input.date !== baseDate ? input.date : undefined;
    if (overrideTitle === undefined && overrideDate === undefined) {
      await db.anniversaryExceptions.delete([seriesId, occurrenceYear]);
      return;
    }
    const exception: AnniversaryException = {
      seriesId,
      occurrenceYear,
      kind: "override",
      ...(overrideTitle !== undefined ? { overrideTitle } : {}),
      ...(overrideDate !== undefined ? { overrideDate } : {}),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    await db.anniversaryExceptions.put(exception);
  });
  return revision;
}

/** 일회성 삭제 (CUS-006, SET-017): 연결 메모·사진 함께 삭제. */
export async function deleteOneTimeAnniversary(db: CoupleDatabase, id: string, context: WriteContext): Promise<number> {
  const { revision } = await runWriteTransaction(db, ["anniversaries", "memories", "photos"], context, async () => {
    await requireSeries(db, id, "none");
    await db.anniversaries.delete(id);
    await deleteLinkedRecords(db, { ids: [customOccurrenceId(id)] });
  });
  return revision;
}

/** 해당 연도만 삭제 (ARC-A03): cancelled tombstone, 해당 발생 건의 메모·사진 삭제. */
export async function deleteAnniversaryOccurrence(db: CoupleDatabase, seriesId: string, occurrenceYear: number, context: WriteContext): Promise<number> {
  const now = context.now ?? (() => new Date());
  const { revision } = await runWriteTransaction(db, ["anniversaries", "anniversaryExceptions", "memories", "photos"], { ...context, now }, async () => {
    const series = await requireSeries(db, seriesId, "yearly");
    if (occurrenceYear < getLocalDateYear(series.date)) throw new ValidationError(["occurrenceYear"]);
    const timestamp = toInstant(now());
    const existing = await db.anniversaryExceptions.get([seriesId, occurrenceYear]);
    await db.anniversaryExceptions.put({ seriesId, occurrenceYear, kind: "cancelled", createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp });
    await deleteLinkedRecords(db, { ids: [customOccurrenceId(seriesId, occurrenceYear)] });
  });
  return revision;
}

/** 전체 반복 삭제 (ARC-A03): 시리즈·모든 예외·모든 연결 메모·사진 삭제. */
export async function deleteAnniversarySeries(db: CoupleDatabase, seriesId: string, context: WriteContext): Promise<number> {
  const { revision } = await runWriteTransaction(db, ["anniversaries", "anniversaryExceptions", "memories", "photos"], context, async () => {
    await requireSeries(db, seriesId, "yearly");
    await db.anniversaries.delete(seriesId);
    await db.anniversaryExceptions.where("seriesId").equals(seriesId).delete();
    await deleteLinkedRecords(db, { prefix: `${customOccurrenceId(seriesId)}:` });
  });
  return revision;
}
