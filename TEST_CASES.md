# 커플 디데이 PWA — 테스트 케이스 명세

- 버전: 0.4 (Phase 4 온보딩·메인·설정 반영, 2026-11-26)
- 기준 문서: `REQUIREMENTS.md` v1.1, `ARCHITECTURE.md` v1.1, `.agents/skills/dday-design/SKILL.md`
- 역할: 요구사항 ID ↔ 테스트 케이스 추적, 자동화/수동/실기기 검증 기준. 구현과 함께 계속 보완한다.

## 1. 운영 규칙

### 1.1 ID와 레벨

- 테스트 ID: `TC-<영역>-<번호>` (예: `TC-DATE-003`). 한 번 부여한 ID는 재사용하지 않는다. 폐기 시 상태를 `폐기`로 바꾼다.
- 관련 요구사항 열에는 REQUIREMENTS.md(`SYS`, `ONB`, `DATE`, `HOME`, `ANN`, `CUS`, `TML`, `MEM`, `SET`, `BAK`, `RES`, `RST`, `BTS`, `NAV`, `PWA`, `NFR`) 및 ARCHITECTURE.md(`ARC`, `DB`) ID를 범위 표기 없이 개별로 적는다.
- `tests/unit/traceability.test.ts`가 두 명세의 모든 요구사항 ID가 이 문서에 1회 이상 등장하는지 검사한다. 새 요구사항을 추가하면 이 문서에도 테스트를 추가해야 한다.

| 레벨 | 의미 | 도구 / 위치 |
|---|---|---|
| U | 단위 (순수 함수, Domain) | Vitest `tests/unit` |
| I | 통합 (DB 트랜잭션, 저장소, 어댑터) | Vitest + fake-indexeddb `tests/integration` |
| E | E2E (사용자 흐름) | Playwright `tests/e2e` (chromium-iphone, webkit-iphone) |
| V | 시각 회귀 | Playwright screenshot. 기준 이미지는 사용자 승인 후 생성 |
| D | iPhone 실기기 | 수동 체크리스트 (§5) |
| R | 정적 검토 | 코드/설정/문서 검토, lint 규칙 |

### 1.2 상태

| 상태 | 의미 |
|---|---|
| 통과 | 자동화되어 최근 실행에서 통과 |
| 대기 | 명세 확정, 해당 Phase 구현 시 작성 예정 |
| 보류 | 관련 정책 미확정(ARCHITECTURE.md §17). 승인 후 기대 결과 확정 |
| 미검증 | 현재 환경에서 실행 불가. 검증 방법은 비고 참조 |

### 1.3 고정 테스트 데이터 (가상 데이터만 사용)

| 키 | 값 |
|---|---|
| FX-START | 연애 시작일 `2026-07-01` |
| FX-TODAY | 기준 오늘 `2026-11-25` (1일 방식 148일) |
| FX-OFFSET | `1` (기본값). 0일 방식 비교 시 명시 |
| FX-NAMES | 내 이름 `하늘`, 상대 `바다` (가상) |
| FX-LEAP | 시작일 `2024-02-29` |
| FX-OVERLAP | 시작일 `2000-03-01`, 0일 방식 → `2023-03-01`에 23주년과 8400일 겹침 |
| FX-TZ | `Asia/Seoul` (Vitest `TZ`, Playwright `timezoneId`) |
| FX-PHOTOS | `tests/fixtures`의 가상 생성 이미지(JPEG/PNG/WebP, 손상 파일, 동일 바이트 사본) |

FX-START 기준 자동 기념일 (1일 방식 / 0일 방식):

| 기념일 | 1일 방식 | 0일 방식 | FX-TODAY 기준 D-N (1일 방식) |
|---|---|---|---|
| 10일 | 2026-07-10 | 2026-07-11 | 지남 |
| 30일 | 2026-07-30 | 2026-07-31 | 지남 |
| 50일 | 2026-08-19 | 2026-08-20 | 지남 |
| 100일 | 2026-10-08 | 2026-10-09 | 지남 |
| 200일 | 2027-01-16 | 2027-01-17 | D-52 |
| 300일 | 2027-04-26 | 2027-04-27 | D-152 |
| 1주년 | 2027-07-01 | 2027-07-01 | D-218 |
| 400일 | 2027-08-04 | 2027-08-05 | D-252 |
| 2주년 | 2028-07-01 | 2028-07-01 | D-584 |

### 1.4 갱신 규칙

- 정책이 승인되면 `보류` 항목의 기대 결과를 확정하고 상태를 `대기`로 바꾼다.
- 테스트를 자동화하면 상태를 `통과`로 바꾸고 비고에 테스트 파일을 적는다. 실패를 숨기거나 기대값을 임의로 완화하지 않는다.
- 실행 결과는 §7 실행 기록에 날짜와 명령을 남긴다.

## 2. 실행 명령

| 명령 | 내용 |
|---|---|
| `npm run typecheck` | TypeScript 검사 |
| `npm run lint` | ESLint (계층 의존성 규칙 포함) |
| `npm test` | Vitest unit + integration |
| `npm run build` | Next.js 프로덕션 빌드 + Service Worker 생성 |
| `npm run test:e2e` | Playwright (프로덕션 빌드 필요, `next start` 자동 기동) |
| `npm run verify` | typecheck → lint → test → build |

## 3. 기능별 테스트 케이스

### 3.1 Phase 0 환경 및 설정

| ID | 관련 요구사항 | 레벨 | 시나리오 / 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|---|
| TC-ENV-001 | NFR-010 | R | `src/domain`에서 react, dexie, window 등을 import/사용 | ESLint `no-restricted-imports`/`no-restricted-globals` 오류 | 통과 (lint 규칙 수동 프로브) |
| TC-ENV-002 | NFR-006, ARC-E01 | I | fake-indexeddb에서 두 store를 한 트랜잭션으로 쓰고 중간에 예외 발생 | 모든 변경 롤백 | 통과 `tests/integration/indexeddb-env.test.ts` |
| TC-ENV-003 | RES-E05, ARC-D03 | I | 16MiB 압축 폭탄을 상한 1MiB로 스트리밍 해제 | 상한 직후 중단, 전체 해제하지 않음 | 통과 `tests/integration/jszip-inflate-limit.test.ts` |
| TC-ENV-004 | RES-E05 | I | ZIP 헤더의 uncompressed size를 100으로 위조한 8MiB 엔트리 | 선언 크기와 무관하게 실제 해제 바이트로 차단 | 통과 `tests/integration/jszip-inflate-limit.test.ts` |
| TC-ENV-005 | NFR-012 | R | `npm run verify` | 타입/린트/테스트/빌드 모두 성공 | 통과 |

### 3.2 날짜 및 디데이 계산 (Domain)

