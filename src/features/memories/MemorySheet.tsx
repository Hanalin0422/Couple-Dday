"use client";

/**
 * 추억 사진·메모 Sheet (MEM-001~016, SKILL.md §9, BTS-001~015). 2026-11-26 사용자 피드백 반영.
 *
 * - 등록(기록 없음) — 시안 확정 순서: 손잡이 → 기념일명 → "소중한 순간을 남겨보세요" → 사진 추가 안내 → "사진 선택하기" → "다음에".
 *   "메모만 남기기"(ARC-B05 진입, 초안)는 맨 아래에 둔다.
 * - 메모만 남기기 — 메모 입력과 "메모 저장" 버튼만 표시(사진 영역 없음).
 * - 편집 — 사진(대표·순서·빼기·추가)과 메모를 모아 두었다가 "저장" 한 번으로 반영하고 Sheet 를 닫는다.
 * - 보기(저장된 기록) — 사진·메모를 보여 주고 "삭제"·"닫기". 확정 기능(대표·순서 변경, 메모 수정)을 유지하기 위해 "수정" 진입을 둔다.
 * 단계 전환은 같은 Sheet 안에서 처리하여 Sheet 를 중첩하지 않는다(BTS-010). 상세 배치는 사용자 검수 대상.
 */
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Maximize2, Plus, Star, X } from "lucide-react";
import type { DraftImage, LocalDate, Memory, Photo } from "@/domain/entities";
import { formatDisplayDate } from "@/domain/date/local-date";
import { canAddNewMemoryPhoto } from "@/domain/policies/date-rules";
import { countCharacters, MEMO_MAX_LENGTH, truncateToMaxCharacters } from "@/domain/policies/text-rules";
import { deleteMemory, saveMemory } from "@/application/services/memories";
import { IMAGE_ACCEPT_ATTRIBUTE } from "@/application/services/image-preparation";
import { MAX_MEMORY_PHOTOS } from "@/application/validation/integrity";
import { BottomSheet, SheetCancelButton } from "@/components/ui/BottomSheet";
import { Button, cx } from "@/components/ui/primitives";
import { useDatabase, useMemories, useOccurrencePhotos, useSettings } from "@/hooks/useDatabase";
import type { StoredImage } from "@/hooks/useObjectUrl";
import { PhotoThumb, PhotoViewer } from "./PhotoViewer";
import { memoryErrorText, usePhotoPreparation, type PrepareFailure } from "./usePhotoPreparation";

export interface MemoryTarget {
  occurrenceId: string;
  title: string;
  date: LocalDate;
}

export function MemorySheet({ target, today, onClose }: { target: MemoryTarget | null; today: LocalDate; onClose: () => void }) {
  if (!target) return null;
  return <MemorySheetBody key={target.occurrenceId} target={target} today={today} onClose={onClose} />;
}

interface EditItem {
  key: string;
  existing?: Photo;
  image?: DraftImage;
}

interface EditState {
  items: EditItem[];
  cover: string | null;
  memo: string;
  /** 편집을 시작한 시점의 revision (다른 탭의 변경을 덮어쓰지 않음, DB-015) */
  revision: number;
  /** 시작 시점 내용(변경 여부 판단). 새 사진을 담은 채 시작하면 빈 값으로 두어 바로 저장 가능 */
  initial: string;
}

type Mode = "register" | "memo" | "edit" | "view" | "delete";

const signature = (items: EditItem[], cover: string | null, memo: string) => JSON.stringify([items.map((i) => i.key), cover, memo]);
const imageOf = (item: EditItem): StoredImage & { sourceHash: string } => (item.existing ?? item.image)!;

function MemoInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const composing = useRef(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="memory-memo" className="text-ui-caption font-medium text-text-body">
        메모
      </label>
      <textarea
        id="memory-memo"
        value={value}
        rows={5}
        placeholder="그날의 이야기를 남겨보세요"
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          onChange(truncateToMaxCharacters(event.currentTarget.value, MEMO_MAX_LENGTH));
        }}
        onChange={(event) => onChange(composing.current ? event.target.value : truncateToMaxCharacters(event.target.value, MEMO_MAX_LENGTH))}
        className="w-full resize-none rounded-control bg-input px-4 py-3 text-[length:max(16px,var(--fs-body))] text-text-primary outline-none placeholder:text-text-inactive focus-visible:outline-2 focus-visible:outline-accent"
      />
      <span className="self-end text-ui-caption-sm text-text-secondary tabular-nums">
        {countCharacters(value)}/{MEMO_MAX_LENGTH}
      </span>
    </div>
  );
}

function FailureList({ failures }: { failures: PrepareFailure[] }) {
  if (!failures.length) return null;
  return (
    <div role="alert" className="rounded-xl bg-input px-4 py-3 text-ui-caption text-danger">
      <p>사진 {failures.length}장은 추가하지 못했어요.</p>
      <ul className="mt-1 list-disc pl-4 text-ui-caption-sm text-text-secondary">
        {failures.map((f, i) => (
          <li key={`${f.name}-${i}`}>
            {f.name}: {f.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CoverBadge() {
  return <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-2 py-0.5 text-ui-nav font-semibold text-surface">대표</span>;
}

function MemorySheetBody({ target, today, onClose }: { target: MemoryTarget; today: LocalDate; onClose: () => void }) {
  const db = useDatabase();
  const memories = useMemories();
  const photos = useOccurrencePhotos(target.occurrenceId);
  const settings = useSettings();
  const memory: Memory | null = memories?.get(target.occurrenceId) ?? null;
  const loaded = memories !== undefined && photos !== undefined && settings !== undefined;
  const canAdd = canAddNewMemoryPhoto(target.date, today);
  const fileInput = useRef<HTMLInputElement>(null);
  const { prepare, progress } = usePhotoPreparation();

  const [mode, setMode] = useState<Mode | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [failures, setFailures] = useState<PrepareFailure[]>([]);
  const [viewer, setViewer] = useState<{ list: StoredImage[]; index: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasRecord = memory !== null || (photos?.length ?? 0) > 0;
  const currentMode: Mode = mode ?? (hasRecord ? "view" : "register");
  const revisionNow = settings?.revision ?? 0;
  const recordItems = (): EditItem[] => (photos ?? []).map((p) => ({ key: p.id, existing: p }));

  const startEdit = (next: "edit" | "memo", items: EditItem[], withNewPhotos = false) => {
    const cover = memory?.coverPhotoId ?? null;
    const memo = memory?.memo ?? "";
    setEdit({ items, cover, memo, revision: revisionNow, initial: withNewPhotos ? "" : signature(items, cover, memo) });
    setSelected(null);
    setError(null);
    setMode(next);
  };

  const pickPhotos = async (files: File[]) => {
    if (!files.length) return; // 선택 취소: 변경 없음 (MEM-E01)
    setBusy(true);
    const base = edit?.items ?? recordItems();
    try {
      const result = await prepare(files, base.map((i) => imageOf(i).sourceHash));
      setFailures(result.failures);
      if (result.prepared.length === 0 && !edit) return;
      const items = [...base, ...result.prepared.map((p) => ({ key: p.key, image: p.image }))];
      if (edit) setEdit({ ...edit, items });
      else startEdit("edit", items, true);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    setError(null);
    try {
      await saveMemory(
        db,
        target.occurrenceId,
        {
          order: edit.items.map((i) => i.key),
          newPhotos: edit.items.filter((i) => i.image).map((i) => ({ key: i.key, image: i.image! })),
          cover: edit.cover,
          memo: edit.memo,
        },
        { expectedRevision: edit.revision, today },
      );
      onClose();
    } catch (e) {
      setError(memoryErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const removeAll = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteMemory(db, target.occurrenceId, { expectedRevision: revisionNow });
      onClose();
    } catch (e) {
      setError(memoryErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const dirty = (currentMode === "edit" || currentMode === "memo") && edit !== null && signature(edit.items, edit.cover, edit.memo) !== edit.initial;
  const errorView = error && (
    <p role="alert" className="pb-2 text-center text-ui-caption text-danger">
      {error}
    </p>
  );
  const progressView = progress && (
    <p className="text-ui-caption text-text-secondary" role="status">
      사진 준비 중 ({progress.done}/{progress.total})
    </p>
  );

  let title = target.title;
  let description: React.ReactNode = formatDisplayDate(target.date);
  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;

  if (!loaded) {
    footer = null;
  } else if (currentMode === "register") {
    // 시안 확정: 사진 등록 Bottom Sheet
    description = "소중한 순간을 남겨보세요";
    body = (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-card bg-input p-(--card-padding)">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ImagePlus className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-ui-body font-semibold text-text-primary">사진 추가</p>
            <p className="mt-0.5 text-ui-caption-sm text-text-secondary">함께한 날의 사진을 최대 {MAX_MEMORY_PHOTOS}장까지 남길 수 있어요.</p>
          </div>
        </div>
        {progressView}
        <FailureList failures={failures} />
      </div>
    );
    footer = (
      <div className="flex flex-col gap-2">
        <Button onClick={() => fileInput.current?.click()} disabled={busy || !canAdd}>
          사진 선택하기
        </Button>
        <SheetCancelButton label="다음에" disabled={busy} />
        {canAdd && (
          <Button variant="text" onClick={() => startEdit("memo", [])} disabled={busy}>
            메모만 남기기
          </Button>
        )}
      </div>
    );
  } else if (currentMode === "memo" && edit) {
    body = <MemoInput value={edit.memo} onChange={(memo) => setEdit({ ...edit, memo })} />;
    footer = (
      <div className="flex flex-col gap-2">
        {errorView}
        <Button onClick={save} disabled={busy || edit.memo.trim().length === 0}>
          메모 저장
        </Button>
        <SheetCancelButton disabled={busy} />
      </div>
    );
  } else if (currentMode === "edit" && edit) {
    const index = edit.items.findIndex((i) => i.key === selected);
    const coverKey = edit.cover && edit.items.some((i) => i.key === edit.cover) ? edit.cover : (edit.items[0]?.key ?? null);
    const move = (delta: -1 | 1) => {
      const items = [...edit.items];
      const [item] = items.splice(index, 1);
      items.splice(index + delta, 0, item);
      setEdit({ ...edit, items });
    };
    const tools = index < 0 ? [] : [
      { label: "대표로", icon: Star, onClick: () => setEdit({ ...edit, cover: edit.items[index].key }), disabled: coverKey === edit.items[index].key, danger: false },
      { label: "앞으로", icon: ArrowLeft, onClick: () => move(-1), disabled: index <= 0, danger: false },
      { label: "뒤로", icon: ArrowRight, onClick: () => move(1), disabled: index >= edit.items.length - 1, danger: false },
      { label: "크게 보기", icon: Maximize2, onClick: () => setViewer({ list: edit.items.map(imageOf), index }), disabled: false, danger: false },
      {
        label: "빼기",
        icon: X,
        onClick: () => {
          setEdit({ ...edit, items: edit.items.filter((_, i) => i !== index) });
          setSelected(null);
        },
        disabled: false,
        danger: true,
      },
    ];
    body = (
      <div className="flex flex-col gap-5">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-ui-caption font-medium text-text-body">사진</span>
            <span className="text-ui-caption-sm text-text-secondary tabular-nums">
              {edit.items.length}/{MAX_MEMORY_PHOTOS}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="추억 사진">
            {edit.items.map((item, i) => {
              const isCover = coverKey === item.key;
              const isSelected = selected === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`사진 ${i + 1}${isCover ? ", 대표 사진" : ""}`}
                  onClick={() => setSelected(isSelected ? null : item.key)}
                  className={cx("relative aspect-square overflow-hidden rounded-xl", isSelected && "outline-2 outline-offset-2 outline-accent")}
                >
                  <PhotoThumb photo={imageOf(item)} label="" />
                  {isCover && <CoverBadge />}
                </button>
              );
            })}
            {canAdd && edit.items.length < MAX_MEMORY_PHOTOS && (
              <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} aria-label="사진 추가" className="flex aspect-square items-center justify-center rounded-xl bg-input text-text-secondary">
                <Plus className="size-6" aria-hidden="true" />
              </button>
            )}
          </div>
          {tools.length > 0 && (
            <div className="mt-3 grid grid-cols-5 gap-1" role="toolbar" aria-label="선택한 사진">
              {tools.map(({ label, icon: Icon, onClick, disabled, danger }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  disabled={busy || disabled}
                  className={cx("flex min-h-touch flex-col items-center justify-center gap-1 rounded-xl text-ui-nav disabled:text-text-inactive", danger ? "text-danger" : "text-text-body")}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          )}
          {!canAdd && <p className="mt-2 text-ui-caption-sm text-text-secondary">아직 오지 않은 기념일에는 사진을 추가할 수 없어요.</p>}
          <div className="mt-2 flex flex-col gap-2">
            {progressView}
            <FailureList failures={failures} />
          </div>
        </div>
        <MemoInput value={edit.memo} onChange={(memo) => setEdit({ ...edit, memo })} />
      </div>
    );
    footer = (
      <div className="flex flex-col gap-2">
        {errorView}
        <Button onClick={save} disabled={busy || !dirty}>
          저장
        </Button>
        <SheetCancelButton disabled={busy} />
      </div>
    );
  } else if (currentMode === "view") {
    const list = photos ?? [];
    body = (
      <div className="flex flex-col gap-4" data-testid="memory-view">
        <div className="flex items-center justify-between">
          <span className="text-ui-caption text-text-secondary">{list.length > 0 ? `사진 ${list.length}장` : "사진 없음"}</span>
          <Button variant="accent-text" onClick={() => startEdit("edit", recordItems())} disabled={busy}>
            수정
          </Button>
        </div>
        {list.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {list.map((photo, i) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setViewer({ list, index: i })}
                aria-label={`사진 ${i + 1}${memory?.coverPhotoId === photo.id ? ", 대표 사진" : ""} 크게 보기`}
                className="relative aspect-square overflow-hidden rounded-xl"
              >
                <PhotoThumb photo={photo} label="" />
                {memory?.coverPhotoId === photo.id && <CoverBadge />}
              </button>
            ))}
          </div>
        )}
        {memory && memory.memo.trim().length > 0 && <p className="whitespace-pre-line break-keep rounded-xl bg-input px-4 py-3 text-ui-body text-text-body">{memory.memo}</p>}
      </div>
    );
    footer = (
      <div className="flex flex-col gap-2">
        {errorView}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="danger-soft" onClick={() => setMode("delete")} disabled={busy}>
            삭제
          </Button>
          <SheetCancelButton label="닫기" disabled={busy} variant="primary" />
        </div>
      </div>
    );
  } else if (currentMode === "delete") {
    const photoCount = photos?.length ?? 0;
    const hasMemo = Boolean(memory?.memo.trim());
    title = "추억을 삭제할까요?";
    description = `${photoCount > 0 ? `사진 ${photoCount}장${hasMemo ? "과 메모가" : "이"}` : "메모가"} 함께 삭제돼요. 삭제한 기록은 되돌릴 수 없어요.`;
    footer = (
      <div className="flex flex-col gap-2">
        {errorView}
        <Button variant="danger" onClick={removeAll} disabled={busy}>
          삭제하기
        </Button>
        <Button variant="text" onClick={() => setMode("view")} disabled={busy}>
          취소
        </Button>
      </div>
    );
  }

  return (
    <>
      <BottomSheet open onClose={onClose} title={title} description={description} dirty={dirty} busy={busy} footer={footer}>
        {body}
        <input
          ref={fileInput}
          type="file"
          accept={IMAGE_ACCEPT_ATTRIBUTE}
          multiple
          className="hidden"
          data-testid="memory-file-input"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void pickPhotos(files);
          }}
        />
      </BottomSheet>
      {viewer && viewer.list.length > 0 && <PhotoViewer photos={viewer.list} startIndex={viewer.index} title={target.title} onClose={() => setViewer(null)} />}
    </>
  );
}
