"use client";

/**
 * 공통 앱 프레임 — 반응형 기준의 단일 정의 위치.
 *
 * - 휴대폰 폭 프레임(최대 480px, 넓은 화면에서는 가운데)을 size container 로 지정한다.
 * - .app-scale 에서 공통 단위 --u 와 모든 크기 토큰을 정의한다(src/styles/tokens.css). 온보딩·메인·설정·기념일·하단 메뉴·Bottom Sheet 가 같은 값을 상속한다.
 * - 상단 Safe Area 는 콘텐츠 영역에서 한 번만 반영한다. 하단 Safe Area 는 하단 메뉴(AppShell) 또는 스크롤 콘텐츠 끝에서 반영한다.
 * - Bottom Sheet 는 프레임 내부 overlay 영역에 렌더링되어 같은 토큰과 폭 제한을 따른다.
 */
import type { ReactNode } from "react";

export const OVERLAY_ROOT_ID = "app-overlay-root";

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 mx-auto w-full max-w-[480px] overflow-hidden bg-background" style={{ containerType: "size" }} data-testid="app-frame">
      <div className="app-scale relative h-full w-full">
        <div className="absolute inset-0 pt-[env(safe-area-inset-top)]" data-testid="app-content">
          {children}
        </div>
        <div id={OVERLAY_ROOT_ID} className="pointer-events-none absolute inset-0 z-50 *:pointer-events-auto" />
      </div>
    </div>
  );
}
