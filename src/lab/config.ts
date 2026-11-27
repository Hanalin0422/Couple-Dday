/**
 * [LAB] 실기기 렌더링 비교용 테스트 환경 설정. 제거 방법: src/lab/README.md
 * 테스트 데이터는 사용자 DB(couple-dday)와 분리된 별도 IndexedDB 를 사용한다.
 */
export const LAB_DB_NAME = "couple-dday-lab";
export const LAB_PATH = "/lab";
export const LAB_HUD_KEY = "couple-dday-lab:hud";
export type LabMode = "a" | "b" | "c";
export const LAB_MODES: { mode: LabMode; label: string; description: string }[] = [
  { mode: "a", label: "A", description: "실제 앱과 같은 화면·데이터 처리(테스트 전용 DB)" },
  { mode: "b", label: "B", description: "같은 화면 UI + 정적 데이터(DB 조회 없음)" },
  { mode: "c", label: "C", description: "최소 정적 UI(제목·문단만)" },
];
export const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? "local";

/**
 * React 커밋 횟수 계측용 훅. /lab 경로에서만 React 로드 전에 설치된다(app/layout.tsx 의 beforeInteractive 스크립트).
 * 일반 앱 경로에서는 경로만 확인하고 아무것도 하지 않는다.
 */
export const LAB_DEVTOOLS_HOOK_SCRIPT = `(function(){try{if(location.pathname!=="${LAB_PATH}"&&location.pathname.indexOf("${LAB_PATH}/")!==0)return;if(window.__REACT_DEVTOOLS_GLOBAL_HOOK__)return;var w=window;w.__labCommits=0;var noop=function(){};w.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,isDisabled:false,renderers:new Map(),inject:function(){return 1},onCommitFiberRoot:function(){w.__labCommits++},onCommitFiberUnmount:noop,onPostCommitFiberRoot:noop,onScheduleFiberRoot:noop,setStrictMode:noop,checkDCE:noop};}catch(e){}})();`;