| ID | 관련 요구사항 | 레벨 | 시나리오 / 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|---|
| TC-DATE-001 | DATE-010, DB-014 | U | `validateLocalDate`: `2026-07-01`, `2024-02-29` | 유효 | 통과 `tests/unit/domain/local-date.test.ts` |
| TC-DATE-002 | DATE-E02, DB-014 | U | `2026-02-30`, `2025-02-29`, `2026-13-01`, `2026-7-1`, `2026-07-01T00:00`, 빈 문자열 | 모두 거부, 자동 보정 없음 | 통과 `tests/unit/domain/local-date.test.ts` |
| TC-DATE-003 | HOME-002, HOME-003 | U | FX-START, 1일 방식, 오늘 2026-07-01 / 07-10 / 10-08 / 11-25 / 2027-07-01 | 1 / 10 / 100 / 148 / 366 | 통과 `tests/unit/domain/dday.test.ts` |
| TC-DATE-004 | HOME-003, ONB-006 | U | 같은 날짜, 0일 방식 | 0 / 9 / 99 / 147 / 365 | 통과 `tests/unit/domain/dday.test.ts` |
| TC-DATE-005 | ONB-007 | U | 신규 기본 설정 | dayOffset = 1 | 대기 |
| TC-DATE-006 | DATE-010 | U | 2028-07-01(윤일 포함 구간), 1일 방식 | 732 | 통과 `tests/unit/domain/dday.test.ts` |
| TC-DATE-007 | DATE-010 | U | 계산 구현 검토 | `differenceInCalendarDays`/`addDays`/`addYears` 사용, 밀리초/86400000 나눗셈 및 `new Date('YYYY-MM-DD')` 미사용 | 통과 `tests/unit/domain/dday.test.ts` |
| TC-DATE-008 | DATE-E03 | U | 다른 TZ(UTC, America/Los_Angeles)에서 동일 현지 날짜 문자열로 계산 | 결과 동일 (현지 달력 날짜 기준) | 통과 `tests/unit/domain/local-date.test.ts` |
| TC-DATE-009 | DATE-E05, HOME-E08, HOME-E28 | U | 오늘(2026-06-30) < 시작일 | 오류 상태 반환, 음수 디데이/진행률 없음, 주년 아님 | 통과 `tests/unit/domain/dday.test.ts` |
| TC-DATE-010 | ANN-008 | U | 남은 일수: FX-TODAY → 200일(2027-01-16) | 52 (오프셋 미가산) | 통과 `tests/unit/domain/dday.test.ts` |
| TC-DATE-011 | DATE-001, DATE-004 | U | 시작일 입력 검증: 오늘 / 내일 | 오늘 허용, 내일 거부 | 통과 `tests/unit/domain/dday.test.ts` |
| TC-DATE-012 | DATE-008, DATE-E01 | U | 저장 직전 재검증에 미래 날짜를 직접 전달(UI 우회) | 저장 거부 | 통과 `tests/unit/domain/dday.test.ts` |
| TC-DATE-013 | DATE-009, CUS-003 | U | 사용자 지정 기념일 날짜: 시작일 전날 / 시작일 / 미래 | 거부 / 허용 / 허용 | 통과 `tests/unit/domain/dday.test.ts` |
| TC-DATE-014 | DATE-002, DATE-003, DATE-005 | E | 온보딩과 설정에서 DatePicker 열기 | 동일 컴포넌트, 미래 날짜 비활성, 다음 달 이동 불가 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-DATE-015 | DATE-006 | E | DatePicker에서 날짜 변경 후 취소 | 기존 값 유지 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-DATE-016 | DATE-007, DATE-E06 | E | 23:59에 DatePicker를 열고 자정 경과(clock 조작) | 선택 가능 범위가 새 오늘로 갱신, 저장 직전 재검증 | 대기 |
| TC-DATE-017 | DATE-E03, DATE-E04, HOME-009, PWA-009 | E | 앱 활성 상태에서 자정 경과 / `visibilitychange`·`pageshow`·`focus` 복귀 | 오늘 재조회, 디데이/진행률 갱신 | 대기 |
| TC-DATE-018 | DATE-E05 | E | 기기 날짜를 시작일 이전으로 설정 후 실행, 다시 정상 날짜로 복귀 | 날짜 확인 안내, 음수 미표시, DB 변경 없음, 복귀 시 재계산 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |

### 3.3 자동 기념일

| ID | 관련 요구사항 | 레벨 | 시나리오 / 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|---|
| TC-ANN-001 | ANN-001, ANN-002 | U | FX-START, 1일 방식 생성 | §1.3 표의 10/30/50/100/200/300/400일 날짜, 100일 이후 100일 단위 계속 생성 | 통과 `tests/unit/domain/auto-anniversary.test.ts` |
| TC-ANN-002 | ANN-006 | U | 같은 시작일, 0일 방식 | 일수 기념일이 하루씩 뒤로 이동(100일 2026-10-09) | 통과 `tests/unit/domain/auto-anniversary.test.ts` |
| TC-ANN-003 | ANN-003, ANN-007 | U | 0일/1일 방식 각각 주년 생성 | 1주년 2027-07-01, 2주년 2028-07-01로 동일 | 통과 `tests/unit/domain/auto-anniversary.test.ts` |
| TC-ANN-004 | ANN-003, HOME-E14 | U | FX-LEAP 주년 1~4 | 2025-02-28, 2026-02-28, 2027-02-28, 2028-02-29 (원 시작일 기준, 누적 가산 없음) | 통과 `tests/unit/domain/auto-anniversary.test.ts` |
| TC-ANN-005 | ANN-004, ANN-005 | U | 시작일 2026-07-01 → 2026-07-05 변경 후 재생성 | 1일 방식 100일 2026-10-12, 날짜순 정렬 | 통과 `tests/unit/domain/auto-anniversary.test.ts` |
| TC-ANN-006 | ANN-011 | U | 자동 기념일 ID | `auto:day:100`, `auto:year:1` 형식, 시작일/오프셋 변경에도 ID 동일 | 통과 `tests/unit/domain/auto-anniversary.test.ts` |
| TC-ANN-007 | ANN-004, TML-015 | U | FX-OVERLAP, 0일 방식 | 2023-03-01에 `auto:year:23`과 `auto:day:8400`이 각각 존재, 안정적 순서 | 통과 `tests/unit/domain/auto-anniversary.test.ts` |
| TC-ANN-008 | ANN-008 | U | 기념일 당일/미래 표시 값 | 당일 `D-DAY`, 미래 `D-N` | 통과 `tests/unit/domain/dday.test.ts` |
| TC-ANN-009 | ANN-009 | U | FX-TODAY 가장 가까운 예정 기념일 | 200일(2027-01-16) | 통과 `tests/unit/domain/custom-timeline.test.ts` |
| TC-ANN-010 | ANN-010, CUS-E04 | E | 자동 기념일 카드 | 수정/삭제/숨기기 조작 미제공 | 대기 |

### 3.4 메인 화면 진행률 및 주년 표시

| ID | 관련 요구사항 | 레벨 | 시나리오 / 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|---|
| TC-HOME-001 | HOME-E01 | U | FX-START, 오늘 2026-07-01 | 메인 진행률 0% | 통과 `tests/unit/domain/home-progress.test.ts` |
| TC-HOME-002 | HOME-004, HOME-005 | U | 오늘 2026-07-05 (첫 목표 10일 2026-07-10) | 이전 기준 시작일, 4/9 ≈ 44.44% | 통과 `tests/unit/domain/home-progress.test.ts` |
| TC-HOME-003 | HOME-E02, HOME-E03 | U | 2026-10-08 / 2026-10-09 | 100% / 1% | 통과 `tests/unit/domain/home-progress.test.ts` |
| TC-HOME-004 | HOME-E04 | U | FX-TODAY | 48% (이전 2026-10-08, 목표 2027-01-16) | 통과 `tests/unit/domain/home-progress.test.ts` |
| TC-HOME-005 | HOME-E05 | U | 199일 / 200일 / 201일 (2027-01-15/16/17) | 99% / 100% / 1% | 통과 `tests/unit/domain/home-progress.test.ts` |
| TC-HOME-006 | HOME-E06, HOME-E15 | U | FX-OVERLAP 당일 및 다음 날 | 당일 100%, 목표 중복 제거로 분모 0 없음, 다음 날 다음 구간 | 통과 `tests/unit/domain/home-progress.test.ts` |
| TC-HOME-007 | HOME-E07, HOME-E17 | U | 시작일/오프셋 변경 후 재계산 | 목표 날짜·주년 여부가 새 설정 기준으로 갱신 | 통과 `tests/unit/domain/home-progress.test.ts` |
| TC-HOME-008 | HOME-005, CUS-010 | U | FX-TODAY, 사용자 지정 2026-12-01 추가 | 메인 48% 유지 | 통과 `tests/unit/domain/home-progress.test.ts` |
| TC-HOME-009 | HOME-014, HOME-015, HOME-E11 | U | `getHomeDdayDisplay` 2027-07-01 | `type: 'anniversary'`, anniversaryYear 1, label `1주년`, subtitle `HAPPY ANNIVERSARY`, value 366 | 통과 `tests/unit/domain/home-progress.test.ts` |
| TC-HOME-010 | HOME-E10, HOME-E12, HOME-021 | U | 2027-06-30 / 2027-07-02 | `type: 'days'`, subtitle `DAYS` | 통과 `tests/unit/domain/home-progress.test.ts` |
| TC-HOME-011 | HOME-017, HOME-E13 | U | 2027-07-01에 0일↔1일 변경 | 주년 표시 유지, value만 365↔366 | 통과 `tests/unit/domain/home-progress.test.ts` |
| TC-HOME-012 | HOME-018 | U | FX-OVERLAP 2023-03-01 | 메인 표시 `23주년` 우선 | 통과 `tests/unit/domain/home-progress.test.ts` |
| TC-HOME-013 | HOME-019, HOME-E19 | U | 사용자 지정 기념일 당일(주년 아님) | `type: 'days'` | 통과 `tests/unit/domain/home-progress.test.ts` |
| TC-HOME-014 | HOME-020 | U | 주년 당일 진행률 | 100% | 통과 `tests/unit/domain/home-progress.test.ts` |
| TC-HOME-015 | HOME-E14 | U | FX-LEAP 2025-02-28 / 2028-02-29 / 2028-02-28 | 주년 / 주년(4주년) / 일반 | 통과 `tests/unit/domain/home-progress.test.ts` |
| TC-HOME-016 | HOME-001, ONB-E09 | E | 완료된 데이터로 앱 실행 | 메인 기본 진입, 온보딩 미표시 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-HOME-017 | HOME-006, HOME-007, HOME-008, ONB-004 | E | FX-NAMES, 사진 없음 | 원 아래 두 기본 프로필·하트·이름, 시작일 `2026.07.01` | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-HOME-018 | HOME-010, SET-007 | E | 설정에서 이름 변경 저장 후 메인 이동 | 즉시 반영 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-HOME-019 | HOME-011 | E | 메인 화면 텍스트 검사 | 다음 기념일 이름/남은 일수 미표시 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-HOME-020 | HOME-012, HOME-E09 | E | 뷰포트 320×568, 375×667, 390×844, 430×932 | 문서 세로 스크롤 없음, 원·프로필 잘림 없음 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-HOME-021 | HOME-013, NAV-001 | E | 메인 하단 메뉴 | 중앙 하트 활성(accent), 텍스트 없음 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-HOME-022 | HOME-016, HOME-E16 | E | 1, 2, 10, 99주년 표시 | 숫자 Cormorant Garamond Italic, '주년' 마루 부리, 한 줄, 원 내부에서 잘림·줄바꿈·말줄임 없음 | 대기 |
| TC-HOME-023 | HOME-029 | E | 일반일/주년 당일 레이아웃 비교 | 원 크기, 프로필 위치, 하단 메뉴 위치 동일 | 대기 |
| TC-HOME-024 | HOME-E18 | E | 주년 당일 23:59:59 → 자정 경과 | 애니메이션 정리, 일반 디데이 디자인 복귀 | 대기 |

