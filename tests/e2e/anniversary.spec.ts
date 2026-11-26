/**
 * 기념일 화면 E2E (고정 날짜 2026-11-25, 시작일 2026-07-01, 1일 방식, 가상 데이터).
 * 관련: TC-TML-008~015, TC-CUS-001, TC-CUS-009, TC-CUS-016, TC-ANN-010, TC-BTS-004, TC-HOME-008
 */
import { expect, test, type Page } from "@playwright/test";

async function pickDate(page: Page, year: number, month: number, date: string) {
  await page.getByRole("button", { name: /\d{4}년 \d{1,2}월/ }).click();
  await page.getByRole("option", { name: String(year), exact: true }).click();
  await page.getByRole("option", { name: `${month}월`, exact: true }).click();
  await page.getByRole("button", { name: date, exact: true }).click();
}

async function setup(page: Page) {
  await page.clock.setFixedTime(new Date("2026-11-25T10:00:00+09:00"));
  await page.goto("/");
  await page.getByLabel("내 이름").fill("하늘");
  await page.getByLabel("상대방 이름").fill("바다");
  await page.getByRole("button", { name: "처음 사귄 날" }).click();
  await pickDate(page, 2026, 7, "2026-07-01");
  await page.getByRole("button", { name: "선택", exact: true }).click();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page.getByText("TOGETHER")).toBeVisible();
  await page.getByTestId("bottom-navigation").getByRole("button", { name: "기념일" }).click();
  await expect(page.getByRole("heading", { name: "우리의 기념일" })).toBeVisible();
}

async function addAnniversary(page: Page, title: string, date: { year: number; month: number; value: string }, yearly = false) {
  await page.getByRole("button", { name: "기념일 추가" }).click();
  await page.getByLabel("기념일 이름").fill(title);
  await page.getByRole("button", { name: "날짜" }).click();
  await pickDate(page, date.year, date.month, date.value);
  await page.getByRole("button", { name: "선택", exact: true }).click();
  if (yearly) await page.getByRole("radio", { name: "매년 반복" }).click();
  await page.getByRole("button", { name: "추가하기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** 카드 제목이 정확히 일치하는 타임라인 항목 ("다가오는 기념일" 같은 보조 문구와 구분) */
const item = (page: Page, title: string) => page.getByTestId("timeline-item").filter({ has: page.getByText(title, { exact: true }) });

test("필터 순서·기본값, 오늘 구분선, 강조 카드, 지난/다가오는 날 분류 (TML-002~006, ANN-008, ANN-009)", async ({ page }) => {
  await setup(page);
  const filter = page.getByRole("radiogroup", { name: "기념일 필터" });
  await expect(filter.getByRole("radio")).toHaveText(["지난 날", "전체", "다가오는 날"]);
  await expect(filter.getByRole("radio", { name: "전체" })).toHaveAttribute("aria-checked", "true");
  const widths = await filter.getByRole("radio").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  expect(new Set(widths).size).toBe(1);

  await expect(page.getByTestId("today-divider")).toHaveText("오늘 · 148일째");
  await expect(page.getByTestId("today-divider")).toBeInViewport(); // 오늘 근처 자동 스크롤 (TML-007)
  await expect(item(page, "200일")).toHaveAttribute("data-highlighted", "true");
  await expect(page.getByTestId("highlight-dday")).toHaveText("D-52");
  await expect(item(page, "300일")).toContainText("D-152");
  await expect(item(page, "100일")).toHaveAttribute("data-status", "past");

  await filter.getByRole("radio", { name: "지난 날" }).click();
  await expect(page.getByTestId("today-divider")).toHaveCount(0);
  await expect(page.locator("[data-status=upcoming]")).toHaveCount(0);
  await filter.getByRole("radio", { name: "다가오는 날" }).click();
  await expect(page.locator("[data-status=past]")).toHaveCount(0);
});

test("자동 기념일은 수정·삭제할 수 없다 (ANN-010)", async ({ page }) => {
  await setup(page);
  await expect(item(page, "200일").getByRole("button")).toHaveCount(0);
});

test("제목·필터·하단 메뉴는 고정되고 타임라인만 스크롤된다 (TML-008~010)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await setup(page);
  const header = await page.getByRole("heading", { name: "우리의 기념일" }).boundingBox();
  const nav = await page.getByTestId("bottom-navigation").boundingBox();
  await page.getByTestId("timeline-scroll").evaluate((el) => el.scrollTo(0, el.scrollHeight));
  expect(await page.getByRole("heading", { name: "우리의 기념일" }).boundingBox()).toEqual(header);
  expect(await page.getByTestId("bottom-navigation").boundingBox()).toEqual(nav);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
});

test("끝까지 스크롤하면 미래 기념일을 1년 더 불러오며 중복 카드가 없다 (TML-014, ARC-C03)", async ({ page }) => {
  await setup(page);
  await expect(item(page, "2주년")).toHaveCount(0);
  await page.getByTestId("timeline-scroll").evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(item(page, "2주년")).toHaveCount(1);
  const ids = await page.getByTestId("timeline-item").evaluateAll((els) => els.map((e) => e.getAttribute("data-occurrence-id")));
  expect(new Set(ids).size).toBe(ids.length);
});

test("사용자 지정 기념일 추가: 가장 가까우면 강조, 메인 진행률은 그대로 (CUS-001, CUS-008, CUS-010, ARC-C01)", async ({ page }) => {
  await setup(page);
  await addAnniversary(page, "첫 여행", { year: 2026, month: 12, value: "2026-12-01" });
  await expect(item(page, "첫 여행")).toHaveAttribute("data-highlighted", "true");
  await expect(page.getByTestId("highlight-dday")).toHaveText("D-6");
  await page.getByTestId("bottom-navigation").getByRole("button", { name: "메인" }).click();
  await expect(page.locator("svg[data-progress]")).toHaveAttribute("data-progress", "48.00");
});

test("연애 시작일 이전 날짜는 선택할 수 없고, 같은 이름·날짜도 따로 등록된다 (CUS-003, CUS-009)", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "기념일 추가" }).click();
  await page.getByRole("button", { name: "날짜" }).click();
  await page.getByRole("button", { name: /\d{4}년 \d{1,2}월/ }).click();
  await page.getByRole("option", { name: "2026", exact: true }).click();
  await page.getByRole("option", { name: "7월", exact: true }).click();
  await expect(page.getByRole("button", { name: "2026-06-30" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "2026-07-01" })).toBeEnabled();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await addAnniversary(page, "기념", { year: 2026, month: 12, value: "2026-12-10" });
  await addAnniversary(page, "기념", { year: 2026, month: 12, value: "2026-12-10" });
  await expect(item(page, "기념")).toHaveCount(2);
});

