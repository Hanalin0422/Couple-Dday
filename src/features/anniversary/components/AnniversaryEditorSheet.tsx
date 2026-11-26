"use client";

/**
 * 사용자 지정 기념일 추가·수정·삭제 Sheet (CUS-001~011, BTS-001~015, ARC-A01~A05, 2026-11-26 확정 세칙).
 * - 추가: 이름(30자), 날짜(연애 시작일 이상, 미래 허용), 반복(일회성/매년 반복)
 * - 수정: 일회성은 이름·날짜. 매년 반복은 "해당 연도만 / 매년 전체" 범위 선택
 *   (해당 연도: 같은 연도 안에서 이동, 전체: 월·일만 변경). 반복 유형 전환은 제공하지 않는다.
 * - 삭제: 연결된 사진·메모 수를 안내하고 확인 후 삭제(CUS-E05).
 * - 날짜 선택·삭제 확인은 같은 Sheet 의 단계로 표시하여 Sheet 를 중첩하지 않는다(BTS-010).
 * 상세 배치·문구는 명세에 없는 미확정 UI로 사용자 검수 대상이다.
 */
import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import type { CustomAnniversary, LocalDate, RepeatType } from "@/domain/entities";
import type { CustomOccurrence } from "@/domain/anniversary/types";
import { addYearsToLocalDate, formatDisplayDate, getLocalDateYear, maxLocalDate } from "@/domain/date/local-date";
import { yearBounds } from "@/domain/policies/anniversary-rules";
import { ANNIVERSARY_TITLE_MAX_LENGTH, validateRequiredText } from "@/domain/policies/text-rules";
import { customOccurrenceId } from "@/domain/anniversary/occurrence-id";
import {
  addCustomAnniversary,
  countLinkedRecords,
  deleteAnniversaryOccurrence,
  deleteAnniversarySeries,
  deleteOneTimeAnniversary,
  updateAnniversaryOccurrence,
  updateAnniversarySeries,
  updateOneTimeAnniversary,
  type LinkedRecordCount,
} from "@/application/services/anniversaries";
import { BottomSheet, errorMessage, SheetCancelButton } from "@/components/ui/BottomSheet";
import { DatePickerPanel } from "@/components/ui/DatePicker";
import { Button, SegmentedControl } from "@/components/ui/primitives";
import { TextField } from "@/components/ui/TextField";
import { useDatabase } from "@/hooks/useDatabase";

export type EditorTarget = { mode: "add" } | { mode: "edit"; occurrence: CustomOccurrence; series: CustomAnniversary };

type Scope = "occurrence" | "series";

const REPEAT_OPTIONS = [
  { value: "none" as RepeatType, label: "일회성" },
  { value: "yearly" as RepeatType, label: "매년 반복" },
] as const;

export function AnniversaryEditorSheet({
  target,
  onClose,
  startDate,
  today,
  revision,
}: {
  target: EditorTarget | null;
  onClose: () => void;
  startDate: LocalDate;
  today: LocalDate;
  revision: number;
}) {
  // Sheet 의 dirty/busy 가 본문 상태에 따라 달라지므로 본문이 BottomSheet 를 직접 렌더링한다.
  if (!target) return null;
  return <EditorBody key={target.mode === "add" ? "add" : target.occurrence.id} target={target} onClose={onClose} startDate={startDate} today={today} revision={revision} />;
}