### 3.5 주년 축하 애니메이션

| ID | 관련 요구사항 | 레벨 | 시나리오 / 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|---|
| TC-CEL-001 | HOME-022, HOME-023 | U | 자동 재생 판정: 주년 당일 + 이력 없음 / 같은 날짜·시작일 이력 있음 | 재생 / 미재생 | 통과 `tests/unit/home/celebration.test.ts` |
| TC-CEL-002 | HOME-E17 | U | 이력 키가 시작일을 포함하는지 (시작일 변경 후 새 주년) | 다른 식별자로 판정 | 통과 `tests/unit/home/celebration.test.ts` |
| TC-CEL-003 | HOME-E29 | I | localStorage 접근 시 예외 발생 | 앱 오류 없음, 같은 실행 세션에서 재자동재생 없음, 주년 디자인 유지 | 통과 `tests/unit/home/celebration.test.ts` |
| TC-CEL-004 | HOME-024 | I | 수동 재생 후 이력 확인 | 자동 재생 이력 변경 없음 | 통과 `tests/unit/home/celebration.test.ts` |
| TC-CEL-005 | RST-006 | I | 전체 초기화 | `couple-dday:celebration:last-auto-played` 키 제거 | 대기 |
| TC-CEL-006 | BAK-001 | I | 백업 생성 | 축하 재생 이력 미포함 | 대기 |
| TC-CEL-007 | HOME-E22 | I | 재생 중 다시 재생 요청 | 이전 rAF 취소 후 1개 루프만 실행 | 대기 |
| TC-CEL-008 | HOME-025 | I | 가짜 시계로 7초 진행 | 종료 구간에서 투명도 감소 후 종료, 입자 0, 캔버스 초기화 | 대기 |
| TC-CEL-009 | HOME-022 | E | 주년 당일 최초 메인 진입 | 오버레이 캔버스 재생 시작 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-CEL-010 | HOME-E20, HOME-E21 | E | 같은 날 설정/기념일 다녀오기, 앱 재실행 | 자동 재생 반복 없음, 주년 디자인 유지 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-CEL-011 | HOME-024, HOME-031 | E | 원형 디데이 영역 터치 | 재생, 별도 재생 버튼/설정 메뉴 없음 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-CEL-012 | HOME-026 | E | 재생 중 하단 메뉴 탭, 좌우 스와이프 | 정상 이동 (캔버스 `pointer-events: none`) | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-CEL-013 | HOME-E23, HOME-E26, PWA-015 | E | 재생 중 화면 이동 / `visibilitychange: hidden` | cancelAnimationFrame 호출, 리소스 정리 | 대기 |
| TC-CEL-014 | HOME-027, HOME-E24 | E | `reducedMotion: 'reduce'`로 주년 당일 진입 후 원형 터치 | 자동 재생 없음, 주년 디자인 유지, 터치 시 재생 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-CEL-015 | HOME-028 | E | 일반 날짜, 100일 당일 | 캔버스 애니메이션 실행 없음 | 대기 |
| TC-CEL-016 | HOME-E25 | E | Canvas `getContext`가 null을 반환하도록 주입 | 메인 정상 렌더링, 주년 디자인 표시 | 대기 |
| TC-CEL-017 | HOME-030, HOME-E27, PWA-014 | E | SW 캐시 후 오프라인에서 주년 당일 | 주년 폰트·애니메이션 정상 | 대기 |
| TC-CEL-018 | HOME-032 | R | 코드 검토 | Audio/사운드 API 미사용 | 통과 (코드 검토: Audio API 미사용) |
| TC-CEL-019 | HOME-025 | R | 입자 설정 검토 | 약 65개, 2~6px, 타원 꽃가루+4각 별빛, celebration 토큰 색상, 경과 시간 기반 프레임, devicePixelRatio 반영 | 통과 `tests/unit/home/celebration.test.ts`, 코드 검토 |

### 3.6 온보딩

| ID | 관련 요구사항 | 레벨 | 시나리오 / 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|---|
| TC-ONB-001 | ONB-001, PWA-008 | E | 빈 DB 최초 실행 | DB 조회 완료 후 온보딩 표시. 조회 전에는 온보딩 미표시 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-ONB-002 | ONB-002, ONB-003, ONB-E01 | U | 이름 `""`, `"   "`, `" 하늘 "` | 거부 / 거부 / `하늘`로 저장 | 통과 `tests/integration/services/onboarding-settings.test.ts` |
| TC-ONB-003 | ONB-E02, DB-003 | U | 10자 / 11자, 이모지·결합 문자 포함 | 사용자 인식 문자 기준 10자 허용, 11자 거부 (2026-11-26 확정) | 통과 `tests/unit/application/entity-schemas.test.ts` |
| TC-ONB-004 | ONB-E02 | E | 한글 IME 조합 중 10자 경계 입력 | 조합이 깨지지 않음 | 대기 |
| TC-ONB-005 | ONB-005, ONB-E04 | E | 날짜 미선택 / 미래 날짜 | 시작하기 비활성 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-ONB-006 | ONB-008 | E | 두 이름과 날짜 입력 | 시작하기 활성화 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-ONB-007 | ONB-009, DB-002, DB-013 | I | 완료 저장 | couple/settings/photos/draft 단일 트랜잭션, draft 삭제, onboardingCompleted=true | 통과 `tests/integration/services/onboarding-settings.test.ts` |
| TC-ONB-008 | ONB-E07 | I | 완료 트랜잭션 중 실패 주입 | 완료 플래그 미설정, 데이터 변경 없음, 온보딩 유지·재시도 가능 | 통과 `tests/integration/services/onboarding-settings.test.ts` |
| TC-ONB-009 | ONB-012, ONB-E05 | E | 이름·날짜·방식·사진 입력 중 새로고침 | 마지막 임시 저장 상태 복구, 완료로 간주하지 않음 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-ONB-010 | ONB-E06 | I | draft 저장 실패 주입 | 오류 안내, 현재 입력 유지 | 대기 |
| TC-ONB-011 | ONB-013 | I | 완료 / 복원 성공 | draft 제거 | 통과 `tests/integration/services/onboarding-settings.test.ts` |
| TC-ONB-012 | ONB-004, ONB-E03 | E | 사진 선택 취소 | 기본 이미지 또는 기존 선택 유지 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-ONB-013 | ONB-010, RES-007 | E | "기존 데이터 복원하기" | 복원 흐름 진입 | 대기 |
| TC-ONB-014 | ONB-E08 | E | 온보딩 복원 취소/실패 | 기존 임시 입력 유지 | 대기 |
| TC-ONB-015 | ONB-011 | E | 온보딩 화면 | 하단 내비게이션 없음 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-ONB-016 | ONB-E09 | E | 완료 후 재실행, 설정 변경, 프로필 삭제 | 온보딩 재표시 없음 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |

