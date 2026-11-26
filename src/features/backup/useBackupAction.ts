"use client";

/**
 * 백업 파일 만들기 → 전달(공유/다운로드) → 성공 시 마지막 백업 일시 기록 (BAK-001~012, ARC-D04).
 * 설정의 데이터 백업, 복원·초기화 전 "먼저 백업하기"에서 함께 사용한다.
 */
import { useCallback, useState } from "react";
import { createBackupFile, recordBackupDelivered } from "@/application/services/backup";
import { deliverFile, type DeliveryResult } from "@/infrastructure/browser/file-delivery";
import { useDatabase } from "@/hooks/useDatabase";

export type BackupOutcome = { kind: DeliveryResult } | { kind: "error"; message: string };

export function backupErrorText(error: unknown): string {
  const reason = (error as { reason?: string }).reason;
  if (reason === "too-large-backup") return "데이터가 너무 커서 백업 파일을 만들 수 없어요. 사진을 일부 정리한 뒤 다시 시도해 주세요.";
  if (error instanceof Error && error.name === "StorageError" && (error as { kind?: string }).kind === "quota") return "저장 공간이 부족해 백업 파일을 만들 수 없어요.";
  return "백업 파일을 만들지 못했어요. 다시 시도해 주세요.";
}

export function deliveryMessage(kind: DeliveryResult): string {
  if (kind === "shared") return "백업 파일을 저장했어요.";
  if (kind === "downloaded") return "백업 파일 다운로드를 시작했어요. 파일이 저장되었는지 확인해 주세요.";
  return "백업을 취소했어요.";
}

export function useBackupAction() {
  const db = useDatabase();
  const [running, setRunning] = useState(false);
  const run = useCallback(async (): Promise<BackupOutcome> => {
    setRunning(true);
    try {
      const file = await createBackupFile(db);
      const kind = await deliverFile(file.bytes, file.fileName);
      if (kind !== "cancelled") await recordBackupDelivered(db, file);
      return { kind };
    } catch (error) {
      return { kind: "error", message: backupErrorText(error) };
    } finally {
      setRunning(false);
    }
  }, [db]);
  return { run, running };
}
