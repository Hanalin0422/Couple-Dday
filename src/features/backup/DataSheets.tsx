"use client";

/**
 * 데이터 백업 / 복원 / 초기화 Sheet (REQUIREMENTS.md §11~13, SET-008~010, SET-013, ONB-010, RES-007).
 * 상세 문구·배치는 명세에 없는 미확정 UI(사용자 검수 대상). 확인·처리 단계는 같은 Sheet 안에서 진행한다(BTS-010).
 * 복원·초기화 처리 중에는 닫을 수 없다(RES-010, BTS-015).
 */
import { useRef, useState } from "react";
import type { Instant, LocalDate } from "@/domain/entities";
import { formatDisplayDate, toLocalDate } from "@/domain/date/local-date";
import { parseBackupFile, resetAllData, restoreFromBackup, type RestorePayload } from "@/application/services/backup";
import { BottomSheet, SheetCancelButton } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/primitives";
import { useDatabase } from "@/hooks/useDatabase";
import { clearCelebrationHistory } from "@/features/home/hooks/useCelebration";
import { deliveryMessage, useBackupAction } from "./useBackupAction";

/** UTC 일시를 기기 현지 "YYYY.MM.DD HH:mm" 으로 표시 (SET-013). */
export function formatBackupTime(instant: Instant): string {
  const date = new Date(instant);
  return `${formatDisplayDate(toLocalDate(date))} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function Notice({ tone, children }: { tone: "info" | "error"; children: React.ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-xl bg-input px-4 py-3 text-ui-caption ${tone === "error" ? "text-danger" : "text-text-body"}`}>
      {children}
    </p>
  );
}

/* ───────────── 백업 ───────────── */