### 3.7 사용자 지정 기념일 및 반복

| ID | 관련 요구사항 | 레벨 | 시나리오 / 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|---|
| TC-CUS-001 | CUS-001, BTS-012 | E | 기념일 화면 + 버튼 | 공통 Bottom Sheet 표시 | 대기 |
| TC-CUS-002 | CUS-002, CUS-E01, DB-003 | U | 이름 빈 값/공백/30자/31자, 날짜 없음 | 30자만 허용, 나머지 저장 차단 | 대기 |
| TC-CUS-003 | CUS-003, CUS-E02 | U | 시작일 이전 날짜 | 선택·저장 차단 | 통과 `tests/unit/domain/dday.test.ts` |
| TC-CUS-004 | CUS-007 | U | 시작일 이후 과거, 오늘, 미래 | 모두 등록 가능 | 통과 `tests/unit/domain/dday.test.ts` |
| TC-CUS-005 | CUS-004, ARC-A05 | U | 2026-08-15 매년 반복 등록 | 2026년부터 발생, 2025년 이전 소급 없음 | 통과 `tests/unit/domain/custom-timeline.test.ts` |
| TC-CUS-006 | CUS-E07, ARC-A04 | U | 2024-02-29 매년 반복 | 2025-02-28, 2028-02-29 (원본 월/일 기준) | 통과 `tests/unit/domain/custom-timeline.test.ts` |
| TC-CUS-007 | CUS-011 | U | 반복 발생 ID | `custom:{uuid}:{year}`, 일회성 `custom:{uuid}` | 통과 `tests/unit/domain/custom-timeline.test.ts` |
| TC-CUS-008 | CUS-009, CUS-E03 | I | 같은 이름·날짜 2건 등록 | 서로 다른 UUID, 각각 카드 표시 | 대기 |
| TC-CUS-009 | CUS-E03, BTS-009 | E | 저장 버튼 연속 탭 | 1건만 저장 | 대기 |
| TC-CUS-010 | CUS-005 | I | 일회성 기념일 이름/날짜 수정 | ID 유지, 연결 추억 유지 | 대기 |
| TC-CUS-011 | ARC-A02 | I | 반복 기념일 "해당 연도만" 수정 | `[seriesId, year]` override upsert, 발생 ID 유지 | 대기 |
| TC-CUS-012 | ARC-A02 | I | "전체 반복" 수정 | 시리즈 규칙 변경, 기존 발생 ID 보존. 기존 override 처리 방식은 보류(§6) | 보류 |
| TC-CUS-013 | CUS-006, ARC-A03, CUS-E05 | I | "해당 연도만" 삭제 (사진/메모 있음) | 영향 안내·확인 후 cancelled tombstone, 해당 발생 사진/메모만 삭제, 재생성 없음 | 대기 |
| TC-CUS-014 | ARC-A03, SET-017 | I | "전체 반복" 삭제 | 시리즈·예외·모든 연결 사진/메모 단일 트랜잭션 삭제 | 대기 |
| TC-CUS-015 | CUS-E06 | I | 저장/삭제 트랜잭션 실패 주입 | 기존 데이터 유지, 오류 안내 | 대기 |
| TC-CUS-016 | CUS-008 | E | 자동+사용자 지정 혼합 | 날짜순 통합 표시 | 대기 |
| TC-CUS-017 | DB-009, DB-010 | I | 일회성 시리즈에 예외 추가 / cancelled 발생 건에 추억 저장 시도 | 거부 | 대기 |
| TC-CUS-018 | CUS-004 (반복 유형 전환, 미확정) | I | 일회성↔매년 반복 전환 | 승인 전 기능 미제공 (§6) | 보류 |

### 3.8 타임라인

| ID | 관련 요구사항 | 레벨 | 시나리오 / 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|---|
| TC-TML-001 | TML-001 | U | 통합 목록 정렬 | 과거→미래 오름차순, 동률은 결정적 순서 | 통과 `tests/unit/domain/custom-timeline.test.ts` |
| TC-TML-002 | TML-005, TML-006 | U | `filterAnniversaries` FX-TODAY 경계 | 지난 날: date < 오늘, 다가오는 날: date >= 오늘, 당일은 전체·다가오는 날에 포함 | 통과 `tests/unit/domain/custom-timeline.test.ts` |
| TC-TML-003 | TML-014, ARC-C03 | U | 초기 범위 [2026-11-25, 2027-11-25), 1년 추가 | 경계 중복 없음, 추가 구간 연속 | 통과 `tests/unit/domain/custom-timeline.test.ts` |
| TC-TML-004 | TML-014 | U | 5년 뒤 일회성 사용자 지정 기념일 | 자동 범위와 무관하게 포함 | 통과 `tests/unit/domain/custom-timeline.test.ts` |
| TC-TML-005 | ARC-C01, TML-016 | U | FX-TODAY + 사용자 지정 2026-12-01 | 강조 카드 진행률 48/54 ≈ 88.89%, 메인 48%와 분리 | 통과 `tests/unit/domain/custom-timeline.test.ts` |
| TC-TML-006 | ARC-C02 | U | 가장 가까운 날짜에 2건 | 두 카드 모두 강조, 동일 진행률 | 통과 `tests/unit/domain/custom-timeline.test.ts` |
| TC-TML-007 | ARC-C01 | U | 시작일 당일 사용자 지정 기념일 | 당일 100%, 분모 0 없음 | 통과 `tests/unit/domain/custom-timeline.test.ts` |
| TC-TML-008 | TML-003, TML-004 | E | 필터 표시 | 지난 날 / 전체 / 다가오는 날, 동일 너비, 기본 전체 | 대기 |
| TC-TML-009 | TML-002 | E | 전체 필터 | `오늘 · 148일째` 구분선 | 대기 |
| TC-TML-010 | TML-007 | E | 최초 진입 | 오늘 근처 위치로 자동 스크롤 | 대기 |
| TC-TML-011 | TML-008, TML-009, TML-010 | E | 긴 목록 스크롤 | 제목·필터·하단 메뉴 고정, 타임라인만 스크롤 | 대기 |
| TC-TML-012 | TML-012, TML-013 | E | 당일/미래 카드 | 당일 D-DAY와 추억 등록 가능, 미래 D-N | 대기 |
| TC-TML-013 | TML-011 | E | 사진 있는 지난 기념일 | 사진·메모 조회, 접기/펼치기 | 대기 |
| TC-TML-014 | TML-015 | E | 같은 날짜 기념일 | 개별 카드 | 대기 |
| TC-TML-015 | TML-014 | E | 하단까지 스크롤하여 추가 로딩 | 중복 카드·스크롤 점프 없음 | 대기 |
| TC-TML-016 | TML-005 | E | 과거 기념일 없음 / 필터 결과 없음 | 정상 빈 상태 (문구는 §6 보류) | 보류 |

### 3.9 추억 사진 및 메모

