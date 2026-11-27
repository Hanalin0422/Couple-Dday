"use client";

/**
 * 설정 화면 (SKILL.md §8, REQUIREMENTS.md §10 SET-001~014).
 * 카드 순서: 프로필 및 정보 → 디데이 설정 → 화면 꾸미기 → 데이터 관리. 콘텐츠만 스크롤, 하단 메뉴 고정.
 * 항목별 저장, DB 커밋 성공 후 반영. 편집을 연 시점의 revision 으로 저장하여 다른 탭의 변경을 덮어쓰지 않는다.
 * 데이터 백업/복원/초기화(SET-008~010, SET-013)는 features/backup 의 Sheet 를 사용한다. 테마 행 조작 여부는 사용자 확인 후 연결한다.
 */
import { useRef, useState } from "react";
import { Download, Palette, Trash2, Upload } from "lucide-react";
import type { Couple, DayOffset, DraftImage, LocalDate, Photo, Settings } from "@/domain/entities";
import { formatDisplayDate } from "@/domain/date/local-date";
import { NAME_MAX_LENGTH, validateRequiredText } from "@/domain/policies/text-rules";
import {
  removeProfilePhoto,
  setProfilePhoto,
  updateDayOffset,
  updateName,
  updateStartDate,
  type ProfileRole,
} from "@/application/services/couple-settings";
import { BottomSheet, ConfirmSheet, errorMessage, SheetCancelButton } from "@/components/ui/BottomSheet";
import { DatePicker } from "@/components/ui/DatePicker";
import { HeartOutlineIcon } from "@/components/ui/icons";
import { ImageFileInput, type ImageFileInputHandle } from "@/components/ui/ImageFileInput";
import { Button, Card, MenuRow, PageHeader, SegmentedControl } from "@/components/ui/primitives";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { TextField } from "@/components/ui/TextField";
import { useDatabase, usePhoto } from "@/hooks/useDatabase";
import { useNavigationStore } from "@/stores/navigation-store";
import { useTimelineStore } from "@/stores/timeline-store";
import { BackupSheet, formatBackupTime, ResetSheet, RestoreSheet } from "../backup/DataSheets";
import { DAY_OFFSET_OPTIONS } from "../onboarding/OnboardingScreen";

type Editing =
  | { kind: "name"; role: ProfileRole; revision: number }
  | { kind: "photo"; role: ProfileRole; revision: number }
  | { kind: "start-date-pick"; revision: number }
  | { kind: "start-date-confirm"; date: LocalDate; revision: number }
  | { kind: "offset"; value: DayOffset; revision: number }
  | { kind: "backup" }
  | { kind: "restore"; revision: number }
  | { kind: "reset"; revision: number }
  | null;

