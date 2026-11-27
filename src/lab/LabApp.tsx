"use client";
/**
 * [LAB] 실기기 렌더링 비교 환경 (/lab). 화면 전환 구현은 운영과 같은 AppShell 을 그대로 사용하고 화면 내용만 바꾼다.
 * - A: 실제 화면 + 실제 데이터 처리(IndexedDB, 테스트 전용 DB couple-dday-lab)
 * - B: 실제 화면 + 정적 데이터(테스트 DB 내용을 시작 시 한 번만 읽어 고정, 전환 중 DB 조회 없음)
 * - C: 최소 정적 UI
 * 모드 전환·앱 복귀는 전체 새로고침으로 한다(모듈 상태·계측을 매번 초기화하고 일반 앱과 섞이지 않게 함).
 */
import { useEffect, useState, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { APP_VERSION } from "@/constants/app";
import { AnniversaryScreen } from "@/features/anniversary/AnniversaryScreen";
import { HomeScreen } from "@/features/home/HomeScreen";
import { SettingsScreen } from "@/features/settings/SettingsScreen";
import { AppFrame } from "@/components/layout/AppFrame";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingScreen } from "@/components/layout/StatusScreens";
import { DatabaseProvider, useCouple, useSettings } from "@/hooks/useDatabase";
import { useLocalDateWatcher } from "@/hooks/useLocalDateWatcher";
import type { CoupleDatabase } from "@/infrastructure/db/database";
import { useDateStore } from "@/stores/date-store";
import { useNavigationStore } from "@/stores/navigation-store";
import { useTimelineStore } from "@/stores/timeline-store";
import { useUIStore } from "@/stores/ui-store";
import { BUILD_SHA, LAB_HUD_KEY, LAB_MODES, LAB_PATH, type LabMode } from "./config";
import { Hud } from "./Hud";
import { installProbe, MountProbe, probe, watchStore } from "./probe";
import { deleteLabDatabase, openLabDatabase, readStaticData } from "./seed";
import { StaticDataProvider, type StaticData } from "./static-data";

const readMode = (): LabMode => {
  const m = new URLSearchParams(location.search).get("mode");
  return m === "b" || m === "c" ? m : "a";
};
const readHud = () => {
  try {
    return localStorage.getItem(LAB_HUD_KEY) !== "0";
  } catch {
    return true;
  }
};

/** 화면마다 Mount/Unmount 계측을 붙인다(AppShell 은 수정하지 않음) */
const probed = (id: string, node: ReactNode) => (
  <>
    <MountProbe id={id} />
    {node}
  </>
);

function Minimal({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col gap-4 px-gutter pt-6">
      <h1 className="text-ui-title font-semibold text-text-primary">{title}</h1>
      <p className="text-ui-body text-text-body">정적 텍스트만 있는 최소 화면입니다.</p>
    </div>
  );
}

/** A: App.tsx 의 ReadyApp 과 같은 구성(테스트 DB) */
function RealDataShell() {
  const couple = useCouple();
  const settings = useSettings();
  const today = useDateStore((s) => s.today);
  if (!couple || !settings || !today) return <LoadingScreen />;
  return (
    <AppShell
      screens={{
        settings: probed("settings", <SettingsScreen couple={couple} settings={settings} today={today} />),
        home: probed("home", <HomeScreen couple={couple} settings={settings} today={today} />),
        anniversary: probed("anniversary", <AnniversaryScreen couple={couple} settings={settings} today={today} />),
      }}
    />
  );
}

