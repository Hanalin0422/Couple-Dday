/**
 * 백업 형식 v1 JSON 스키마 (ARCHITECTURE.md §10, BAK-002~008, RES-002, RES-003, RES-E02).
 * 백업 파일은 외부 입력으로 취급하여 엄격히 검증한다(NFR-005). 예상하지 않은 필드는 거부한다.
 */
import { z } from "zod";
import {
  anniversaryExceptionSchema,
  coupleSchema,
  customAnniversarySchema,
  instantSchema,
  memorySchema,
  sha256HexSchema,
  SUPPORTED_IMAGE_MIME_TYPES,
  uuidSchema,
} from "./entity-schemas";

export const BACKUP_FORMAT = "couple-dday-backup";
export const BACKUP_FORMAT_VERSION = 1;

export const BACKUP_FILES = {
  manifest: "manifest.json",
  couple: "couple.json",
  settings: "settings.json",
  anniversaries: "anniversaries.json",
  anniversaryExceptions: "anniversaryExceptions.json",
  memories: "memories.json",
  photos: "photos.json",
} as const;

const count = z.number().int().nonnegative();

export const manifestSchema = z.strictObject({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.number().int().positive(),
  databaseVersion: z.number().int().positive(),
  appVersion: z.string().max(32),
  createdAt: instantSchema,
  encrypted: z.literal(false),
  counts: z.strictObject({ couples: count, anniversaries: count, anniversaryExceptions: count, memories: count, photos: count }),
});
export type BackupManifest = z.infer<typeof manifestSchema>;

export const backupSettingsSchema = z.strictObject({ dayOffset: z.union([z.literal(0), z.literal(1)]) });

const EXTENSIONS: Record<(typeof SUPPORTED_IMAGE_MIME_TYPES)[number], string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function imagePathFor(photo: { id: string; ownerType: "profile" | "memory"; mimeType: (typeof SUPPORTED_IMAGE_MIME_TYPES)[number] }): string {
  return `images/${photo.ownerType === "profile" ? "profiles" : "memories"}/${photo.id}.${EXTENSIONS[photo.mimeType]}`;
}

/** photos.json 항목: Photo 에서 이미지 바이트(data)를 빼고 path 를 더한 구조 (§10). */
export const backupPhotoSchema = z
  .strictObject({
    id: uuidSchema,
    ownerType: z.enum(["profile", "memory"]),
    ownerId: z.string(),
    path: z.string(),
    sourceHash: sha256HexSchema,
    contentHash: sha256HexSchema,
    mimeType: z.enum(SUPPORTED_IMAGE_MIME_TYPES),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    size: z.number().int().positive(),
    sortOrder: z.number().int().nonnegative(),
    createdAt: instantSchema,
  })
  .refine((p) => p.path === imagePathFor(p), { message: "이미지 경로와 MIME/ID 가 일치하지 않습니다.", path: ["path"] });
export type BackupPhoto = z.infer<typeof backupPhotoSchema>;

export const backupSchemas = {
  couple: coupleSchema,
  settings: backupSettingsSchema,
  anniversaries: z.array(customAnniversarySchema),
  anniversaryExceptions: z.array(anniversaryExceptionSchema),
  memories: z.array(memorySchema),
  photos: z.array(backupPhotoSchema),
};
