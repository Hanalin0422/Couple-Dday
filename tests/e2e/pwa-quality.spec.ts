/**
 * PWA·품질 E2E: 오프라인 실행, 자정 경과, 여러 탭, 외부 요청 없음, 입력 HTML 미실행, 터치 영역.
 * 관련: TC-PWA-005, TC-CEL-017, TC-DATE-017, TC-HOME-024, TC-DB-011, TC-DB-012, TC-SYS-002, TC-NFR-002, TC-NFR-003, TC-PWA-009
 */
import { expect, test, type Page } from "@playwright/test";

async function pickDate(page: Page, year: number, month: number, date: string) {
  await page.getByRole("button", { name: /\d{4}년 \d{1,2}월/ }).click();
  await page.getByRole("option", { name: String(year), exact: true }).click();
  await page.getByRole("option", { name: `${month}월`, exact: true }).click();
  await page.getByRole("button", { name: date, exact: true }).click();
}

async function onboard(page: Page, { myName = "하늘", setClock = true } = {}) {
  if (setClock) await page.clock.setFixedTime(new Date("2026-11-25T10:00:00+09:00"));
  await page.goto("/");
  await page.getByLabel("내 이름").fill(myName);
  await page.getByLabel("상대방 이름").fill("바다");
  await page.getByRole("button", { name: "처음 사귄 날" }).click();
  await pickDate(page, 2026, 7, "2026-07-01");
  await page.getByRole("button", { name: "선택", exact: true }).click();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page.getByText("TOGETHER")).toBeVisible();
}

const nav = (page: Page, label: string) => page.getByTestId("bottom-navigation").getByRole("button", { name: label }).click();

test.describe("오프라인 (Service Worker)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("캐싱 후 오프라인에서도 앱 셸·로컬 폰트·데이터·주년 축하 효과가 동작한다 (SYS-005, PWA-003, PWA-004, PWA-014, HOME-030)", async ({ page, context, browserName }) => {
    test.skip(browserName === "webkit", "Playwright WebKit(Linux)은 Service Worker 오프라인 제어를 지원하지 않아 Chromium 과 실기기에서 검증한다.");
    await onboard(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload(); // 다음 실행부터 SW 가 페이지를 제어한다(skipWaiting/clientsClaim 미사용)
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId("dday-number")).toHaveText("148");
    await expect(page.getByTestId("name-self")).toHaveText("하늘");
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return Promise.all(["600 28px MaruBuri", "500 16px Pretendard", "italic 500 88px 'Cormorant Garamond'"].map(async (f) => (await document.fonts.load(f)).length > 0));
    });
    expect(fonts).toEqual([true, true, true]);
    await nav(page, "설정");
    await expect(page.getByRole("heading", { name: "설정", exact: true })).toBeVisible();

    // 오프라인 상태의 자동 주년 (HOME-E27)
    await page.clock.setFixedTime(new Date("2027-07-01T10:00:00+09:00"));
    await page.reload();
    await expect(page.getByTestId("anniversary-label")).toHaveAttribute("aria-label", "1주년");
    await expect(page.getByTestId("celebration-canvas")).toHaveCount(1);
    await context.setOffline(false);
  });
});

test("앱이 켜진 채 자정이 지나면 디데이가 갱신된다 (DATE-E03, PWA-009, HOME-009)", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-25T23:58:00+09:00") });
  await onboard(page, { setClock: false });
  await expect(page.getByTestId("dday-number")).toHaveText("148");
  await page.clock.fastForward("03:00");
  await expect(page.getByTestId("dday-number")).toHaveText("149");
});

test("주년 당일 자정이 지나면 일반 디데이로 복귀한다 (HOME-E18)", async ({ page }) => {
  await page.clock.install({ time: new Date("2027-07-01T23:58:00+09:00") });
  await onboard(page, { setClock: false });
  await expect(page.getByTestId("anniversary-label")).toHaveAttribute("aria-label", "1주년");
  await page.clock.fastForward("03:00");
  await expect(page.getByTestId("dday-number")).toHaveText("367");
  await expect(page.getByTestId("anniversary-label")).toHaveCount(0);
});

