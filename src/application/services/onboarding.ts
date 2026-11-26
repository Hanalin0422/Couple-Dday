/**
 * 온보딩 유스케이스 (ONB-001~013, ONB-E01~E09, ARCHITECTURE.md §8.2).
 *
 * - 입력 중인 이름·날짜·계산 방식·선택 사진을 draft 에 임시 저장한다(마지막 성공 저장까지만 복구 보장).
 * - 완료 시 couple / settings / photos / draft 를 하나의 트랜잭션으로 처리하고 draft 를 삭제한다.
 */
import type { Couple, DayOffset, DraftImage, LocalDate, OnboardingDraft, Photo } from "@/domain/entities";
import { toInstant } from "@/domain/date/instant";
import { validateStartDateInput, type DateRuleViolation } from "@/domain/policies/date-rules";
import {
  NAME_MAX_LENGTH,
  normalizeRequiredText,
  validateRequiredText,
  type TextRuleViolation,
} from "@/domain/policies/text-rules";
import type { CoupleDatabase } from "@/infrastructure/db/database";
import { IntegrityError, ValidationError } from "../errors";
import { onboardingDraftSchema } from "../validation/entity-schemas";
import { runWriteTransaction } from "./write-transaction";

export interface OnboardingInput {
  myName: string;
  partnerName: string;
  startDate: LocalDate | null;
  dayOffset: DayOffset;
  myPhoto: DraftImage | null;
  partnerPhoto: DraftImage | null;
}

export interface OnboardingIssues {
  myName?: TextRuleViolation;
  partnerName?: TextRuleViolation;
  startDate?: DateRuleViolation | "missing";
}

/** 시작하기 버튼 활성화 및 저장 직전 재검증 (ONB-008, ONB-E01, ONB-E04, DATE-008). */
export function validateOnboardingInput(input: OnboardingInput, today: LocalDate): OnboardingIssues {
  const issues: OnboardingIssues = {};
  const myName = validateRequiredText(input.myName, NAME_MAX_LENGTH);
  const partnerName = validateRequiredText(input.partnerName, NAME_MAX_LENGTH);
  if (myName) issues.myName = myName;
  if (partnerName) issues.partnerName = partnerName;
  if (input.startDate === null) issues.startDate = "missing";
  else {
    const dateIssue = validateStartDateInput(input.startDate, today);
    if (dateIssue) issues.startDate = dateIssue;
  }
  return issues;
}

export function hasIssues(issues: OnboardingIssues): boolean {
  return Object.keys(issues).length > 0;
}

interface WriteContext {
  expectedRevision: number;
  now?: () => Date;
}

/** 임시 입력 저장 (ONB-012). 반환값은 새 revision. */
export async function saveOnboardingDraft(db: CoupleDatabase, input: OnboardingInput, context: WriteContext): Promise<number> {
  const now = context.now ?? (() => new Date());
  const draft: OnboardingDraft = { id: "default", ...input, updatedAt: toInstant(now()) };
  const parsed = onboardingDraftSchema.safeParse(draft);
  if (!parsed.success) throw new ValidationError(parsed.error.issues.map((i) => i.path.join(".")));
  const { revision } = await runWriteTransaction(db, ["onboardingDraft"], { ...context, now }, async () => {
    const settings = await db.settings.get("default");
    if (settings?.onboardingCompleted) throw new IntegrityError([{ rule: "DB-002", store: "settings", ref: "default" }]);
    await db.onboardingDraft.put(draft);
  });
  return revision;
}

function profilePhoto(image: DraftImage, role: "self" | "partner", createdAt: string): Photo {
  return { id: crypto.randomUUID(), ownerType: "profile", ownerId: role, ...image, sortOrder: 0, createdAt };
}

/** 온보딩 완료 (ONB-009, ONB-013, ONB-E07). 실패 시 아무것도 바뀌지 않는다. */
export async function completeOnboarding(
  db: CoupleDatabase,
  input: OnboardingInput,
  context: WriteContext & { today: LocalDate },
): Promise<number> {
  const issues = validateOnboardingInput(input, context.today);
  if (hasIssues(issues) || input.startDate === null) throw new ValidationError(Object.keys(issues));
  const now = context.now ?? (() => new Date());
  const timestamp = toInstant(now());
  const myPhoto = input.myPhoto ? profilePhoto(input.myPhoto, "self", timestamp) : null;
  const partnerPhoto = input.partnerPhoto ? profilePhoto(input.partnerPhoto, "partner", timestamp) : null;
  const couple: Couple = {
    id: "default",
    myName: normalizeRequiredText(input.myName),
    partnerName: normalizeRequiredText(input.partnerName),
    startDate: input.startDate,
    myPhotoId: myPhoto?.id ?? null,
    partnerPhotoId: partnerPhoto?.id ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const { revision } = await runWriteTransaction(db, ["couple", "photos", "onboardingDraft"], { ...context, now }, async () => {
    const settings = await db.settings.get("default");
    if (!settings || settings.onboardingCompleted || (await db.couple.count()) > 0) {
      throw new IntegrityError([{ rule: "DB-002", store: "settings", ref: "default" }]);
    }
    await db.couple.add(couple);
    for (const photo of [myPhoto, partnerPhoto]) if (photo) await db.photos.add(photo);
    await db.settings.put({ ...settings, dayOffset: input.dayOffset, onboardingCompleted: true });
    await db.onboardingDraft.delete("default");
  });
  return revision;
}