function LabPanel({ mode, hud, onHud, db }: { mode: LabMode; hud: boolean; onHud: (on: boolean) => void; db: CoupleDatabase | null }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = (url: string) => location.assign(url);
  const button = "rounded-md px-2 py-1.5 text-[12px] font-semibold";
  return (
    <div data-testid="lab-panel" style={{ position: "absolute", right: 4, top: "calc(env(safe-area-inset-top) + 4px)", zIndex: 61, font: "12px/1.3 system-ui, sans-serif" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-full bg-black/75 px-3 py-1.5 text-[12px] font-semibold text-white" aria-expanded={open}>
        LAB {mode.toUpperCase()} {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="mt-1 flex w-56 flex-col gap-2 rounded-lg bg-black/85 p-2 text-white">
          <div>
            현재: <b>{mode.toUpperCase()}</b> — {LAB_MODES.find((m) => m.mode === mode)!.description}
          </div>
          <div className="flex gap-1">
            {LAB_MODES.map((m) => (
              <button key={m.mode} type="button" className={`${button} flex-1 ${m.mode === mode ? "bg-white text-black" : "bg-white/20"}`} onClick={() => go(`${LAB_PATH}?mode=${m.mode}`)}>
                {m.label}
              </button>
            ))}
          </div>
          <button type="button" className={`${button} bg-white/20`} onClick={() => onHud(!hud)}>
            HUD {hud ? "끄기" : "켜기"}
          </button>
          <button
            type="button"
            className={`${button} bg-white/20`}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await deleteLabDatabase(db ?? undefined);
              go(`${LAB_PATH}?mode=${mode}`);
            }}
          >
            {busy ? "삭제 중…" : "테스트 데이터 다시 만들기"}
          </button>
          <button type="button" className={`${button} bg-[#B87A8A]`} onClick={() => go("/")}>
            앱으로 돌아가기
          </button>
          <button
            type="button"
            className={`${button} bg-white/10 text-white/80`}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await deleteLabDatabase(db ?? undefined);
              go("/");
            }}
          >
            테스트 데이터 삭제하고 앱으로
          </button>
          <div className="text-[11px] text-white/70">
            v{APP_VERSION} · {BUILD_SHA}
            <br />
            commit 계측 {probe.commitHookActive() ? "활성" : "비활성"} · 테스트 DB 사용(사용자 데이터와 분리)
          </div>
        </div>
      )}
    </div>
  );
}

export function LabApp() {
  useLocalDateWatcher();
  const today = useDateStore((s) => s.today);
  const [mode, setMode] = useState<LabMode | null>(null);
  const [hud, setHud] = useState(true);
  const [db, setDb] = useState<CoupleDatabase | null>(null);
  const [data, setData] = useState<StaticData | null>(null);
  const [status, setStatus] = useState("준비 중…");

  useEffect(() => {
    installProbe();
    const stops = [watchStore("navigation", useNavigationStore), watchStore("ui", useUIStore), watchStore("timeline", useTimelineStore), watchStore("date", useDateStore)];
    const frame = requestAnimationFrame(() => {
      setMode(readMode());
      setHud(readHud());
    });
    return () => {
      cancelAnimationFrame(frame);
      stops.forEach((stop) => stop());
    };
  }, []);

  useEffect(() => {
    if (!mode || !today || mode === "c") return;
    let cancelled = false;
    void (async () => {
      try {
        const opened = await openLabDatabase(today, setStatus);
        if (cancelled) return;
        if (mode === "b") setData(await readStaticData(opened));
        setDb(opened);
      } catch (e) {
        setStatus(`테스트 데이터를 준비하지 못했어요: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, today]);

  const toggleHud = (on: boolean) => {
    setHud(on);
    try {
      localStorage.setItem(LAB_HUD_KEY, on ? "1" : "0");
    } catch {
      /* 저장 실패 시 이번 세션만 */
    }
  };

  let content: ReactNode = <LoadingScreen />;
  if (mode === "c") {
    content = (
      <AppShell
        screens={{
          settings: probed("settings", <Minimal title="설정" />),
          home: probed("home", <Minimal title="메인" />),
          anniversary: probed("anniversary", <Minimal title="우리의 기념일" />),
        }}
      />
    );
  } else if (mode === "a" && db) {
    content = (
      <DatabaseProvider db={db}>
        <RealDataShell />
      </DatabaseProvider>
    );
  } else if (mode === "b" && db && data && today) {
    content = (
      <DatabaseProvider db={db}>
        <StaticDataProvider data={data}>
          <AppShell
            screens={{
              settings: probed("settings", <SettingsScreen couple={data.couple} settings={data.settings} today={today} />),
              home: probed("home", <HomeScreen couple={data.couple} settings={data.settings} today={today} />),
              anniversary: probed("anniversary", <AnniversaryScreen couple={data.couple} settings={data.settings} today={today} />),
            }}
          />
        </StaticDataProvider>
      </DatabaseProvider>
    );
  } else if (mode) {
    content = (
      <div className="flex h-full items-center justify-center px-8 text-center text-ui-body text-text-secondary" role="status">
        {status}
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <AppFrame>
        <div className="h-full" data-lab-mode={mode ?? "loading"}>
          {content}
        </div>
        {mode && hud && <Hud />}
        {mode && <LabPanel mode={mode} hud={hud} onHud={toggleHud} db={db} />}
      </AppFrame>
    </MotionConfig>
  );
}