export function BackupSheet({ open, onClose, lastBackupAt }: { open: boolean; onClose: () => void; lastBackupAt: Instant | null }) {
  const { run, running } = useBackupAction();
  const [result, setResult] = useState<{ tone: "info" | "error"; text: string; done: boolean } | null>(null);
  const close = () => {
    setResult(null);
    onClose();
  };
  const start = async () => {
    setResult(null);
    const outcome = await run();
    if (outcome.kind === "error") setResult({ tone: "error", text: outcome.message, done: false });
    else setResult({ tone: outcome.kind === "cancelled" ? "error" : "info", text: deliveryMessage(outcome.kind), done: outcome.kind !== "cancelled" });
  };
  return (
    <BottomSheet
      open={open}
      onClose={close}
      busy={running}
      title="데이터 백업"
      description={
        <>
          커플 정보, 기념일, 사진과 메모를 ZIP 파일 하나로 저장해요.
          <br />
          백업 파일은 <strong className="font-semibold text-text-body">암호화되지 않으며</strong> 이름·사진·메모 같은 개인정보가 포함돼요. 안전한 곳에 보관해 주세요.
          <br />
          iPhone에서는 Safari와 홈 화면 앱의 데이터가 따로 저장될 수 있고, 저장 공간 정리 등으로 앱 데이터가 지워질 수 있어요. 주기적으로 백업해 주세요.
        </>
      }
      footer={
        <div className="flex flex-col gap-2">
          {result?.done ? (
            <Button onClick={close}>확인</Button>
          ) : (
            <>
              <Button onClick={start} disabled={running}>
                {running ? "백업 파일을 만드는 중…" : "백업 파일 만들기"}
              </Button>
              <SheetCancelButton disabled={running} />
            </>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-ui-caption text-text-secondary" data-testid="last-backup">
          {lastBackupAt ? `마지막 백업: ${formatBackupTime(lastBackupAt)}` : "아직 백업한 적이 없어요."}
        </p>
        {result && <Notice tone={result.tone}>{result.text}</Notice>}
      </div>
    </BottomSheet>
  );
}

/* ───────────── 복원 ───────────── */

function restoreErrorText(error: unknown): string {
  const reason = (error as { reason?: string }).reason ?? "";
  const keep = " 지금 데이터는 그대로예요.";
  if (reason === "archive:too-large" || reason === "archive:uncompressed-limit" || reason === "archive:entry-limit" || reason === "archive:too-many-entries")
    return `백업 파일이 너무 커서 복원할 수 없어요.${keep}`;
  if (reason === "unsupported-version") return `이 앱에서 지원하지 않는 백업 버전이에요.${keep}`;
  if (reason === "future-start-date") return `백업의 연애 시작일이 오늘보다 미래예요. 기기 날짜를 확인해 주세요.${keep}`;
  if (reason.startsWith("archive:")) return `백업 파일을 읽을 수 없어요. 이 앱에서 만든 백업 ZIP 파일인지 확인해 주세요.${keep}`;
  if (reason) return `백업 파일이 손상되었거나 올바르지 않아요.${keep}`;
  const name = error instanceof Error ? error.name : "";
  if (name === "StorageError" && (error as { kind?: string }).kind === "quota") return `저장 공간이 부족해 복원하지 못했어요.${keep}`;
  if (name === "RevisionConflictError") return `다른 곳에서 데이터가 바뀌었어요. 다시 시도해 주세요.${keep}`;
  return `복원하지 못했어요. 다시 시도해 주세요.${keep}`;
}

export function RestoreSheet({
  open,
  onClose,
  today,
  revision,
  hasCurrentData,
  onRestored,
}: {
  open: boolean;
  onClose: () => void;
  today: LocalDate;
  revision: number;
  /** 교체될 기존 데이터가 있는지(설정에서 진입) */
  hasCurrentData: boolean;
  onRestored: () => Promise<void> | void;
}) {
  const db = useDatabase();
  const input = useRef<HTMLInputElement>(null);
  const backup = useBackupAction();
  const [step, setStep] = useState<"pick" | "checking" | "confirm" | "restoring">("pick");
  const [payload, setPayload] = useState<RestorePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = step === "checking" || step === "restoring" || backup.running;

  const close = () => {
    setStep("pick");
    setPayload(null);
    setError(null);
    setNotice(null);
    onClose();
  };

  const check = async (file: File | undefined) => {
    if (!file) return; // 파일 선택 취소: 변경 없음 (RES-E07)
    setStep("checking");
    setError(null);
    try {
      setPayload(await parseBackupFile(file, { today }));
      setStep("confirm");
    } catch (e) {
      setError(restoreErrorText(e));
      setStep("pick");
    }
  };

  const restore = async () => {
    if (!payload) return;
    setStep("restoring");
    setError(null);
    try {
      await restoreFromBackup(db, payload, { expectedRevision: revision, today });
      await onRestored();
      close();
    } catch (e) {
      setError(restoreErrorText(e));
      setStep("confirm");
    }
  };

  const summary = payload && (
    <ul className="flex flex-col gap-1 rounded-xl bg-input px-4 py-3 text-ui-caption text-text-body" data-testid="restore-summary">
      <li>백업 일시: {formatBackupTime(payload.manifest.createdAt)}</li>
      <li>
        {payload.couple.myName} · {payload.couple.partnerName} ({formatDisplayDate(payload.couple.startDate)}부터)
      </li>
      <li>
        기념일 {payload.anniversaries.length}개 · 추억 {payload.memories.length}개 · 사진 {payload.photos.length}장
      </li>
    </ul>
  );

  return (
    <BottomSheet
      open={open}
      onClose={close}
      busy={busy}
      title={step === "confirm" || step === "restoring" ? "이 백업으로 바꿀까요?" : "데이터 복원"}
      description={
        step === "confirm" || step === "restoring"
          ? hasCurrentData
            ? "지금 데이터는 모두 백업 데이터로 바뀌고 되돌릴 수 없어요. 필요하면 먼저 현재 데이터를 백업해 주세요."
            : "백업 데이터로 시작해요."
          : "이 앱에서 만든 백업 ZIP 파일을 선택해 주세요. 복원하면 지금 데이터가 백업 데이터로 모두 바뀌어요."
      }
      footer={
        <div className="flex flex-col gap-2">
          {step === "confirm" || step === "restoring" ? (
            <>
              <Button variant="danger" onClick={restore} disabled={busy}>
                {step === "restoring" ? "복원하는 중…" : "복원하기"}
              </Button>
              {hasCurrentData && (
                <Button
                  variant="accent-text"
                  disabled={busy}
                  onClick={async () => {
                    const outcome = await backup.run();
                    setNotice(outcome.kind === "error" ? outcome.message : deliveryMessage(outcome.kind));
                  }}
                >
                  {backup.running ? "백업 파일을 만드는 중…" : "현재 데이터 먼저 백업하기"}
                </Button>
              )}
              <SheetCancelButton disabled={busy} />
            </>
          ) : (
            <>
              <Button onClick={() => input.current?.click()} disabled={busy}>
                {step === "checking" ? "백업 파일을 확인하는 중…" : "파일 선택하기"}
              </Button>
              <SheetCancelButton disabled={busy} />
            </>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {summary}
        {notice && <Notice tone="info">{notice}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <input
          ref={input}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="hidden"
          data-testid="restore-file-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void check(file);
          }}
        />
      </div>
    </BottomSheet>
  );
}

/* ───────────── 초기화 ───────────── */

export function ResetSheet({ open, onClose, revision, onReset }: { open: boolean; onClose: () => void; revision: number; onReset: () => Promise<void> | void }) {
  const db = useDatabase();
  const backup = useBackupAction();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = running || backup.running;
  const close = () => {
    setError(null);
    setNotice(null);
    onClose();
  };
  const reset = async () => {
    setRunning(true);
    setError(null);
    try {
      await resetAllData(db, { expectedRevision: revision });
      clearCelebrationHistory();
      close();
      await onReset();
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      setError(name === "RevisionConflictError" ? "다른 곳에서 데이터가 바뀌었어요. 다시 시도해 주세요." : "초기화하지 못했어요. 데이터는 그대로예요.");
    } finally {
      setRunning(false);
    }
  };
  return (
    <BottomSheet
      open={open}
      onClose={close}
      busy={busy}
      title="모든 데이터를 삭제할까요?"
      description="커플 정보, 프로필·추억 사진, 기념일, 메모가 모두 삭제되고 되돌릴 수 없어요. 이미 저장한 백업 파일과 사진 앱의 원본은 삭제되지 않아요."
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="danger" onClick={reset} disabled={busy}>
            {running ? "초기화하는 중…" : "초기화하기"}
          </Button>
          <Button
            variant="accent-text"
            disabled={busy}
            onClick={async () => {
              const outcome = await backup.run();
              setNotice(outcome.kind === "error" ? outcome.message : deliveryMessage(outcome.kind));
            }}
          >
            {backup.running ? "백업 파일을 만드는 중…" : "먼저 백업하기"}
          </Button>
          <SheetCancelButton disabled={busy} />
        </div>
      }
    >
      {(notice || error) && (
        <div className="flex flex-col gap-3">
          {notice && <Notice tone="info">{notice}</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      )}
    </BottomSheet>
  );
}