test("여러 탭: 한 탭의 변경이 다른 탭에 반영되고, 오래된 화면의 저장은 충돌로 거부된다 (PWA-E05, DB-015)", async ({ page, context }) => {
  await onboard(page);
  const second = await context.newPage();
  await second.clock.setFixedTime(new Date("2026-11-25T10:00:00+09:00"));
  await second.goto("/");
  await expect(second.getByTestId("name-self")).toHaveText("하늘");

  // 첫 탭에서 편집 화면을 먼저 열어 둔다(오래된 revision)
  await nav(page, "설정");
  await page.getByRole("button", { name: /^상대방 이름/ }).click();

  // 두 번째 탭에서 이름 변경
  await nav(second, "설정");
  await second.getByRole("button", { name: /^내 이름/ }).click();
  await second.getByRole("dialog").getByRole("textbox").fill("하늘빛");
  await second.getByRole("button", { name: "저장" }).click();
  await expect(second.getByRole("dialog")).toHaveCount(0);

  // 첫 탭: 커밋된 데이터가 실시간 반영(useLiveQuery), 오래된 편집 저장은 거부
  await expect(page.getByRole("button", { name: /^내 이름/ })).toContainText("하늘빛");
  await page.getByRole("dialog").getByRole("textbox").fill("바다별");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("다른 곳에서 정보가 바뀌었어요.", { exact: false })).toBeVisible();
  await expect(second.getByRole("button", { name: /^상대방 이름/ })).toContainText("바다");
  await second.close();
});

test("앱 사용 중 외부 서버로 요청을 보내지 않는다 (SYS-004, NFR-003, NFR-004)", async ({ page }) => {
  const origins = new Set<string>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "http:" || url.protocol === "https:") origins.add(url.origin);
  });
  await onboard(page);
  await nav(page, "기념일");
  await page.getByRole("button", { name: "100일 추억 사진 추가" }).click();
  await page.getByTestId("memory-file-input").setInputFiles("tests/fixtures/photos/photo-1.jpg");
  await page.getByRole("dialog").getByRole("button", { name: "사진 1, 대표 사진" }).waitFor();
  await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
  await nav(page, "설정");
  await page.getByRole("button", { name: /^데이터 백업/ }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("dialog").getByRole("button", { name: "백업 파일 만들기" }).click();
  await download;
  expect([...origins]).toEqual([new URL(page.url()).origin]);
});

test("이름·메모에 입력한 HTML 은 실행되지 않고 글자 그대로 표시된다 (NFR-005)", async ({ page }) => {
  await onboard(page, { myName: "<b>하늘</b>" });
  await expect(page.getByTestId("name-self")).toHaveText("<b>하늘</b>");
  await nav(page, "기념일");
  await page.getByRole("button", { name: "50일 추억 사진 추가" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "메모만 남기기" }).click();
  const payload = '<img src=x onerror="window.__xss=1">';
  await page.getByRole("dialog").getByLabel("메모").fill(payload);
  await page.getByRole("dialog").getByRole("button", { name: "메모 저장" }).click();
  await expect(page.getByText(payload)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  expect(await page.locator("main img[src='x']").count()).toBe(0);
});

test("주요 화면의 터치 영역은 44×44px 이상이다 (NFR-008)", async ({ page }) => {
  const tooSmall = async () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("button, [role=radio], input:not([type=file]), textarea")]
        .filter((el) => el.offsetParent !== null && !el.closest("[aria-hidden=true]"))
        .map((el) => ({ label: el.getAttribute("aria-label") ?? el.textContent?.trim() ?? el.tagName, ...el.getBoundingClientRect().toJSON() }))
        .filter((r) => r.height < 44 - 0.5 || r.width < 44 - 0.5)
        .map((r) => `${r.label} ${Math.round(r.width)}×${Math.round(r.height)}`),
    );
  await page.clock.setFixedTime(new Date("2026-11-25T10:00:00+09:00"));
  await page.goto("/");
  await expect(page.getByLabel("내 이름")).toBeVisible();
  expect(await tooSmall(), "온보딩").toEqual([]);
  await onboard(page);
  for (const screen of ["메인", "설정", "기념일"]) {
    await nav(page, screen);
    await page.waitForTimeout(300);
    expect(await tooSmall(), screen).toEqual([]);
  }
});

test("저장소 지속성 요청이 앱 동작을 방해하지 않는다 (NFR-014)", async ({ page }) => {
  await onboard(page);
  const result = await page.evaluate(async () => (navigator.storage?.persisted ? typeof (await navigator.storage.persisted()) : "unsupported"));
  expect(["boolean", "unsupported"]).toContain(result);
  await expect(page.getByTestId("dday-number")).toHaveText("148");
});