| ID | 관련 요구사항 | 레벨 | 시나리오 / 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|---|
| TC-MEM-001 | MEM-001, MEM-002 | I | 과거·당일·미래 발생 건에 신규 사진 등록 | 과거·당일 허용, 미래 거부 | 대기 |
| TC-MEM-002 | MEM-003, MEM-E04, DB-004 | I | 4장 보유 상태에서 3장 추가 | 1장만 추가, 초과분 거부, 기존 유지 | 대기 |
| TC-MEM-003 | MEM-011, MEM-E07, ARC-B01, ARC-B02, DB-008 | I | 같은 발생 건에 동일 바이트 파일 재등록 / 같은 배치 내 중복 | 차단 (unique index + 트랜잭션 재검증) | 대기 |
| TC-MEM-004 | ARC-B01 | I | 다른 기념일에 같은 파일 | 허용 | 대기 |
| TC-MEM-005 | ARC-B02 | U | 원본 SHA-256 | 64자리 hex, 재압축본은 중복으로 판정하지 않음 | 대기 |
| TC-MEM-006 | MEM-009, ARC-B03, MEM-E09, DB-005, DB-006 | I | 첫 사진 등록 / 대표 삭제 / 마지막 사진 삭제 | 첫 사진 대표, 남은 첫 사진 대표, 대표 null | 대기 |
| TC-MEM-007 | MEM-010, ARC-B04, DB-007 | I | 순서 변경 | sortOrder 0부터 연속, 대표 ID 유지 | 대기 |
| TC-MEM-008 | MEM-E10 | I | 순서/대표 변경 실패 주입 | 기존 순서/대표 유지 | 대기 |
| TC-MEM-009 | MEM-013, ARC-B05, MEM-E11, DB-003 | I | 사진 없이 메모 저장, 500자/501자 | 단독 저장 허용, 501자 거부 | 대기 |
| TC-MEM-010 | ARC-B06, SET-016, SET-E07 | I | 시작일 변경으로 미래가 된 발생 건 | 기존 사진/메모 보존·조회·메모 수정 허용, 신규 사진 거부 | 대기 |
| TC-MEM-011 | MEM-006, ARC-B07 | I | 4000×3000 JPEG / 1000×800 PNG / 프로필 2000×2000 | 긴 변 1920 / 원본 크기 유지(확대 없음) / 512×512 이내, JPEG 품질 0.85 | 대기 |
| TC-MEM-012 | MEM-014, MEM-E02 | I | 손상 파일, 지원하지 않는 형식 | 해당 항목 실패 안내, 다른 형식 선택 가능 | 대기 |
| TC-MEM-013 | MEM-015 | I | GPS EXIF 포함 JPEG | 저장 Blob에 EXIF/GPS 없음 | 대기 |
| TC-MEM-014 | MEM-012, MEM-E06 | I | 3장 중 2번째 실패 | 1·3번째 저장, 실패 항목 구분·재시도 가능 | 대기 |
| TC-MEM-015 | MEM-E03 | I | 압축 실패 주입 | 해당 사진 미저장, 기존 사진 유지 | 대기 |
| TC-MEM-016 | MEM-E05 | I | QuotaExceededError 주입 | 실패 안내, 백업/공간 확보 안내 | 대기 |
| TC-MEM-017 | MEM-E08 | I | 처리 중 중단(트랜잭션 전/중) | 완료된 저장만 유지, 고아 참조 없음 | 대기 |
| TC-MEM-018 | MEM-007 | E | 등록 후 새로고침 | 사진·메모·순서·대표 유지 | 대기 |
| TC-MEM-019 | MEM-004, MEM-005 | E | 사진 확대(전체 화면), 삭제 확인 | 확대 표시, 확인 후 삭제 | 대기 |
| TC-MEM-020 | MEM-016 | E | 사진 등록 Sheet | 손잡이, 기념일명, "소중한 순간을 남겨보세요", 안내, "사진 선택하기", "다음에" 순서 | 대기 |
| TC-MEM-021 | MEM-E01 | E | 파일 선택 취소 | 상태 변경 없음 | 대기 |
| TC-MEM-022 | MEM-E12 | E | 사진 없는 기록 | 예시 사진 미표시 | 대기 |
| TC-MEM-023 | MEM-008 | I | 백업→복원 왕복 | 사진·메모·대표·순서 동일 (TC-RES-001과 함께) | 대기 |
| TC-MEM-024 | NFR-002 | I | 썸네일 표시/해제 | 사용 종료 시 revokeObjectURL 호출 | 대기 |
| TC-MEM-025 | ARC-B08, MEM-007 | I/E | 사진을 이미지 바이트(ArrayBuffer)+mimeType으로 저장·조회, WebKit(임시 세션)에서 프로필 사진 저장·표시 | Blob 저장 실패 없이 저장·재조회·표시 | 통과 `tests/integration/db/database.test.ts`, `tests/e2e/app-flow.spec.ts` (chromium, webkit) |

### 3.10 설정 및 데이터 정합성

| ID | 관련 요구사항 | 레벨 | 시나리오 / 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|---|
| TC-SET-001 | SET-001, SET-002, SET-E02 | I | 이름 변경 (유효/무효) | 유효값만 저장 | 통과 `tests/integration/services/onboarding-settings.test.ts` |
| TC-SET-002 | SET-003, SET-004, SET-E03, DB-004 | I | 프로필 사진 교체 / 삭제 | 신규 사진·참조·기존 사진 삭제를 한 트랜잭션, 삭제 시 기본 이미지 | 통과 `tests/integration/services/onboarding-settings.test.ts` |
| TC-SET-003 | SET-005 | E | 연애 시작일 변경 DatePicker | 오늘까지만 선택 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-SET-004 | SET-006, SET-014 | E | 계산 방식 변경 | 영향 안내·확인 후 저장, 안내 문구 `처음 사귄 날을 N일로 계산해요.` | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-SET-005 | SET-007, ARC-E03, SET-E04 | I | 저장 실패 주입 | 변경 전 데이터 유지, 성공 표시 없음, UI는 커밋 후에만 갱신 | 통과 `tests/integration/services/onboarding-settings.test.ts` |
| TC-SET-006 | SET-E01 | E | 변경 Sheet 취소 | 기존 값 유지 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-SET-007 | SET-015, SET-E05, DB-012 | I | 시작일 07-01→07-05 변경 (`auto:day:100`에 사진 있음) | 100일 날짜 10-08→10-12, 사진/메모/대표/순서 유지 | 통과 `tests/integration/services/onboarding-settings.test.ts` |
| TC-SET-008 | SET-E06, ARC-A01 | I | 시작일 이후로 변경하여 기존 사용자 지정 기념일이 시작일 이전이 됨 | 기념일·추억 유지, 신규 등록은 새 시작일 이상만 허용 | 대기 |
| TC-SET-009 | SET-008, SET-009, SET-010 | E | 설정 데이터 관리 카드 | 데이터 백업 / 데이터 복원 / 데이터 초기화(danger) 순서 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-SET-010 | SET-011 | E | 화면 꾸미기 카드 | 테마 `Dusty Rose` 표시, 추가 테마 선택 없음 (행 조작 여부 보류) | 대기 |
| TC-SET-011 | SET-012 | E | 설정 스크롤 | 콘텐츠만 스크롤, 하단 메뉴 고정 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-SET-012 | SET-013, ARC-D01 | E | 백업 성공 후 / 복원 후 | 마지막 백업 일시 표시(상세 배치 보류), 복원 후 백업 생성 일시 | 대기 |

### 3.11 데이터베이스 및 무결성

| ID | 관련 요구사항 | 레벨 | 시나리오 / 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|---|
| TC-DB-001 | DB-001 | I | couple/settings/draft에 id≠default 저장 시도 | 거부 | 통과 `tests/unit/application/integrity.test.ts` |
| TC-DB-002 | DB-002, PWA-007 | I | 완료 플래그 true + couple 없음 | 손상 상태로 판정, 자동 덮어쓰기 없음 | 통과 `tests/integration/db/app-bootstrap.test.ts` |
| TC-DB-003 | DB-011 | I | 존재하지 않는 발생 ID로 추억 저장 | 거부 | 통과 `tests/unit/application/integrity.test.ts` |
| TC-DB-004 | DB-013, NFR-006 | I | 복합 변경 중 실패 | 전체 롤백 | 통과 `tests/integration/db/write-transaction.test.ts` |
| TC-DB-005 | DB-014 | U | Instant `2026-11-25T06:30:00Z` 유효, 오프셋 없는 시각/잘못된 형식 거부 | 엄격 검증 | 통과 `tests/unit/domain/local-date.test.ts` |
| TC-DB-006 | DB-015, PWA-E05 | I | 두 연결에서 같은 revision 기반으로 수정 | 두 번째 쓰기 충돌 감지, 덮어쓰기 없음 | 통과 `tests/integration/db/write-transaction.test.ts` |
| TC-DB-007 | NFR-007, PWA-E04 | I | v1→v2 migration 실패 주입 | 데이터 보존, 오류 안내, 자동 삭제 없음 | 통과 `tests/integration/db/database.test.ts` |
| TC-DB-008 | PWA-E03 | I | DB open 실패 / 일부 store 누락 | 오류·재시도 화면, 신규 사용자로 판단하지 않음 | 통과 `tests/integration/db/app-bootstrap.test.ts` |
| TC-DB-009 | NFR-010 | I | 신규 DB 기본값 | dayOffset=1, lastBackupAt=null, onboardingCompleted=false | 통과 `tests/integration/db/app-bootstrap.test.ts` |
| TC-DB-010 | ARC-E01 | I | Zod 스키마로 각 엔티티 검증 | 유효/무효 픽스처 판정 | 통과 `tests/unit/application/entity-schemas.test.ts` |
| TC-DB-011 | ARC-E01 | I | `useLiveQuery` 반영 | 커밋 후에만 UI 데이터 갱신, Optimistic Update 없음 | 대기 |
| TC-DB-012 | PWA-E05 | E | 두 탭에서 동시 수정 | 최신 상태 반영, 충돌 안내 | 대기 |

