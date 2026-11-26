"use client";

/**
 * 앱 루트 (클라이언트 경계). SSR 중에는 IndexedDB·localStorage·Canvas 에 접근하지 않는다.
 * 실행 흐름: DB 조회 → 오류/손상/온보딩/메인 (REQUIREMENTS.md §15).
 */
import { useEffect } from "react";
import { MotionConfig } from "motion/react";
import { AnniversaryScreen } from "@/features/anniversary/AnniversaryScreen";
import { HomeScreen } from "@/features/home/HomeScreen";
import { OnboardingScreen } from "@/features/onboarding/OnboardingScreen";
import { SettingsScreen } from "@/features/settings/SettingsScreen";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { DatabaseProvider, useCouple, useSettings } from "@/hooks/useDatabase";
import { useLocalDateWatcher } from "@/hooks/useLocalDateWatcher";
import { useDateStore } from "@/stores/date-store";
import { useNavigationStore } from "@/stores/navigation-store";
import { AppShell } from "./AppShell";
import { CorruptDataScreen, LoadingScreen, StorageErrorScreen, VersionChangedScreen } from "./StatusScreens";

export function App() {
  useLocalDateWatcher();
  const today = useDateStore((s) => s.today);
  const { db, state, versionChanged, retry, refresh } = useAppBootstrap();

  let content: React.ReactNode;
  if (versionChanged) content = <VersionChangedScreen />;
  else if (state.status === "loading" || !today) content = <LoadingScreen />;
  else if (state.status === "error") content = <StorageErrorScreen onRetry={retry} newerVersion={state.error.kind === "version"} />;
  else if (state.status === "corrupt") content = <CorruptDataScreen onRetry={retry} />;
  else if (!db) content = <LoadingScreen />;
  else if (state.status === "onboarding")
    content = (
      <DatabaseProvider db={db}>
        <OnboardingScreen settings={state.settings} draft={state.draft} today={today} onCompleted={refresh} />
      </DatabaseProvider>
    );
  else
    content = (
      <DatabaseProvider db={db}>
        <ReadyApp onDataMissing={refresh} />
      </DatabaseProvider>
    );

  return <MotionConfig reducedMotion="user">{content}</MotionConfig>;
}

function ReadyApp({ onDataMissing }: { onDataMissing: () => Promise<void> }) {
  const couple = useCouple();
  const settings = useSettings();
  const today = useDateStore((s) => s.today);
  const resetNavigation = useNavigationStore((s) => s.reset);

  useEffect(() => resetNavigation(), [resetNavigation]);

  // 다른 탭의 초기화 등으로 완료 데이터가 사라지면 시작 상태를 다시 판정한다.
  const missing = couple === null || settings === null || settings?.onboardingCompleted === false;
  useEffect(() => {
    if (missing) void onDataMissing();
  }, [missing, onDataMissing]);

  if (!couple || !settings || !today) return <LoadingScreen />;
  return (
    <AppShell
      screens={{
        settings: <SettingsScreen couple={couple} settings={settings} today={today} />,
        home: <HomeScreen couple={couple} settings={settings} today={today} />,
        anniversary: <AnniversaryScreen />,
      }}
    />
  );
}
