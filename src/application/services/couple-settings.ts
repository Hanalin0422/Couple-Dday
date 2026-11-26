/**
 * 커플 정보·설정 변경 유스케이스 (SET-001~007, SET-014, SET-015, SET-E01~E05, ARCHITECTURE.md §8.2).
 * 항목별 저장, 커밋 성공 후 UI 갱신. 시작일/오프셋 변경은 추억 ID를 바꾸거나 삭제하지 않는다(DB-012).
 */
import type { Couple, DayOffset, DraftImage, LocalDate, Photo } from "@/domain/entities";
import { toInstant } from "@/domain/date/instant";
import { validateStartDateInput } from "@/domain/policies/date-rules";
import { NAME_MAX_LENGTH, normalizeRequiredText, validateRequiredText } from "@/domain/policies/text-rules";
import type { CoupleDatabase } from "@/infrastructure/db/database";
import { IntegrityError, ValidationError } from "../errors";
import { draftImageSchema } from "../validation/entity-schemas";
import { runWriteTransaction } from "./write-transaction";

export type ProfileRole = "self" | "partner";

interface WriteContext {
  expectedRevision: number;
  now?: () => Date;
}

async function requireCouple(db: CoupleDatabase): Promise<Couple> {
  const [couple, settings] = await Promise.all([db.couple.get("default"), db.settings.get("default")]);
  if (!couple || !settings?.onboardingCompleted) throw new IntegrityError([{ rule: "DB-002", store: "couple", ref: "default" }]);
  return couple;
}

export async function updateName(db: CoupleDatabase, role: ProfileRole, value: string, context: WriteContext): Promise<number> {
  const issue = validateRequiredText(value, NAME_MAX_LENGTH);
  if (issue) throw new ValidationError([issue]);
  const name = normalizeRequiredText(value);
  const now = context.now ?? (() => new Date());
  const { revision } = await runWriteTransaction(db, ["couple"], { ...context, now }, async () => {
    const couple = await requireCouple(db);
    await db.couple.put({ ...couple, [role === "self" ? "myName" : "partnerName"]: name, updatedAt: toInstant(now()) });
  });
  return revision;
}

export async function updateStartDate(
  db: CoupleDatabase,
  startDate: LocalDate,
  context: WriteContext & { today: LocalDate },
): Promise<number> {
  const issue = validateStartDateInput(startDate, context.today);
  if (issue) throw new ValidationError([issue]);
  const now = context.now ?? (() => new Date());
  const { revision } = await runWriteTransaction(db, ["couple"], { ...context, now }, async () => {
    const couple = await requireCouple(db);
    await db.couple.put({ ...couple, startDate, updatedAt: toInstant(now()) });
  });
  return revision;
}

export async function updateDayOffset(db: CoupleDatabase, dayOffset: DayOffset, context: WriteContext): Promise<number> {
  if (dayOffset !== 0 && dayOffset !== 1) throw new ValidationError(["dayOffset"]);
  const { revision } = await runWriteTransaction(db, ["couple"], context, async () => {
    await requireCouple(db);
    await db.settings.update("default", { dayOffset });
  });
  return revision;
}

/** 프로필 사진 교체: 신규 사진 추가·참조 변경·기존 사진 삭제를 한 트랜잭션으로 처리 (SET-003, DB-004). */
export async function setProfilePhoto(db: CoupleDatabase, role: ProfileRole, image: DraftImage, context: WriteContext): Promise<number> {
  const parsed = draftImageSchema.safeParse(image);
  if (!parsed.success) throw new ValidationError(parsed.error.issues.map((i) => i.path.join(".")));
  const now = context.now ?? (() => new Date());
  const timestamp = toInstant(now());
  const photo: Photo = { id: crypto.randomUUID(), ownerType: "profile", ownerId: role, ...image, sortOrder: 0, createdAt: timestamp };
  const { revision } = await runWriteTransaction(db, ["couple", "photos"], { ...context, now }, async () => {
    const couple = await requireCouple(db);
    await db.photos.where("[ownerType+ownerId]").equals(["profile", role]).delete();
    await db.photos.add(photo);
    await db.couple.put({ ...couple, [role === "self" ? "myPhotoId" : "partnerPhotoId"]: photo.id, updatedAt: timestamp });
  });
  return revision;
}

/** 프로필 사진 삭제 → 기본 이미지 (SET-004, SET-E03). */
export async function removeProfilePhoto(db: CoupleDatabase, role: ProfileRole, context: WriteContext): Promise<number> {
  const now = context.now ?? (() => new Date());
  const { revision } = await runWriteTransaction(db, ["couple", "photos"], { ...context, now }, async () => {
    const couple = await requireCouple(db);
    await db.photos.where("[ownerType+ownerId]").equals(["profile", role]).delete();
    await db.couple.put({ ...couple, [role === "self" ? "myPhotoId" : "partnerPhotoId"]: null, updatedAt: toInstant(now()) });
  });
  return revision;
}