export function SettingsScreen({ couple, settings, today }: { couple: Couple; settings: Settings; today: LocalDate }) {
  const db = useDatabase();
  const [editing, setEditing] = useState<Editing>(null);
  const close = () => setEditing(null);
  const resetNavigation = useNavigationStore((s) => s.reset);
  const resetTimeline = useTimelineStore((s) => s.reset);
  const myPhoto = usePhoto(couple.myPhotoId);
  const partnerPhoto = usePhoto(couple.partnerPhotoId);
  const roleName = (role: ProfileRole) => (role === "self" ? "내" : "상대방");

  const profile = (role: ProfileRole, name: string, image: Photo | null | undefined) => (
    <div className="flex w-30 flex-col items-center gap-2">
      <ProfileAvatar
        role={role}
        photo={image}
        size={72}
        badge="camera"
        label={`${roleName(role)} 프로필 사진 변경`}
        onClick={() => setEditing({ kind: "photo", role, revision: settings.revision })}
      />
      <span className="break-keep text-center text-ui-caption font-medium text-text-body">{name}</span>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="설정" />
      <div className="min-h-0 flex-1 overflow-y-auto px-gutter pb-6" data-testid="settings-scroll">
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-start justify-center pb-3">
              {profile("self", couple.myName, myPhoto)}
              <span className="flex h-18 items-center text-accent">
                <HeartOutlineIcon className="size-3.5" />
              </span>
              {profile("partner", couple.partnerName, partnerPhoto)}
            </div>
            <MenuRow label="내 이름" value={couple.myName} onClick={() => setEditing({ kind: "name", role: "self", revision: settings.revision })} />
            <MenuRow label="상대방 이름" value={couple.partnerName} onClick={() => setEditing({ kind: "name", role: "partner", revision: settings.revision })} />
            <MenuRow label="연애 시작일" value={formatDisplayDate(couple.startDate)} onClick={() => setEditing({ kind: "start-date-pick", revision: settings.revision })} />
          </Card>

          <Card>
            <h2 className="text-ui-section font-semibold text-text-primary">디데이 설정</h2>
            <p className="mb-3 mt-4 text-ui-caption text-text-body">시작일 계산 방식</p>
            <SegmentedControl
              label="시작일 계산 방식"
              options={DAY_OFFSET_OPTIONS}
              value={settings.dayOffset}
              onChange={(value) => setEditing({ kind: "offset", value, revision: settings.revision })}
            />
            <p className="mt-3 text-ui-caption-sm text-text-secondary">처음 사귄 날을 {settings.dayOffset}일로 계산해요.</p>
          </Card>

          <Card>
            <h2 className="mb-2 text-ui-section font-semibold text-text-primary">화면 꾸미기</h2>
            <MenuRow
              label="테마"
              value="Dusty Rose"
              icon={
                <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Palette className="size-4.25" aria-hidden="true" />
                </span>
              }
            />
          </Card>

          <Card>
            <h2 className="mb-2 text-ui-section font-semibold text-text-primary">데이터 관리</h2>
            <MenuRow
              label="데이터 백업"
              value={settings.lastBackupAt ? formatBackupTime(settings.lastBackupAt).slice(0, 10) : undefined}
              icon={<Download className="size-5 text-text-secondary" aria-hidden="true" />}
              onClick={() => setEditing({ kind: "backup" })}
            />
            <MenuRow label="데이터 복원" icon={<Upload className="size-5 text-text-secondary" aria-hidden="true" />} onClick={() => setEditing({ kind: "restore", revision: settings.revision })} />
            <MenuRow
              label="데이터 초기화"
              tone="danger"
              icon={<Trash2 className="size-5 text-danger" aria-hidden="true" />}
              onClick={() => setEditing({ kind: "reset", revision: settings.revision })}
            />
          </Card>
        </div>
      </div>

      <BackupSheet open={editing?.kind === "backup"} onClose={close} lastBackupAt={settings.lastBackupAt} />
      <RestoreSheet
        open={editing?.kind === "restore"}
        onClose={close}
        today={today}
        revision={editing?.kind === "restore" ? editing.revision : settings.revision}
        hasCurrentData
        onRestored={() => {
          // 복원 성공 후 메인으로 이동 (RES-008)
          resetNavigation();
          resetTimeline();
        }}
      />
      <ResetSheet
        open={editing?.kind === "reset"}
        onClose={close}
        revision={editing?.kind === "reset" ? editing.revision : settings.revision}
        onReset={() => {
          // 커플 데이터가 사라지면 앱이 시작 상태를 다시 판정해 온보딩으로 이동한다 (RST-008)
          resetNavigation();
          resetTimeline();
        }}
      />
      <NameSheet
        key={editing?.kind === "name" ? `name-${editing.role}` : "name"}
        open={editing?.kind === "name"}
        role={editing?.kind === "name" ? editing.role : "self"}
        initial={editing?.kind === "name" ? (editing.role === "self" ? couple.myName : couple.partnerName) : ""}
        onClose={close}
        onSave={async (role, value) => {
          if (editing?.kind !== "name") return;
          await updateName(db, role, value, { expectedRevision: editing.revision });
        }}
      />
      <ProfilePhotoSheet
        open={editing?.kind === "photo"}
        role={editing?.kind === "photo" ? editing.role : "self"}
        hasPhoto={editing?.kind === "photo" ? Boolean(editing.role === "self" ? couple.myPhotoId : couple.partnerPhotoId) : false}
        onClose={close}
        onPick={async (role, image) => {
          if (editing?.kind !== "photo") return;
          await setProfilePhoto(db, role, image, { expectedRevision: editing.revision });
        }}
        onRemove={async (role) => {
          if (editing?.kind !== "photo") return;
          await removeProfilePhoto(db, role, { expectedRevision: editing.revision });
        }}
      />
      <DatePicker
        open={editing?.kind === "start-date-pick"}
        onClose={close}
        value={couple.startDate}
        max={today}
        title="연애 시작일"
        confirmLabel="다음"
        onConfirm={(date) => {
          if (editing?.kind !== "start-date-pick") return;
          if (date === couple.startDate) close();
          else setEditing({ kind: "start-date-confirm", date, revision: editing.revision });
        }}
      />
      <ConfirmSheet
        open={editing?.kind === "start-date-confirm"}
        onClose={close}
        title={editing?.kind === "start-date-confirm" ? `연애 시작일을 ${formatDisplayDate(editing.date)}로 바꿀까요?` : ""}
        description="디데이와 자동 기념일 날짜가 새 시작일 기준으로 다시 계산돼요. 저장된 사진과 메모는 그대로 유지돼요."
        confirmLabel="변경하기"
        onConfirm={async () => {
          if (editing?.kind !== "start-date-confirm") return;
          await updateStartDate(db, editing.date, { expectedRevision: editing.revision, today });
        }}
      />
      <ConfirmSheet
        open={editing?.kind === "offset"}
        onClose={close}
        title={editing?.kind === "offset" ? `처음 사귄 날을 ${editing.value}일로 계산할까요?` : ""}
        description="디데이와 100일 같은 일수 기념일 날짜가 다시 계산돼요. 주년 날짜와 저장된 사진·메모는 그대로 유지돼요."
        confirmLabel="변경하기"
        onConfirm={async () => {
          if (editing?.kind !== "offset") return;
          await updateDayOffset(db, editing.value, { expectedRevision: editing.revision });
        }}
      />
    </div>
  );
}