### 3.12 백업

| ID | 관련 요구사항 | 레벨 | 시나리오 / 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|---|
| TC-BAK-001 | BAK-001, BAK-002, BAK-003, BAK-004, BAK-005, BAK-006 | I | 전체 데이터 백업 생성 | §10 구조의 ZIP, 모든 JSON·이미지 포함, 예외/tombstone 포함 | 대기 |
| TC-BAK-002 | BAK-007, BAK-008 | I | manifest | format, formatVersion 1, databaseVersion, createdAt(UTC), encrypted=false, counts 일치 | 대기 |
| TC-BAK-003 | BAK-001 | I | 제외 항목 | 자동 기념일 목록, draft, 앱 캐시, 축하 재생 이력 미포함 | 대기 |
| TC-BAK-004 | BAK-010 | I | ZIP 생성 실패 주입 | DB 변경 없음, lastBackupAt 유지 | 대기 |
| TC-BAK-005 | BAK-012, ARC-D04 | I | 공유 취소 / 공유 완료 / 다운로드 | 취소 시 유지, 성공 시 파일 생성 일시로 갱신 | 대기 |
| TC-BAK-006 | ARC-D03 | I | 해제 총량이 256MiB를 넘는 데이터 | 백업 성공 처리하지 않음, 오류 안내, 데이터 삭제 없음 | 대기 |
| TC-BAK-007 | BAK-011 | E | 백업 시작 | 암호화 없음·개인정보/사진 포함 사전 안내 | 대기 |
| TC-BAK-008 | BAK-009 | E | 오프라인 백업 | 생성 가능 | 대기 |
| TC-BAK-009 | BAK-012 | I | 백업 중 다른 탭에서 초기화(revision 변경) | 오래된 백업 완료가 새 데이터 이력을 덮어쓰지 않음 | 대기 |

### 3.13 복원

| ID | 관련 요구사항 | 레벨 | 시나리오 / 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|---|
| TC-RES-001 | RES-001, RES-002, RES-005, MEM-008 | I | 백업→초기화→복원 왕복 | 모든 기록·ID·사진 해시 동일 | 대기 |
| TC-RES-002 | RES-003, RES-E04 | I | formatVersion 2, databaseVersion 미지원 | 호환성 오류, 기존 데이터 유지 | 대기 |
| TC-RES-003 | RES-E01 | I | ZIP 아님 / 잘린 ZIP | 거부 | 대기 |
| TC-RES-004 | RES-E02 | I | 필수 JSON 누락 / JSON 문법 오류 / Zod 위반 | 거부 | 대기 |
| TC-RES-005 | RES-E03 | I | 이미지 누락, 고아 참조, ID 충돌, contentHash 불일치, 대표/순서 위반 | 거부. 동일 이름·날짜는 충돌 아님 | 대기 |
| TC-RES-006 | RES-E05, ARC-D03 | I | 압축 폭탄(실제 해제 256MiB 초과), `../` 경로, 절대 경로, 중복 경로, 과다 파일, 중첩 아카이브, 암호화 엔트리, 예상 외 엔트리 | 검증 단계에서 차단, 트랜잭션 진입 없음 | 대기 |
| TC-RES-007 | RES-E09, ARC-D02 | I | 백업 시작일이 기기 오늘보다 미래 | 복원 차단, 날짜 확인 안내 | 대기 |
| TC-RES-008 | RES-E06, RES-006 | I | 교체 트랜잭션 실패/Quota 주입 | 기존 데이터 유지 | 대기 |
| TC-RES-009 | RES-004, RES-E07 | E | 교체 확인 취소 / 파일 선택 취소 | 변경 없음, 백업 권장 안내 표시 | 대기 |
| TC-RES-010 | RES-008, RES-009 | E | 복원 성공 | 메인 이동, 현재 날짜 기준 재계산 | 대기 |
| TC-RES-011 | RES-010, BTS-015 | E | 복원 중 재실행/닫기 시도 | 차단 | 대기 |
| TC-RES-012 | RES-E08 | I | 커밋 전 중단 / 커밋 후 | 기존 데이터 유지 / 완전한 복원 데이터만 존재 | 대기 |
| TC-RES-013 | ARC-D01 | I | 복원 후 settings | lastBackupAt = manifest.createdAt, 로컬 revision 증가(백업 revision 미사용), draft 제거 | 대기 |
| TC-RES-014 | ARC-A01 | I | 시작일 이전 사용자 지정 기록이 있는 백업 | 허용 | 대기 |

### 3.14 전체 데이터 초기화

| ID | 관련 요구사항 | 레벨 | 시나리오 / 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|---|
| TC-RST-001 | RST-001, RST-002, RST-003, RST-004, RST-005, RST-006 | I | 전체 초기화 | 개인 데이터·예외·사진·draft 삭제, 기본 settings 재생성(내부 revision 유지·증가), lastBackupAt=null | 대기 |
| TC-RST-002 | RST-009 | I | 초기화 트랜잭션 실패 주입 | 기존 데이터 유지, 오류 안내 | 대기 |
| TC-RST-003 | RST-007 | E | 초기화 진입 | 확인 및 백업 권장 안내, 취소 시 변경 없음 | 대기 |
| TC-RST-004 | RST-008 | E | 초기화 성공 | 온보딩 이동 | 대기 |
| TC-RST-005 | RST-001 | E | 초기화 후 SW 캐시 | 앱 리소스 캐시 유지(오프라인 실행 가능) | 대기 |

### 3.15 공통 Bottom Sheet 및 화면 이동

| ID | 관련 요구사항 | 레벨 | 시나리오 / 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|---|
| TC-BTS-001 | BTS-001, BTS-002, BTS-004, BTS-011 | E | Sheet 열기 | 하단에서 표시, dim, 핸들, Safe Area 반영 | 대기 |
| TC-BTS-002 | BTS-003 | E | Sheet 표시 중 배경 스크롤/터치 | 차단 (닫기 동작 제외) | 대기 |
| TC-BTS-003 | BTS-005, BTS-006, BTS-013 | E | 변경 없음 상태에서 아래 스와이프 / 취소 / 배경 터치 | 닫힘 | 대기 |
| TC-BTS-004 | BTS-014 | E | 입력 변경 후 모든 닫기 경로 | 변경 취소 확인 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-BTS-005 | BTS-007 | E | 긴 내용 | Sheet 내부만 스크롤 | 대기 |
| TC-BTS-006 | BTS-008 | D | 키보드 표시 | 입력과 주요 버튼 가림 없음 | 대기 |
| TC-BTS-007 | BTS-009, BTS-015 | E | 처리 중 버튼 연타 / 닫기 | 중복 실행 없음, 완료까지 닫기 제한 | 대기 |
| TC-BTS-008 | BTS-010 | E | Sheet 위에서 다른 Sheet 호출 | 중첩 없음, 동시에 1개 | 대기 |
| TC-BTS-009 | BTS-012 | V | Sheet 스타일 | 흰 배경, 핸들, 보조 문구, Pretendard 제목, 안내 카드, 주요 버튼, 취소 문구 (세부 픽셀 보류) | 보류 |
| TC-NAV-001 | NAV-001, PWA-013 | E | 설정/메인/기념일 하단 메뉴 | 순서 설정/하트/기념일, 활성 스타일, 일반 화면에서 동일 위치 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-NAV-002 | NAV-002, NAV-003, ARC-C04, PWA-012 | E | 각 화면 좌우 스와이프 | §12 표대로 이동, 양 끝에서 중단 | 통과 `tests/e2e/app-flow.spec.ts` (chromium, webkit) |
| TC-NAV-003 | NAV-004 | E | Sheet/사진 확대/입력/순서 조작 중 스와이프 | 화면 전환 없음 | 대기 |
| TC-NAV-004 | ARC-C05 | R/E | 화면 전환 | 단일 AppShell 내부 전환, URL별 페이지 라우팅 없음 | 대기 |
| TC-NAV-005 | NAV-002 | D | 세로 스크롤과 스와이프 동시 | 의도하지 않은 화면 전환 없음, iOS 뒤로가기 제스처 방해 없음 (임계값 60px 보류) | 보류 |