test("매년 반복: 해당 연도만 수정·삭제는 그 연도에만 적용된다 (ARC-A02, ARC-A03)", async ({ page }) => {
  await setup(page);
  await addAnniversary(page, "첫 여행", { year: 2026, month: 8, value: "2026-08-15" }, true);
  await expect(item(page, "첫 여행")).toHaveCount(2); // 2026(지남), 2027
  await page.getByRole("button", { name: "첫 여행 2027.08.15 수정" }).click();
  await expect(page.getByRole("radio", { name: "2027년만" })).toHaveAttribute("aria-checked", "true");
  await page.getByLabel("기념일 이름").fill("제주 여행");
  await page.getByRole("button", { name: "저장" }).click();
  // 2027년만 바뀌고 다른 연도(2026, 추가 로딩된 2028)는 그대로
  await expect(page.getByRole("button", { name: "제주 여행 2027.08.15 수정" })).toBeVisible();
  await expect(page.getByRole("button", { name: "첫 여행 2026.08.15 수정" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "첫 여행 2027.08.15 수정" })).toHaveCount(0);

  await page.getByRole("button", { name: "제주 여행 2027.08.15 수정" }).click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByText("2027년 ‘제주 여행’만 삭제할까요?")).toBeVisible();
  await page.getByRole("button", { name: "삭제하기" }).click();
  await expect(item(page, "제주 여행")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "첫 여행 2026.08.15 수정" })).toHaveCount(1);
  await expect(page.locator("[data-occurrence-id$=':2027']")).toHaveCount(0); // tombstone 으로 재생성 없음
});

test("매년 반복 전체 수정은 월·일만 바꾸며 개별 수정 연도는 유지된다 (확정 세칙)", async ({ page }) => {
  await setup(page);
  await addAnniversary(page, "첫 여행", { year: 2026, month: 8, value: "2026-08-15" }, true);
  await page.getByRole("button", { name: "첫 여행 2026.08.15 수정" }).click();
  await page.getByRole("radio", { name: "매년 전체" }).click();
  await page.getByRole("button", { name: "날짜" }).click();
  await expect(page.getByRole("button", { name: "다음 달" })).toBeEnabled();
  await page.getByRole("button", { name: /\d{4}년 \d{1,2}월/ }).click();
  await expect(page.getByRole("option", { name: "2027", exact: true })).toHaveCount(0); // 시작 연도 고정
  await page.getByRole("option", { name: "2026", exact: true }).click();
  await page.getByRole("option", { name: "8월", exact: true }).click();
  await page.getByRole("button", { name: "2026-08-20" }).click();
  await page.getByRole("button", { name: "선택", exact: true }).click();
  await page.getByLabel("기념일 이름").fill("우리 여행");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("button", { name: "우리 여행 2026.08.20 수정" })).toBeVisible();
  await expect(page.getByRole("button", { name: "우리 여행 2027.08.20 수정" })).toBeVisible();
});

test("편집 중 닫으면 변경 취소 확인 후 기존 값 유지 (BTS-014)", async ({ page }) => {
  await setup(page);
  await addAnniversary(page, "기념", { year: 2026, month: 12, value: "2026-12-10" });
  await page.getByRole("button", { name: "기념 2026.12.10 수정" }).click();
  await page.getByLabel("기념일 이름").fill("바뀐 이름");
  await page.keyboard.press("Escape");
  await expect(page.getByText("변경 사항을 취소할까요?")).toBeVisible();
  await page.getByRole("button", { name: "취소하기" }).click();
  await expect(item(page, "기념")).toHaveCount(1);
  await expect(item(page, "바뀐 이름")).toHaveCount(0);
});

test("일회성 기념일 삭제 (CUS-006)", async ({ page }) => {
  await setup(page);
  await addAnniversary(page, "기념", { year: 2026, month: 12, value: "2026-12-10" });
  await page.getByRole("button", { name: "기념 2026.12.10 수정" }).click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByText("‘기념’을 삭제할까요?")).toBeVisible();
  await page.getByRole("button", { name: "삭제하기" }).click();
  await expect(item(page, "기념")).toHaveCount(0);
});
