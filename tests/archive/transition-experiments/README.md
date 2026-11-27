# 화면 전환 실험 테스트 보관 (미적용)

2026-11-27 사용자 결정(A안)으로 `src/components/layout/AppShell.tsx` 를 커밋 `8ff2ead` 의 최초 화면 전환 구조
(현재 화면 1개만 렌더링, 전환 시 재마운트, Motion 드래그 + 16% 슬라이드·opacity 인)로 복구했다.
아래 테스트는 이후 실험 구조를 전제로 작성되어 현재 구조에는 적용하지 않는다. Playwright `testDir`(tests/e2e)·perf 설정(tests/perf) 밖에 두어 실행되지 않는다.

| 파일 | 출처 커밋 | 전제한 구조 | 미적용 사유 |
|---|---|---|---|
| `e2e/navigation.spec.ts` | `fed928f`, `21ebd49` | 세 화면 상시 유지(가로 트랙 / CSS Scroll Snap), `[data-active]`, 화면별 스크롤 유지, 손가락 1:1 추적, 스냅 | 현재는 화면을 전환마다 다시 만들고 손가락을 일부만 따라오므로 검증 대상 동작이 존재하지 않음 |
| `e2e/support/swipe.ts` | `21ebd49` | 가로 스크롤 컨테이너(CDP 터치 / `scrollBy`) | 현재 스와이프는 Motion 포인터 드래그이며 기존 테스트는 마우스 드래그를 사용 |
| `perf/touch.perf.ts` | `21ebd49` | 메인 패널이 DOM 에 남아 손가락을 따라 이동 | 현재는 전환 시 메인이 언마운트되어 측정 지점이 없음 |

재사용: 화면 전환 구조를 다시 바꾸게 되면 해당 구조에 맞는지 검토 후 `tests/e2e`, `tests/perf` 로 옮겨 사용한다.
