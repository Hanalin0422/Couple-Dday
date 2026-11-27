# [LAB] 실기기 렌더링 비교 환경

화면 전환 사용감 원인을 iPhone 실기기에서 A/B/C 조건으로 비교하기 위한 테스트 전용 코드다. 운영 화면 전환 구현(AppShell)·디자인·기능은 바꾸지 않는다.

- 반영 전 main 커밋: `b62394a0de2c1b940ee8d14176b017f0bbeebb29` (`b62394a`)
- 경로: `/lab?mode=a|b|c` (오른쪽 위 `LAB` 버튼에서 모드 전환·HUD 켜기/끄기·테스트 데이터 다시 만들기·앱으로 돌아가기)
- 홈 화면 앱에서 진입: 설정 화면 제목 "설정"을 3초 안에 7번 탭
- 테스트 데이터: 별도 IndexedDB `couple-dday-lab` (사용자 DB `couple-dday` 는 열지 않음)

| 모드 | 내용 |
|---|---|
| A | 실제 화면 + 실제 데이터 처리(테스트 DB) |
| B | 실제 화면 + 정적 데이터(테스트 DB 를 시작 시 한 번만 읽음, 전환 중 DB 조회 없음) |
| C | 최소 정적 UI |

## 제거 방법

1. 폴더 삭제: `src/lab/`, `src/app/lab/`, `tests/e2e/lab.spec.ts`
2. `[LAB]` 표시 줄 되돌리기 (`grep -rn "\[LAB\]" src next.config.ts`):
   - `src/hooks/useDatabase.tsx`: `useStaticData` import 와 각 훅의 정적 데이터 분기 → `return useLiveQuery(...)` 원래 형태
   - `src/app/layout.tsx`: `Script` / `LAB_DEVTOOLS_HOOK_SCRIPT` import 와 `<Script id="lab-commit-hook">`
   - `src/features/settings/SettingsScreen.tsx`: `useLabEntryTap` import·호출, `<PageHeader title="설정" />` 로 복원
   - `next.config.ts`: `buildSha`, `env`, `spawnSync` import
3. 또는 위 파일만 반영 전 커밋으로 복원: `git checkout b62394a -- src/hooks/useDatabase.tsx src/app/layout.tsx src/features/settings/SettingsScreen.tsx next.config.ts`
4. 테스트 DB 는 기기의 별도 IndexedDB 로 남는다(사용자 데이터와 무관). 코드 제거 전에 `/lab` 패널의 "테스트 데이터 삭제하고 앱으로"를 누르면 함께 지워진다.