function NameSheet({
  open,
  role,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  role: ProfileRole;
  initial: string;
  onClose: () => void;
  onSave: (role: ProfileRole, value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = validateRequiredText(value, NAME_MAX_LENGTH) !== null;
  const dirty = value !== initial;
  const label = role === "self" ? "내 이름" : "상대방 이름";
  const save = async () => {
    if (busy || invalid) return;
    if (!dirty) return onClose();
    setBusy(true);
    setError(null);
    try {
      await onSave(role, value);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      dirty={dirty}
      busy={busy}
      title={`${label} 변경`}
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="pb-2 text-center text-ui-caption text-danger">
              {error}
            </p>
          )}
          <Button onClick={save} disabled={busy || invalid}>
            저장
          </Button>
          <SheetCancelButton disabled={busy} />
        </div>
      }
    >
      <TextField label={label} hideLabel value={value} onChange={setValue} maxLength={NAME_MAX_LENGTH} placeholder="이름 또는 애칭" autoFocus />
    </BottomSheet>
  );
}

function ProfilePhotoSheet({
  open,
  role,
  hasPhoto,
  onClose,
  onPick,
  onRemove,
}: {
  open: boolean;
  role: ProfileRole;
  hasPhoto: boolean;
  onClose: () => void;
  onPick: (role: ProfileRole, image: DraftImage) => Promise<void>;
  onRemove: (role: ProfileRole) => Promise<void>;
}) {
  const fileInput = useRef<ImageFileInputHandle>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.name === "ImagePrepareError" ? "사진을 불러오지 못했어요. 다른 사진을 선택해 주세요." : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        busy={busy}
        title={role === "self" ? "내 프로필 사진" : "상대방 프로필 사진"}
        footer={
          <div className="flex flex-col gap-2">
            {error && (
              <p role="alert" className="pb-2 text-center text-ui-caption text-danger">
                {error}
              </p>
            )}
            <Button onClick={() => fileInput.current?.open()} disabled={busy}>
              사진 선택하기
            </Button>
            {hasPhoto && (
              <Button variant="text" onClick={() => run(() => onRemove(role))} disabled={busy}>
                기본 이미지로 변경
              </Button>
            )}
            <SheetCancelButton disabled={busy} />
          </div>
        }
      />
      <ImageFileInput
        ref={fileInput}
        onBusyChange={setBusy}
        onImage={(image) => run(() => onPick(role, image))}
        onError={(e) => setError(e instanceof Error && e.name === "ImagePrepareError" ? "사진을 불러오지 못했어요. 다른 사진을 선택해 주세요." : errorMessage(e))}
      />
    </>
  );
}