function EditorBody({
  target,
  onClose,
  startDate,
  today,
  revision,
}: {
  target: EditorTarget;
  onClose: () => void;
  startDate: LocalDate;
  today: LocalDate;
  revision: number;
}) {
  const db = useDatabase();
  // 편집을 연 시점의 revision 으로 저장하여 다른 탭의 변경을 덮어쓰지 않는다(DB-015).
  const [openedRevision] = useState(revision);
  const isYearly = target.mode === "edit" && target.series.repeatType === "yearly";
  const [scope, setScope] = useState<Scope>("occurrence");

  const initial = useMemo(() => {
    if (target.mode === "add") return { title: "", date: null as LocalDate | null, repeatType: "none" as RepeatType };
    if (target.series.repeatType === "none" || scope === "series") return { title: target.series.title, date: target.series.date as LocalDate | null, repeatType: target.series.repeatType };
    return { title: target.occurrence.title, date: target.occurrence.date as LocalDate | null, repeatType: target.series.repeatType };
  }, [target, scope]);

  const [title, setTitle] = useState(initial.title);
  const [date, setDate] = useState<LocalDate | null>(initial.date);
  const [repeatType, setRepeatType] = useState<RepeatType>(initial.repeatType);
  const [view, setView] = useState<"form" | "date" | "delete">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<LinkedRecordCount | null>(null);

  const changeScope = (next: Scope) => {
    setScope(next);
    if (target.mode !== "edit") return;
    const source = next === "series" ? target.series : target.occurrence;
    setTitle(source.title);
    setDate(source.date);
    setError(null);
  };

  // 날짜 선택 범위
  const bounds = useMemo((): { min: LocalDate; max: LocalDate } => {
    if (target.mode === "edit" && isYearly) {
      const year = scope === "series" ? getLocalDateYear(target.series.date) : (target.occurrence.occurrenceYear ?? getLocalDateYear(target.occurrence.date));
      const { min, max } = yearBounds(year);
      return { min: maxLocalDate(min, startDate), max };
    }
    return { min: startDate, max: addYearsToLocalDate(today, 50) };
  }, [target, isYearly, scope, startDate, today]);
  const dateEditable = bounds.min <= bounds.max;

  const titleInvalid = validateRequiredText(title, ANNIVERSARY_TITLE_MAX_LENGTH) !== null;
  const dirty = title !== initial.title || date !== initial.date || repeatType !== initial.repeatType;
  const canSave = !busy && !titleInvalid && date !== null && (target.mode === "add" || dirty);

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
      onClose();
    } catch (e) {
      const issues = (e as { issues?: string[] }).issues ?? [];
      if (issues.some((i) => i.startsWith("date:before-start-date"))) setError("연애 시작일 이후 날짜를 선택해 주세요.");
      else if (issues.some((i) => i.startsWith("date:year-changed"))) setError("같은 연도 안의 날짜만 선택할 수 있어요.");
      else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!canSave || date === null) return;
    const context = { expectedRevision: openedRevision };
    if (target.mode === "add") return run(() => addCustomAnniversary(db, { title, date, repeatType }, context));
    if (target.series.repeatType === "none") return run(() => updateOneTimeAnniversary(db, target.series.id, { title, date }, context));
    if (scope === "series") return run(() => updateAnniversarySeries(db, target.series.id, { title, date }, context));
    return run(() => updateAnniversaryOccurrence(db, target.series.id, target.occurrence.occurrenceYear!, { title, date }, context));
  };

  const deleteTarget = useMemo(() => {
    if (target.mode !== "edit") return null;
    if (target.series.repeatType === "none") return { ids: [customOccurrenceId(target.series.id)] };
    if (scope === "series") return { prefix: `${customOccurrenceId(target.series.id)}:` };
    return { ids: [target.occurrence.id] };
  }, [target, scope]);

  useEffect(() => {
    if (view !== "delete" || !deleteTarget) return;
    let cancelled = false;
    countLinkedRecords(db, deleteTarget).then((count) => !cancelled && setLinked(count));
    return () => {
      cancelled = true;
    };
  }, [db, view, deleteTarget]);

  const confirmDelete = () => {
    if (target.mode !== "edit") return;
    const context = { expectedRevision: openedRevision };
    if (target.series.repeatType === "none") return run(() => deleteOneTimeAnniversary(db, target.series.id, context));
    if (scope === "series") return run(() => deleteAnniversarySeries(db, target.series.id, context));
    return run(() => deleteAnniversaryOccurrence(db, target.series.id, target.occurrence.occurrenceYear!, context));
  };

  const year = target.mode === "edit" ? target.occurrence.occurrenceYear : null;
  const sheetTitle =
    view === "delete" && target.mode === "edit"
      ? target.series.repeatType === "none"
        ? `‘${target.series.title}’을 삭제할까요?`
        : scope === "series"
          ? `매년 반복되는 ‘${target.series.title}’을 모두 삭제할까요?`
          : `${year}년 ‘${target.occurrence.title}’만 삭제할까요?`
      : view === "date"
        ? "날짜 선택"
        : target.mode === "add"
          ? "기념일 추가"
          : "기념일 수정";

  const linkedCount = linked ? linked.photos + linked.memos : 0;
  const deleteDescription =
    view !== "delete"
      ? undefined
      : linked === null
        ? "연결된 기록을 확인하고 있어요."
        : linkedCount > 0
          ? `연결된 사진 ${linked.photos}장과 메모 ${linked.memos}개도 함께 삭제돼요. 삭제한 기록은 되돌릴 수 없어요.`
          : "삭제한 기념일은 되돌릴 수 없어요.";

  return (
    <BottomSheet
      open
      onClose={onClose}
      dirty={view !== "delete" && dirty}
      busy={busy}
      title={sheetTitle}
      description={deleteDescription}
      footer={
        view === "date" ? null : view === "delete" ? (
          <div className="flex flex-col gap-2">
            {error && (
              <p role="alert" className="pb-2 text-center text-ui-caption text-danger">
                {error}
              </p>
            )}
            <Button onClick={confirmDelete} disabled={busy || linked === null} className="bg-danger">
              삭제하기
            </Button>
            <Button variant="text" onClick={() => setView("form")} disabled={busy}>
              취소
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {error && (
              <p role="alert" className="pb-2 text-center text-ui-caption text-danger">
                {error}
              </p>
            )}
            <Button onClick={save} disabled={!canSave}>
              {target.mode === "add" ? "추가하기" : "저장"}
            </Button>
            {target.mode === "edit" && (
              <Button variant="danger-text" onClick={() => setView("delete")} disabled={busy}>
                삭제
              </Button>
            )}
            <SheetCancelButton disabled={busy} />
          </div>
        )
      }
    >
      {view === "date" ? (
        <DatePickerPanel
          value={date}
          min={bounds.min}
          max={bounds.max}
          today={today}
          onCancel={() => setView("form")}
          onConfirm={(next) => {
            setDate(next);
            setView("form");
          }}
        />
      ) : view === "form" ? (
        <div className="flex flex-col gap-6">
          {isYearly && (
            <div className="flex flex-col gap-2">
              <span className="text-ui-caption font-medium text-text-body">수정 범위</span>
              <SegmentedControl
                label="수정 범위"
                options={[
                  { value: "occurrence" as Scope, label: `${year}년만` },
                  { value: "series" as Scope, label: "매년 전체" },
                ]}
                value={scope}
                onChange={changeScope}
              />
            </div>
          )}
          <TextField label="기념일 이름" value={title} onChange={setTitle} maxLength={ANNIVERSARY_TITLE_MAX_LENGTH} placeholder="예: 처음 여행 간 날" />
          <div className="flex flex-col gap-2">
            <span id="anniversary-date-label" className="text-ui-caption font-medium text-text-body">
              날짜
            </span>
            <button
              type="button"
              aria-labelledby="anniversary-date-label"
              disabled={!dateEditable}
              onClick={() => setView("date")}
              className="flex h-control items-center gap-2 rounded-control border border-accent-soft bg-surface px-4 text-left disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Calendar className="size-4.5 text-text-secondary" aria-hidden="true" />
              <span className={date ? "flex-1 text-ui-body font-medium text-text-primary" : "flex-1 text-ui-body text-text-inactive"}>
                {date ? formatDisplayDate(date) : "날짜 선택"}
              </span>
              <ChevronDown className="size-4.5 text-text-secondary" aria-hidden="true" />
            </button>
            {isYearly && scope === "series" && <p className="text-ui-caption-sm text-text-secondary">매년 반복되는 월·일을 바꿀 수 있어요.</p>}
            {isYearly && scope === "occurrence" && <p className="text-ui-caption-sm text-text-secondary">{year}년 안의 날짜로만 옮길 수 있어요.</p>}
            {!dateEditable && <p className="text-ui-caption-sm text-text-secondary">연애 시작일 이전 기념일은 이름만 바꿀 수 있어요.</p>}
          </div>
          {target.mode === "add" && (
            <div className="flex flex-col gap-2">
              <span className="text-ui-caption font-medium text-text-body">반복</span>
              <SegmentedControl label="반복" options={REPEAT_OPTIONS} value={repeatType} onChange={setRepeatType} />
            </div>
          )}
        </div>
      ) : null}
    </BottomSheet>
  );
}