### 3.16 PWA 및 오프라인

| ID | 관련 요구사항 | 레벨 | 시나리오 / 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|---|
| TC-PWA-001 | PWA-001, PWA-002, SYS-006 | E | manifest 및 아이콘 조회 | name/short_name `D-Day`, display standalone, start_url `/`, background_color `#FFF8FA`, lang ko, 192/512/maskable 아이콘과 apple-touch-icon 200 응답 | 통과 `tests/e2e/smoke.spec.ts` (chromium, webkit) |
| TC-PWA-002 | SYS-005, PWA-003, PWA-004, PWA-014 | E | `/serwist/sw.js` precache 목록 | 앱 셸 `/`, 로컬 폰트 5종 포함, `Service-Worker-Allowed: /` | 통과 `tests/e2e/smoke.spec.ts` (chromium, webkit) |
| TC-PWA-003 | PWA-004 | E | 페이지 로드 시 폰트 요청 | 동일 출처 `/fonts/*`만 요청, 5종 모두 로드 | 통과 `tests/e2e/smoke.spec.ts` (chromium, webkit) |
| TC-PWA-004 | PWA-011, SYS-007 | E | `colorScheme: dark` 에뮬레이션 | 배경 `#FFF8FA` 유지 | 통과 `tests/e2e/smoke.spec.ts` (chromium, webkit) |
| TC-PWA-005 | PWA-003, PWA-E01 | E | SW 활성화 후 오프라인 재실행 | 앱 셸·폰트·데이터 정상 | 대기 |
| TC-PWA-006 | PWA-E02 | E | 최초 캐싱 전 오프라인 | 실행 가능한 범위에서 연결 필요 안내 (앱 미로딩 시 보장 불가) | 대기 |
| TC-PWA-007 | PWA-005 | E | 새 빌드 배포 후 SW 업데이트 | 개인 데이터 유지, 저장/복원/백업 중 강제 reload 없음 | 대기 |
| TC-PWA-008 | PWA-006, PWA-010 | E/D | 다양한 뷰포트·Safe Area | 콘텐츠 가림 없음 | 대기 |
| TC-PWA-009 | NFR-014 | I | `navigator.storage.persist` 지원/미지원 | 지원 시 요청, 실패해도 정상 동작, 영구 보존 보장 문구 없음 | 대기 |
| TC-PWA-010 | PWA-E06, PWA-E07 | D | iOS 저장소 삭제, Safari↔설치형 저장소 분리 | 백업/복원 안내로 복구 경로 제공 | 대기 |
| TC-PWA-011 | PWA-015 | E | 앱 백그라운드 전환 | 실행 중 애니메이션 정리 (TC-CEL-013) | 대기 |
| TC-PWA-012 | PWA-005 | R | manifest precache | Phase 8에서 `manifest.webmanifest` precache 포함 여부 확인 (현재 미포함) | 대기 |

### 3.17 UI 및 디자인 일치 (SKILL.md)

| ID | 관련 요구사항 | 레벨 | 시나리오 / 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|---|
| TC-DSN-001 | NFR-011, SYS-008 | U | SKILL.md §3 토큰 표 ↔ `src/styles/tokens.css` | 24개 토큰 값 일치, 임의 색상 토큰 없음, 다크모드 분기 없음 | 통과 `tests/unit/design-tokens.test.ts` |
| TC-DSN-002 | PWA-004, PWA-014 | U | 로컬 폰트 파일·라이선스 | 5개 @font-face, `/fonts/` 로컬 경로, 유효한 WOFF2, OFL 1.1 라이선스 동봉 | 통과 `tests/unit/fonts.test.ts` |
| TC-DSN-003 | SYS-009 | E | 기본 셸 | `<html lang="ko">`, 제목 `D-Day`, 콘솔 오류 없음 | 통과 `tests/e2e/smoke.spec.ts` (chromium, webkit) |
| TC-DSN-004 | NFR-011 | E | 페이지 제목 계산 스타일 | 온보딩/설정/기념일 제목 MaruBuri 28px 600, 동일 정렬·여백 | 대기 |
| TC-DSN-005 | NFR-011 | E | 메인 타이포그래피 | TOGETHER MaruBuri 18px 600 중앙, 디데이 Pretendard 72px 700, 하단 메뉴 11px 500 | 대기 |
| TC-DSN-006 | NFR-011 | E | 주년 타이포그래피 | 주년 숫자 Cormorant Garamond Italic 88px 500(비례 축소 허용), '주년' MaruBuri 38px 400, HAPPY ANNIVERSARY 12px 400 자간 2px accent, 색 text-primary | 대기 |
| TC-DSN-007 | NFR-011 | E | 원형 진행률 | 12시 시작 시계 방향, 둥근 끝, 시안 272×272/r121/트랙 5/진행 7 비례 | 대기 |
| TC-DSN-008 | NFR-011 | R | 실제 iOS 상태바/홈 인디케이터를 HTML로 복제하지 않음, 임의 장식·버튼·메뉴 없음 | 위반 없음 | 대기 |
| TC-DSN-009 | NFR-011, ARC-E02 | V | 일반 디데이 화면 (FX-TODAY, 모션 감소) | 승인 기준 이미지와 일치 | 대기 |
| TC-DSN-010 | NFR-011, ARC-E02 | V | 1주년 / 2주년 / 10주년, 축하 효과 종료 후 | 승인 기준 이미지와 일치 (입자 비활성) | 대기 |
| TC-DSN-011 | NFR-011, ARC-E02 | V | 온보딩 / 설정 / 기념일 화면 | 승인 기준 이미지와 일치 | 대기 |
| TC-DSN-012 | NFR-011 | V | 긴 이름(10자), 사진 있음/없음 | 레이아웃 잘림 없음 | 대기 |

### 3.18 서비스 범위 및 비기능

| ID | 관련 요구사항 | 레벨 | 시나리오 / 입력 | 기대 결과 | 상태 |
|---|---|---|---|---|---|
| TC-SYS-001 | SYS-001, SYS-002, SYS-003, SYS-011 | R | 코드·의존성 검토 | 로그인/광고/계정/공유/동기화 코드 및 의존성 없음 | 통과 (Phase 0 의존성 검토) |
| TC-SYS-002 | SYS-004, NFR-003, NFR-004 | E | 전체 흐름 중 네트워크 요청 감시 | 동일 출처 정적 리소스 외 요청 없음, 개인 데이터 전송 없음, 추적 스크립트 없음 | 대기 |
| TC-SYS-003 | SYS-010 | I | 커플 레코드 2건 저장 시도 | 1건만 허용 (DB-001) | 통과 `tests/unit/application/entity-schemas.test.ts` |
| TC-SYS-004 | SYS-012 | R | 디자인 변경 PR 검토 | SKILL.md 변경 및 사용자 승인 근거 존재 | 대기 |
| TC-NFR-001 | NFR-001 | E | 실행 후 메인 표시 시간 | 로컬 조회 후 빠른 표시 (기준은 실기기 측정 후 확정) | 대기 |
| TC-NFR-002 | NFR-005 | U/E | 이름·메모에 `<img src=x onerror=...>` 입력 | 텍스트로 표시, 스크립트 실행 없음, `dangerouslySetInnerHTML` 미사용 | 대기 |
| TC-NFR-003 | NFR-008 | E | 주요 버튼·메뉴 | 터치 영역 44×44px 이상, 접근 가능한 이름, 키보드 포커스 | 대기 |
| TC-NFR-004 | NFR-009 | E | 색상 대비 측정 | 결과 기록. 디자인 변경이 필요하면 승인 요청(임의 수정 금지) | 대기 |
| TC-NFR-005 | NFR-012 | R | 요구사항 ID 추적 | 모든 요구사항 ID가 본 문서에 존재 | 통과 `tests/unit/traceability.test.ts` |
| TC-NFR-006 | NFR-013 | D | 실기기 검증 | §5 체크리스트 수행 | 대기 |
| TC-NFR-007 | NFR-003 | R | 오류 로그 | 개인 데이터(이름, 메모, 사진) 미포함 | 대기 |

## 4. 요구사항 추적 요약

상세 추적은 §3 각 표의 "관련 요구사항" 열을 따른다. 아래는 영역별 요약이다.

