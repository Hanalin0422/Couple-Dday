/**
 * 데이터 백업·복원·초기화 E2E (고정 날짜 2026-11-25, 가상 데이터).
 * 관련: TC-BAK-001, TC-BAK-005, TC-BAK-007, TC-RES-001, TC-RES-009, TC-RES-010, TC-RST-003, TC-RST-004, TC-SET-012, TC-ONB-013, TC-ONB-014
 */
import { expect, test, type Browser, type Page } from "@playwright/test";

const FIXED = new Date("2026-11-25T10:00:00+09:00");

async function pickDate(page: Page, year: number, month: number, date: string) {
  await page.getByRole("button", { name: /\d{4}년 \d{1,2}월/ }).click();
  await page.getByRole("option", { name: String(year), exact: true }).click();
  await page.getByRole("option", { name: `${month}월`, exact: true }).click();
  await page.getByRole("button", { name: date, exact: true }).click();
}

async function onboard(page: Page) {
  await page.clock.setFixedTime(FIXED);
  await page.goto("/");
  await page.getByLabel("내 이름").fill("하늘");
  await page.getByLabel("상대방 이름").fill("바다");
  await page.getByRole("button", { name: "처음 사귄 날" }).click();
  await pickDate(page, 2026, 7, "2026-07-01");
  await page.getByRole("button", { name: "선택", exact: true }).click();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page.getByText("TOGETHER")).toBeVisible();
}

const nav = (page: Page, label: string) => page.getByTestId("bottom-navigation").getByRole("button", { name: label }).click();
const dialog = (page: Page) => page.getByRole("dialog");

/** 추억 사진 1장 + 사용자 지정 기념일 1개를 만든다 */
async function addData(page: Page) {
  await nav(page, "기념일");
  await page.getByTestId("timeline-item").filter({ has: page.getByText("100일", { exact: true }) }).getByRole("button", { name: "100일 추억 사진 추가" }).click();
  await page.getByTestId("memory-file-input").setInputFiles("tests/fixtures/photos/photo-1.jpg");
  await dialog(page).getByRole("button", { name: "사진 1, 대표 사진" }).waitFor();
  await dialog(page).getByLabel("메모").fill("가상의 백업 메모");
  await dialog(page).getByRole("button", { name: "저장", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
}

async function backup(page: Page): Promise<string> {
  await nav(page, "설정");
  await page.getByRole("button", { name: /^데이터 백업/ }).click();
  const d = dialog(page);
  await expect(d.getByText("암호화되지 않으며")).toBeVisible(); // BAK-011
  const download = page.waitForEvent("download");
  await d.getByRole("button", { name: "백업 파일 만들기" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^couple-dday-backup-20261125-\d{6}\.zip$/);
  await expect(d.getByText("백업 파일 다운로드를 시작했어요.", { exact: false })).toBeVisible();
  await d.getByRole("button", { name: "확인" }).click();
  return (await file.path())!;
}

async function freshPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ locale: "ko-KR", timezoneId: "Asia/Seoul", reducedMotion: "reduce", baseURL: test.info().project.use.baseURL });
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED);
  return page;
}

test("백업 파일을 만들고 마지막 백업 일시를 표시한다 (BAK-001, BAK-011, BAK-012, SET-013)", async ({ page }) => {
  await onboard(page);
  await nav(page, "설정");
  await page.getByRole("button", { name: /^데이터 백업/ }).click();
  await expect(dialog(page).getByTestId("last-backup")).toHaveText("아직 백업한 적이 없어요.");
  await page.keyboard.press("Escape");
  await backup(page);
  await expect(page.getByRole("button", { name: /^데이터 백업/ })).toContainText("2026.11.25");
  await page.getByRole("button", { name: /^데이터 백업/ }).click();
  await expect(dialog(page).getByTestId("last-backup")).toHaveText("마지막 백업: 2026.11.25 10:00");
});

