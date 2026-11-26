"use client";

/**
 * DB 연결 및 시작 상태 판정 (REQUIREMENTS.md §15 실행 흐름, PWA-007, PWA-008).
 * 조회 완료 전에는 온보딩을 표시하지 않도록 'loading' 상태를 유지한다.
 * 오류 시 자동 초기화하지 않고 재시도만 제공한다(PWA-E03).
 */
import { useCallback, useEffect, useState } from "react";
import { loadAppState, type AppState } from "@/application/services/app-bootstrap";
import { openDatabase, toStorageError, type CoupleDatabase } from "@/infrastructure/db/database";

export type BootstrapState = { status: "loading" } | AppState;

export function useAppBootstrap() {
  const [db, setDb] = useState<CoupleDatabase | null>(null);
  const [state, setState] = useState<BootstrapState>({ status: "loading" });
  const [versionChanged, setVersionChanged] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let opened: CoupleDatabase | null = null;
    openDatabase({ onVersionChange: () => setVersionChanged(true) })
      .then(async (database) => {
        if (cancelled) {
          database.close();
          return;
        }
        opened = database;
        const next = await loadAppState(database);
        if (cancelled) return;
        setDb(database);
        setState(next);
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: "error", error: toStorageError(error) });
      });
    return () => {
      cancelled = true;
      opened?.close();
    };
  }, [attempt]);

  /** DB 오류 후 재시도 (연결부터 다시) */
  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  /** 온보딩 완료·복원·초기화 후 상태 재판정 (연결 유지) */
  const refresh = useCallback(async () => {
    if (!db) return;
    setState(await loadAppState(db));
  }, [db]);

  return { db, state, versionChanged, retry, refresh };
}
