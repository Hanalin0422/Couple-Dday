/**
 * 앱 시작 상태 판정 (ARCHITECTURE.md §5.3, REQUIREMENTS.md §15 실행 흐름, ONB-001, PWA-007, PWA-008, PWA-E03).
 *
 * DB 조회 → 실패 시 오류(자동 초기화 금지) → 유효한 완료 데이터면 메인
 * → 정상 미완료/빈 DB면 온보딩(임시 입력 복구) → 완료 플래그와 데이터가 불일치하면 손상(자동 덮어쓰기 금지).
 *
 * 빈 DB 와 손상 상태를 구분한다. 빈 DB 에서만 기본 settings 레코드를 만든다.
 */
import type { Couple, OnboardingDraft, Settings } from "@/domain/entities";
import { toInstant } from "@/domain/date/instant";
import { type CoupleDatabase, StorageError, toStorageError } from "@/infrastructure/db/database";
import { coupleSchema, onboardingDraftSchema, settingsSchema } from "../validation/entity-schemas";
import type { IntegrityRule } from "../validation/integrity";

export type AppState =
  | { status: "onboarding"; settings: Settings; draft: OnboardingDraft | null }
  | { status: "ready"; settings: Settings; couple: Couple }
  | { status: "corrupt"; problems: { rule: IntegrityRule; store: string; ref: string }[] }
  | { status: "error"; error: StorageError };

/** 신규 사용자 기본 설정 (dayOffset=1, lastBackupAt=null, onboardingCompleted=false). */
export function createDefaultSettings(now: Date, revision = 0): Settings {
  return { id: "default", dayOffset: 1, onboardingCompleted: false, lastBackupAt: null, revision, updatedAt: toInstant(now) };
}

async function countOtherStores(db: CoupleDatabase): Promise<number> {
  const counts = await Promise.all([
    db.couple.count(),
    db.anniversaries.count(),
    db.anniversaryExceptions.count(),
    db.memories.count(),
    db.photos.count(),
    db.onboardingDraft.count(),
  ]);
  return counts.reduce((a, b) => a + b, 0);
}

export async function loadAppState(db: CoupleDatabase, now: () => Date = () => new Date()): Promise<AppState> {
  try {
    return await db.transaction("rw", db.tables, async (): Promise<AppState> => {
      const settingsRows = await db.settings.toArray();
      const problems: { rule: IntegrityRule; store: string; ref: string }[] = [];

      if (settingsRows.length === 0) {
        if ((await countOtherStores(db)) > 0) {
          // 일부 데이터만 남은 상태: 신규 사용자로 판단하지 않는다.
          return { status: "corrupt", problems: [{ rule: "DB-002", store: "settings", ref: "default" }] };
        }
        const settings = createDefaultSettings(now());
        await db.settings.add(settings);
        return { status: "onboarding", settings, draft: null };
      }

      const settingsResult = settingsSchema.safeParse(settingsRows[0]);
      if (settingsRows.length > 1 || !settingsResult.success) {
        problems.push({ rule: settingsRows.length > 1 ? "DB-001" : "DB-003", store: "settings", ref: "default" });
        return { status: "corrupt", problems };
      }
      const settings = settingsResult.data;
      const coupleRows = await db.couple.toArray();
      const draftRows = await db.onboardingDraft.toArray();
      if (coupleRows.length > 1) problems.push({ rule: "DB-001", store: "couple", ref: String(coupleRows.length) });
      if (draftRows.length > 1) problems.push({ rule: "DB-001", store: "onboardingDraft", ref: String(draftRows.length) });

      if (!settings.onboardingCompleted) {
        const completedData = coupleRows.length + (await db.anniversaries.count()) + (await db.anniversaryExceptions.count()) + (await db.memories.count()) + (await db.photos.count());
        if (completedData > 0) problems.push({ rule: "DB-002", store: "settings", ref: "default" });
        const draftRow = draftRows[0];
        if (draftRow !== undefined && !onboardingDraftSchema.safeParse(draftRow).success) {
          problems.push({ rule: "DB-003", store: "onboardingDraft", ref: "default" });
        }
        if (problems.length) return { status: "corrupt", problems };
        return { status: "onboarding", settings, draft: draftRow ?? null };
      }

      const coupleResult = coupleSchema.safeParse(coupleRows[0]);
      if (!coupleResult.success) {
        problems.push({ rule: coupleRows[0] ? "DB-003" : "DB-002", store: "couple", ref: "default" });
        return { status: "corrupt", problems };
      }
      const couple = coupleResult.data;
      for (const [role, photoId] of [["self", couple.myPhotoId], ["partner", couple.partnerPhotoId]] as const) {
        if (!photoId) continue;
        const photo = await db.photos.get(photoId);
        if (!photo || photo.ownerType !== "profile" || photo.ownerId !== role) {
          problems.push({ rule: "DB-011", store: "couple", ref: role });
        }
      }
      if (problems.length) return { status: "corrupt", problems };
      return { status: "ready", settings, couple };
    });
  } catch (error) {
    return { status: "error", error: toStorageError(error) };
  }
}
