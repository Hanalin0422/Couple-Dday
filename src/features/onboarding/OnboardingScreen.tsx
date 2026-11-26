"use client";

/**
 * 온보딩 (SKILL.md §6, REQUIREMENTS.md §3 ONB-001~013).
 * 순서: 하트 그래픽 → 제목 → 보조 문구 → 프로필(+) → 내 이름 → 상대방 이름 → 처음 사귄 날 → 시작일 계산 방식 → 시작하기 → 기존 데이터 복원하기.
 * 하단 내비게이션 없음. 입력 중 내용은 자동 임시 저장되어 재실행 시 이어서 진행한다.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import type { DayOffset, LocalDate, OnboardingDraft, Settings } from "@/domain/entities";
import { formatDisplayDate } from "@/domain/date/local-date";
import { NAME_MAX_LENGTH } from "@/domain/policies/text-rules";
import {
  completeOnboarding,
  hasIssues,
  saveOnboardingDraft,
  validateOnboardingInput,
  type OnboardingInput,
} from "@/application/services/onboarding";
import { errorMessage } from "@/components/ui/BottomSheet";
import { DatePicker } from "@/components/ui/DatePicker";
import { HeartOutlineIcon, OnboardingHeartGraphic } from "@/components/ui/icons";
import { ImageFileInput, type ImageFileInputHandle } from "@/components/ui/ImageFileInput";
import { Button, SegmentedControl } from "@/components/ui/primitives";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { TextField } from "@/components/ui/TextField";
import { useDatabase } from "@/hooks/useDatabase";

export const DAY_OFFSET_OPTIONS = [
  { value: 0 as DayOffset, label: "0일부터" },
  { value: 1 as DayOffset, label: "1일부터" },
] as const;

const AUTOSAVE_DELAY_MS = 400;

function initialInput(draft: OnboardingDraft | null): OnboardingInput {
  if (!draft) return { myName: "", partnerName: "", startDate: null, dayOffset: 1, myPhoto: null, partnerPhoto: null };
  const { myName, partnerName, startDate, dayOffset, myPhoto, partnerPhoto } = draft;
  return { myName, partnerName, startDate, dayOffset, myPhoto, partnerPhoto };
}

export function OnboardingScreen({
  settings,
  draft,
  today,
  onCompleted,
}: {
  settings: Settings;
  draft: OnboardingDraft | null;
  today: LocalDate;
  onCompleted: () => Promise<void>;
}) {
  const db = useDatabase();
  const [form, setForm] = useState<OnboardingInput>(() => initialInput(draft));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const revision = useRef(settings.revision);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const touched = useRef(false);
  const fileInput = useRef<ImageFileInputHandle>(null);
  const pickingRole = useRef<"self" | "partner">("self");

  const issues = useMemo(() => validateOnboardingInput(form, today), [form, today]);
  const canSubmit = !hasIssues(issues) && !submitting;

  const update = (patch: Partial<OnboardingInput>) => {
    touched.current = true;
    setForm((prev) => ({ ...prev, ...patch }));
  };

  // 입력 변경 후 잠시 뒤 임시 저장 (ONB-012). 저장은 순서대로 직렬 처리한다.
  useEffect(() => {
    if (!touched.current) return;
    const timer = setTimeout(() => {
      queue.current = queue.current.then(async () => {
        try {
          revision.current = await saveOnboardingDraft(db, form, { expectedRevision: revision.current });
          setNotice(null);
        } catch {
          setNotice("입력 내용을 임시 저장하지 못했어요. 입력은 화면에 그대로 남아 있어요.");
        }
      });
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [db, form]);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await queue.current;
      revision.current = await completeOnboarding(db, form, { expectedRevision: revision.current, today });
      await onCompleted();
    } catch (error) {
      setSubmitError(errorMessage(error));
      setSubmitting(false);
    }
  };

  const avatar = (role: "self" | "partner", label: string) => (
    <div className="flex flex-col items-center gap-2">
      <ProfileAvatar
        role={role}
        photo={role === "self" ? form.myPhoto : form.partnerPhoto}
        size={76}
        badge="plus"
        label={`${label} 사진 선택 (선택 사항)`}
        onClick={() => {
          pickingRole.current = role;
          fileInput.current?.open();
        }}
      />
      <span className="text-[13px] font-medium text-text-secondary">{label}</span>
    </div>
  );

  return (
    <main className="fixed inset-0 overflow-y-auto bg-background" aria-label="시작하기">
      <div className="mx-auto flex min-h-full max-w-[480px] flex-col px-gutter pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+28px)]">
        <OnboardingHeartGraphic size={56} />
        <h1 className="mt-5 font-maruburi text-[28px] font-semibold leading-[1.35] text-text-primary">
          우리의 시간을
          <br />
          시작해 볼까요?
        </h1>
        <p className="mt-2 text-[14px] text-text-secondary">함께한 첫날부터 소중한 순간까지.</p>

        <div className="mt-8 flex items-start justify-center gap-6">
          {avatar("self", "나")}
          <span className="flex h-[76px] items-center text-accent">
            <HeartOutlineIcon size={14} />
          </span>
          {avatar("partner", "상대방")}
        </div>
        {notice && (
          <p role="status" className="mt-4 text-center text-[13px] text-danger">
            {notice}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-6">
          <TextField label="내 이름" value={form.myName} onChange={(myName) => update({ myName })} maxLength={NAME_MAX_LENGTH} placeholder="이름 또는 애칭" />
          <TextField label="상대방 이름" value={form.partnerName} onChange={(partnerName) => update({ partnerName })} maxLength={NAME_MAX_LENGTH} placeholder="이름 또는 애칭" />
          <div className="flex flex-col gap-2">
            <span id="start-date-label" className="text-[14px] font-medium text-text-body">
              처음 사귄 날
            </span>
            <button
              type="button"
              aria-labelledby="start-date-label"
              aria-haspopup="dialog"
              onClick={() => setPickerOpen(true)}
              className="flex h-[52px] items-center gap-2 rounded-[14px] border border-accent-soft bg-surface px-4 text-left focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Calendar size={18} className="text-text-secondary" aria-hidden="true" />
              <span className={form.startDate ? "flex-1 text-[16px] font-medium text-text-primary" : "flex-1 text-[16px] text-text-inactive"}>
                {form.startDate ? formatDisplayDate(form.startDate) : "날짜 선택"}
              </span>
              <ChevronDown size={18} className="text-text-secondary" aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[14px] font-medium text-text-body">시작일 계산 방식</span>
            <SegmentedControl label="시작일 계산 방식" options={DAY_OFFSET_OPTIONS} value={form.dayOffset} onChange={(dayOffset) => update({ dayOffset })} />
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-2">
          {submitError && (
            <p role="alert" className="text-[14px] text-danger">
              {submitError}
            </p>
          )}
          <Button onClick={submit} disabled={!canSubmit}>
            시작하기
          </Button>
          {/* 복원 기능은 Phase 7(백업/복원)에서 연결한다 (ONB-010). */}
          <Button variant="text" onClick={() => undefined}>
            기존 데이터 복원하기
          </Button>
        </div>
      </div>

      <DatePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={form.startDate}
        max={today}
        title="처음 사귄 날"
        onConfirm={(startDate) => {
          update({ startDate });
          setPickerOpen(false);
        }}
      />
      <ImageFileInput
        ref={fileInput}
        onImage={(image) => update(pickingRole.current === "self" ? { myPhoto: image } : { partnerPhoto: image })}
        onError={() => setNotice("사진을 불러오지 못했어요. 다른 사진을 선택해 주세요.")}
      />
    </main>
  );
}