| 요구사항 그룹 | 테스트 케이스 |
|---|---|
| SYS-001~012 | TC-SYS-001~004, TC-DSN-003, TC-PWA-001, TC-PWA-004 |
| ONB-001~013, ONB-E01~E09 | TC-ONB-001~016, TC-DATE-005, TC-HOME-016 |
| DATE-001~010, DATE-E01~E06 | TC-DATE-001~018 |
| HOME-001~032, HOME-E01~E29 | TC-HOME-001~024, TC-CEL-001~019, TC-DATE-009 |
| ANN-001~011 | TC-ANN-001~010, TC-DATE-010 |
| CUS-001~011, CUS-E01~E07 | TC-CUS-001~018, TC-DATE-013 |
| TML-001~016 | TC-TML-001~016 |
| MEM-001~016, MEM-E01~E12 | TC-MEM-001~024 |
| SET-001~017, SET-E01~E07 | TC-SET-001~012, TC-MEM-010, TC-CUS-014 |
| BAK-001~012 | TC-BAK-001~009, TC-CEL-006 |
| RES-001~010, RES-E01~E09 | TC-RES-001~014, TC-ONB-013, TC-ENV-003~004 |
| RST-001~009 | TC-RST-001~005, TC-CEL-005 |
| BTS-001~015, NAV-001~004 | TC-BTS-001~009, TC-NAV-001~005, TC-CUS-009 |
| PWA-001~015, PWA-E01~E07 | TC-PWA-001~012, TC-DATE-017, TC-DB-007~008, TC-DB-012 |
| NFR-001~014 | TC-NFR-001~007, TC-ENV-001~002, TC-DB-004, TC-MEM-024, TC-PWA-009 |
| ARC-A01~A05 | TC-SET-008, TC-CUS-011~014, TC-CUS-006, TC-CUS-005, TC-RES-014 |
| ARC-B01~B07 | TC-MEM-003~011 |
| ARC-C01~C05 | TC-TML-003, TC-TML-005~007, TC-NAV-002, TC-NAV-004 |
| ARC-D01~D04 | TC-RES-013, TC-RES-007, TC-RES-006, TC-BAK-005~006, TC-ENV-003 |
| ARC-E01~E03 | TC-DB-010~011, TC-ENV-002, TC-DSN-009~011, TC-SET-005 |
| DB-001~015 | TC-DB-001~012, TC-ONB-007, TC-MEM-002~009, TC-SET-002, TC-SET-007, TC-CUS-017 |

## 5. iPhone 실기기 검증 체크리스트

자동화(Playwright WebKit 포함)는 실기기 검증을 대체하지 않는다. 각 항목은 기기 모델, iOS 버전, Safari/설치형 여부, 날짜와 함께 기록한다.

| ID | 관련 요구사항 | 항목 | 기대 결과 | 상태 |
|---|---|---|---|---|
| TC-DEV-001 | PWA-001, PWA-002 | Safari 공유 → 홈 화면에 추가 → 실행 | standalone 실행, 이름 "D-Day"와 하트 아이콘 표시 | 미검증 |
| TC-DEV-002 | PWA-003, PWA-E01 | 비행기 모드에서 설치형 앱 재실행 | 앱 셸·폰트·데이터 정상 | 미검증 |
| TC-DEV-003 | PWA-006, BTS-011 | 노치/Dynamic Island/홈 인디케이터 기기 | Safe Area 가림 없음 | 미검증 |
| TC-DEV-004 | BTS-008, ONB-E02 | 온보딩/Sheet 입력 시 키보드, 한글 IME | 입력·버튼 가림 없음, 조합 정상 | 미검증 |
| TC-DEV-005 | MEM-014 | HEIC/HEIF 사진, Live Photo, 대용량 사진 선택 | 변환 가능 시 저장, 실패 시 안내 | 미검증 |
| TC-DEV-006 | MEM-006 | 사진 5장 연속 등록 메모리/시간 | 크래시 없음, 순차 처리 | 미검증 |
| TC-DEV-007 | BAK-012, ARC-D04 | 백업 공유 시트(파일 저장/AirDrop/취소) | 성공/취소 판정 정확 | 미검증 |
| TC-DEV-008 | RES-001 | 파일 앱에서 ZIP 선택 후 복원 | 왕복 데이터 동일 | 미검증 |
| TC-DEV-009 | PWA-E07 | Safari와 설치형 앱 저장소 분리 여부 확인 | 결과 기록, 안내 문구 검증 | 미검증 |
| TC-DEV-010 | NFR-014 | `storage.persist()` 결과 및 장기 미사용 후 데이터 유지 | 결과 기록, 보장 표현 없음 | 미검증 |
| TC-DEV-011 | HOME-025 | 주년 애니메이션 프레임·발열·메모리, 종료 후 리소스 정리 | 끊김 없음, 종료 후 정리 | 미검증 |
| TC-DEV-012 | HOME-016 | 주년 폰트 렌더링(Cormorant Italic, 마루 부리) | 시안과 일치 | 미검증 |
| TC-DEV-013 | HOME-012 | iPhone SE(작은 화면)~Pro Max 메인 | 스크롤·잘림 없음 | 미검증 |
| TC-DEV-014 | NAV-002 | 스와이프 임계값·세로 스크롤 충돌·iOS 가장자리 제스처 | 오작동 없음 | 미검증 |
| TC-DEV-015 | HOME-027 | 설정 > 손쉬운 사용 > 동작 줄이기 | 자동 재생 없음 | 미검증 |
| TC-DEV-016 | PWA-009 | 자정 직전 실행 유지, 백그라운드 후 복귀 | 날짜 갱신 | 미검증 |
| TC-DEV-017 | PWA-005 | 새 버전 배포 후 업데이트 | 데이터 유지, 작업 중 강제 reload 없음 | 미검증 |

## 6. 보류 항목 (정책 확정 후 기대 결과 확정)

| 관련 테스트 | 미확정 사항 | 근거 |
|---|---|---|
| TC-CUS-012 | 전체 반복 수정 시 기존 override/cancelled 처리, 최초 연도 변경 | ARCHITECTURE.md §17 |
| TC-CUS-018 | 반복 유형 전환 시 ID 매핑 | ARCHITECTURE.md §17 |
| TC-TML-016 | 빈 상태 문구, 동률 정렬 우선순위 | ARCHITECTURE.md §17 |
| TC-BTS-009 | Bottom Sheet 세부 픽셀 | REQUIREMENTS.md §14 |
| TC-NAV-005 | 스와이프 임계값 | ARCHITECTURE.md §12, §17 |

## 7. 실행 기록

| 일자 | 명령 | 결과 | 비고 |
|---|---|---|---|
| 2026-11-26 | `npm run typecheck` | 통과 | TypeScript 5.9.3 |
| 2026-11-26 | `npm run lint` | 통과 | 계층 규칙 위반 프로브로 오류 검출 확인 |
| 2026-11-26 | `npm test` | 통과 | unit/integration (TC-ENV-002~004, TC-DSN-001~002, TC-NFR-005) |
| 2026-11-26 | `npm run build` | 통과 | Next 16.4.6 Turbopack, SW precache 20개 3.5MB |
| 2026-11-26 | `npm run test:e2e -- --project=chromium-iphone` | 통과 5/5 | 시스템 라이브러리(libnss3 등) 부재로 로컬 우회 경로 사용. webkit-iphone 미실행(시스템 라이브러리 필요) |
| 2026-11-26 | `npm run verify`, chromium E2E | 통과 (24 / 5) | 앱 이름 D-Day·아이콘 반영 후 재실행. SW precache 25개 3.6MB |
| 2026-11-26 | `npx playwright test --project=webkit-iphone` | 통과 5/5 | 사용자 install-deps 후. chromium도 우회 경로 없이 통과 |
| 2026-11-26 | `npm test` (Phase 1) | 통과 155/155 | Domain 단위 테스트 추가. 오프셋 결함 주입 시 11건 실패 확인 후 복원 |
| 2026-11-26 | `npm test` (Phase 2) | 통과 215/215 | DB 스키마·무결성·revision 트랜잭션·시작 상태 판정. revision 검사 제거 결함 주입 시 2건 실패 확인 후 복원 |
| 2026-11-26 | `npm test`, `npx playwright test --repeat-each=3` (Phase 4) | 통과 240/240, E2E 168/168 | 온보딩·메인·주년·설정·스와이프 E2E(chromium, webkit). 사진 Blob→ArrayBuffer 전환(ARC-B08) 후 WebKit 사진 저장 통과 |