test("다른 기기(새 세션)의 온보딩에서 백업을 복원하면 메인으로 이동하고 데이터가 같다 (RES-001, RES-007, RES-008, ONB-010)", async ({ page, browser }) => {
  await onboard(page);
  await addData(page);
  const file = await backup(page);

  const other = await freshPage(browser);
  await other.goto("/");
  await other.getByLabel("내 이름").fill("임시");
  await other.getByRole("button", { name: "기존 데이터 복원하기" }).click();
  await other.getByTestId("restore-file-input").setInputFiles(file);
  await expect(dialog(other).getByTestId("restore-summary")).toContainText("하늘 · 바다");
  await expect(dialog(other).getByTestId("restore-summary")).toContainText("사진 1장");
  await expect(dialog(other).getByRole("button", { name: "현재 데이터 먼저 백업하기" })).toHaveCount(0);
  await dialog(other).getByRole("button", { name: "복원하기" }).click();
  await expect(other.getByText("TOGETHER")).toBeVisible();
  await expect(other.getByTestId("name-self")).toHaveText("하늘");
  await expect(other.getByTestId("dday-number")).toHaveText("148");
  await nav(other, "기념일");
  await expect(other.getByTestId("timeline-item").filter({ has: other.getByText("100일", { exact: true }) }).getByText("가상의 백업 메모")).toBeVisible();
  await nav(other, "설정");
  await expect(other.getByRole("button", { name: /^데이터 백업/ })).toContainText("2026.11.25"); // ARC-D01: 백업 생성 일시
  await other.reload();
  await expect(other.getByTestId("name-self")).toHaveText("하늘"); // 온보딩으로 돌아가지 않음
  await other.context().close();
});

test("설정에서 복원하면 확인 후 기존 데이터를 백업 데이터로 바꾼다 (RES-004, RES-005, RES-008)", async ({ page }) => {
  await onboard(page);
  const file = await backup(page);
  await page.getByRole("button", { name: /^내 이름/ }).click();
  await dialog(page).getByRole("textbox").fill("바뀐이름");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("button", { name: /^내 이름/ })).toContainText("바뀐이름");

  await page.getByRole("button", { name: /^데이터 복원/ }).click();
  await page.getByTestId("restore-file-input").setInputFiles(file);
  await expect(dialog(page).getByText("지금 데이터는 모두 백업 데이터로 바뀌고 되돌릴 수 없어요.", { exact: false })).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "현재 데이터 먼저 백업하기" })).toBeVisible(); // 백업 권장(선택)
  await dialog(page).getByRole("button", { name: "복원하기" }).click();
  await expect(page.getByText("TOGETHER")).toBeVisible(); // 메인으로 이동
  await expect(page.getByTestId("name-self")).toHaveText("하늘");
});

test("잘못된 파일은 복원하지 않고 기존 데이터를 유지한다 (RES-E01, RES-006)", async ({ page }) => {
  await onboard(page);
  await nav(page, "설정");
  await page.getByRole("button", { name: /^데이터 복원/ }).click();
  await page.getByTestId("restore-file-input").setInputFiles({ name: "fake-backup.zip", mimeType: "application/zip", buffer: Buffer.from("not a real zip") });
  await expect(dialog(page).getByText("백업 파일을 읽을 수 없어요.", { exact: false })).toBeVisible();
  await expect(dialog(page).getByText("지금 데이터는 그대로예요.", { exact: false })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^내 이름/ })).toContainText("하늘");
});

test("데이터 초기화: 확인 후 모두 삭제하고 온보딩으로 이동, 재실행해도 온보딩 (RST-001~008)", async ({ page }) => {
  await onboard(page);
  await addData(page);
  await nav(page, "설정");
  await page.getByRole("button", { name: /^데이터 초기화/ }).click();
  const d = dialog(page);
  await expect(d.getByText("되돌릴 수 없어요", { exact: false })).toBeVisible();
  await expect(d.getByRole("button", { name: "먼저 백업하기" })).toBeVisible(); // RST-007 백업 안내(선택)
  await d.getByRole("button", { name: "초기화하기" }).click();
  await expect(page.getByRole("heading", { name: /우리의 시간을/ })).toBeVisible();
  await expect(page.getByTestId("bottom-navigation")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: /우리의 시간을/ })).toBeVisible();
  await expect(page.getByLabel("내 이름")).toHaveValue("");
});

test("초기화를 취소하면 아무것도 바뀌지 않는다 (RST-007)", async ({ page }) => {
  await onboard(page);
  await nav(page, "설정");
  await page.getByRole("button", { name: /^데이터 초기화/ }).click();
  await dialog(page).getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByRole("button", { name: /^내 이름/ })).toContainText("하늘");
});
