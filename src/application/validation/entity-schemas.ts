/**
 * 영속 엔티티 Zod 스키마 (ARC-E01, DB-001, DB-003, DB-014, ARCHITECTURE.md §5).
 * DB 쓰기 직전 및 백업 복원 검증에서 외부·저장 데이터를 신뢰하지 않고 검증한다.
 * strictObject 로 예상하지 않은 필드를 거부한다.
 */
import { z } from "zod";
import type {
  AnniversaryException,
  Couple,
  CustomAnniversary,
  DraftImage,
  Memory,
  OnboardingDraft,
  Photo,
  Settings,
} from "@/domain/entities";
import { validateInstant } from "@/domain/date/instant";
import { validateLocalDate } from "@/domain/date/local-date";
import { isValidSeriesId, parseOccurrenceId } from "@/domain/anniversary/occurrence-id";
import {
  ANNIVERSARY_TITLE_MAX_LENGTH,
  countCharacters,
  MEMO_MAX_LENGTH,
  NAME_MAX_LENGTH,
} from "@/domain/policies/text-rules";

export const localDateSchema = z.string().refine(validateLocalDate, "유효한 YYYY-MM-DD 날짜가 아닙니다.");
export const instantSchema = z.string().refine(validateInstant, "유효한 UTC ISO 8601 일시가 아닙니다.");
export const uuidSchema = z.string().refine(isValidSeriesId, "유효한 UUID가 아닙니다.");
export const sha256HexSchema = z.string().regex(/^[0-9a-f]{64}$/, "SHA-256 hex 값이 아닙니다.");
export const occurrenceIdSchema = z.string().refine((id) => parseOccurrenceId(id) !== null, "유효한 발생 ID가 아닙니다.");

/** 저장된 필수 텍스트: 이미 trim 되어 있고 1..max 자. */
function storedRequiredText(max: number) {
  return z
    .string()
    .refine((v) => v.length > 0 && v === v.trim(), "앞뒤 공백 없이 1자 이상이어야 합니다.")
    .refine((v) => countCharacters(v) <= max, `${max}자 이하여야 합니다.`);
}

const nameSchema = storedRequiredText(NAME_MAX_LENGTH);
const titleSchema = storedRequiredText(ANNIVERSARY_TITLE_MAX_LENGTH);

export const SUPPORTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const mimeTypeSchema = z.enum(SUPPORTED_IMAGE_MIME_TYPES);
const positiveInt = z.number().int().positive();

export const coupleSchema = z.strictObject({
  id: z.literal("default"),
  myName: nameSchema,
  partnerName: nameSchema,
  startDate: localDateSchema,
  myPhotoId: uuidSchema.nullable(),
  partnerPhotoId: uuidSchema.nullable(),
  createdAt: instantSchema,
  updatedAt: instantSchema,
}) satisfies z.ZodType<Couple>;

export const settingsSchema = z.strictObject({
  id: z.literal("default"),
  dayOffset: z.union([z.literal(0), z.literal(1)]),
  onboardingCompleted: z.boolean(),
  lastBackupAt: instantSchema.nullable(),
  revision: z.number().int().nonnegative(),
  updatedAt: instantSchema,
}) satisfies z.ZodType<Settings>;

export const customAnniversarySchema = z.strictObject({
  id: uuidSchema,
  title: titleSchema,
  date: localDateSchema,
  repeatType: z.enum(["none", "yearly"]),
  createdAt: instantSchema,
  updatedAt: instantSchema,
}) satisfies z.ZodType<CustomAnniversary>;

const exceptionBase = {
  seriesId: uuidSchema,
  occurrenceYear: positiveInt,
  createdAt: instantSchema,
  updatedAt: instantSchema,
};

export const anniversaryExceptionSchema = z.discriminatedUnion("kind", [
  z
    .strictObject({
      ...exceptionBase,
      kind: z.literal("override"),
      overrideTitle: titleSchema.optional(),
      overrideDate: localDateSchema.optional(),
    })
    .refine((v) => v.overrideTitle !== undefined || v.overrideDate !== undefined, "override 는 이름 또는 날짜를 포함해야 합니다."),
  z.strictObject({ ...exceptionBase, kind: z.literal("cancelled") }),
]) satisfies z.ZodType<AnniversaryException>;

export const memorySchema = z.strictObject({
  occurrenceId: occurrenceIdSchema,
  memo: z.string().refine((v) => countCharacters(v) <= MEMO_MAX_LENGTH, `${MEMO_MAX_LENGTH}자 이하여야 합니다.`),
  coverPhotoId: uuidSchema.nullable(),
  createdAt: instantSchema,
  updatedAt: instantSchema,
}) satisfies z.ZodType<Memory>;

const imageFields = {
  data: z.instanceof(ArrayBuffer),
  sourceHash: sha256HexSchema,
  contentHash: sha256HexSchema,
  mimeType: mimeTypeSchema,
  width: positiveInt,
  height: positiveInt,
  size: positiveInt,
};

const dataSizeMatches = (v: { data: ArrayBuffer; size: number }) => v.data.byteLength === v.size;

export const photoSchema = z
  .strictObject({
    id: uuidSchema,
    ownerType: z.enum(["profile", "memory"]),
    ownerId: z.string(),
    ...imageFields,
    sortOrder: z.number().int().nonnegative(),
    createdAt: instantSchema,
  })
  .refine(dataSizeMatches, { message: "이미지 바이트 크기와 size 가 다릅니다.", path: ["size"] })
  .refine(
    (v) => (v.ownerType === "profile" ? v.ownerId === "self" || v.ownerId === "partner" : parseOccurrenceId(v.ownerId) !== null),
    { message: "소유자 ID 형식이 올바르지 않습니다.", path: ["ownerId"] },
  )
  .refine((v) => v.ownerType === "memory" || v.sortOrder === 0, { message: "프로필 사진의 sortOrder 는 0이어야 합니다.", path: ["sortOrder"] }) satisfies z.ZodType<Photo>;

export const draftImageSchema = z
  .strictObject(imageFields)
  .refine(dataSizeMatches, { message: "이미지 바이트 크기와 size 가 다릅니다.", path: ["size"] }) satisfies z.ZodType<DraftImage>;

/** 온보딩 임시 입력은 작성 중 상태이므로 공백/빈 값을 허용하되 길이 상한은 지킨다. */
const draftNameSchema = z.string().refine((v) => countCharacters(v) <= NAME_MAX_LENGTH, `${NAME_MAX_LENGTH}자 이하여야 합니다.`);

export const onboardingDraftSchema = z.strictObject({
  id: z.literal("default"),
  myName: draftNameSchema,
  partnerName: draftNameSchema,
  startDate: localDateSchema.nullable(),
  dayOffset: z.union([z.literal(0), z.literal(1)]),
  myPhoto: draftImageSchema.nullable(),
  partnerPhoto: draftImageSchema.nullable(),
  updatedAt: instantSchema,
}) satisfies z.ZodType<OnboardingDraft>;
