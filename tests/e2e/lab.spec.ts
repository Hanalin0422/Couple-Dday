/**
 * [LAB] 실기기 렌더링 비교 환경(/lab) 검증. 실기기 비교가 끝나면 src/lab/README.md 에 따라 이 파일과 함께 제거한다.
 * - 일반 앱에는 계측 코드·훅이 동작하지 않는다
 * - 테스트 데이터는 별도 DB(couple-dday-lab)를 쓰고 사용자 DB(couple-dday)는 바뀌지 않는다
 * - 모드 전환·HUD 켜기/끄기·버전 표시·숨은 진입·앱 복귀
 */
import { expect, test, type Page } from "@playwright/test";

async function pickDate(page: Page, year: number, month: number, date: string) {
  await page.getByRole("button", { name: /\d{4}년 \d{1,2}월/ }).click();
  await page.getByRole("option", { name: String(year), exact: true }).click();
  await page.getByRole("option", { name: `${month}월`, exact: true }).click();
  await page.getByRole("button", { name: date, exact: true }).click();
}

/** 사용자 데이터(가상): 이름이 테스트 데이터(하늘·바다)와 다르게 */
async function onboardUser(page: Page) {
  await page.goto("/");
  await page.getByLabel("내 이름").fill("민수");
  await page.getByLabel("상대방 이름").fill("지영");
  await page.getByRole("button", { name: "처음 사귄 날" }).click();
  await pickDate(page, 2026, 7, "2026-07-01");
  await page.getByRole("button", { name: "선택", exact: true }).click();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page.getByTestId("name-self")).toHaveText("민수");
}

/** 사용자 DB 내용 요약(읽기 전용) */
const userDbSummary = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const request = indexedDB.open("couple-dday");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(["couple", "settings", "photos", "memories"], "readonly");
          const out: Record<string, unknown> = {};
          let pending = 4;
          const done = () => --pending === 0 && (db.close(), resolve(out));
          const c = tx.objectStore("couple").get("default");
          c.onsuccess = () => ((out.couple = c.result), done());
          const s = tx.objectStore("settings").get("default");
          s.onsuccess = () => ((out.settings = s.result), done());
          const p = tx.objectStore("photos").count();
          p.onsuccess = () => ((out.photos = p.result), done());
          const m = tx.objectStore("memories").count();
          m.onsuccess = () => ((out.memories = m.result), done());
        };
      }),
  );

/** 앱 DB 이름만(Service Worker 캐시 만료 DB 등 제외) */
const dbNames = (page: Page) => page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name ?? "").filter((n) => n.startsWith("couple-dday")).sort());
const panel = (page: Page) => page.getByTestId("lab-panel");

test.describe("LAB 실기기 비교 환경", () => {
  test.use({ reducedMotion: "no-preference" });
  test.setTimeout(90_000);

  test("일반 앱에는 계측 훅·코드가 동작하지 않는다", async ({ page }) => {
    await onboardUser(page);
    const state = await page.evaluate(() => ({
      hook: typeof (window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown }).__REACT_DEVTOOLS_GLOBAL_HOOK__,
      commits: typeof (window as unknown as { __labCommits?: unknown }).__labCommits,
    }));
    expect(state).toEqual({ hook: "undefined", commits: "undefined" });
    await expect(page.getByTestId("lab-hud")).toHaveCount(0);
    await expect(page.getByTestId("lab-panel")).toHaveCount(0);
  });

  test("테스트 데이터는 별도 DB 를 쓰고, LAB 사용 전후 사용자 데이터가 같다", async ({ page }) => {
    await onboardUser(page);
    const before = await userDbSummary(page);
    await page.goto("/lab");
    await expect(page.locator("[data-lab-mode=a]")).toBeVisible();
    await expect(page.locator("[data-screen=home]").getByTestId("name-self")).toHaveText("하늘", { timeout: 60_000 });
    expect(await dbNames(page)).toEqual(["couple-dday", "couple-dday-lab"]);
    expect(await page.evaluate(() => typeof (window as unknown as { __labCommits?: number }).__labCommits)).toBe("number");
    // 모드 A 에서 화면 전환
    await page.getByTestId("bottom-navigation").getByRole("button", { name: "기념일" }).click();
    await expect(page.getByRole("heading", { name: "우리의 기념일" })).toBeVisible();
    // 앱으로 돌아가기
    await panel(page).getByRole("button", { name: /^LAB/ }).click();
    await panel(page).getByRole("button", { name: "앱으로 돌아가기" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("name-self")).toHaveText("민수");
    expect(await userDbSummary(page)).toEqual(before);
    expect(await page.evaluate(() => typeof (window as unknown as { __labCommits?: unknown }).__labCommits)).toBe("undefined");
  });

  test("모드 전환·HUD 켜기/끄기·버전 표시", async ({ page }) => {
    await page.goto("/lab?mode=c");
    await expect(page.locator("[data-lab-mode=c]")).toBeVisible();
    await expect(page.getByTestId("lab-hud")).toBeVisible();
    await panel(page).getByRole("button", { name: /^LAB C/ }).click();
    await expect(panel(page)).toContainText(/v\d+\.\d+\.\d+ · \w+/);
    await expect(panel(page)).toContainText("commit 계측 활성");
    await panel(page).getByRole("button", { name: "HUD 끄기" }).click();
    await expect(page.getByTestId("lab-hud")).toHaveCount(0);
    await page.reload();
    await expect(page.locator("[data-lab-mode=c]")).toBeVisible();
    await expect(page.getByTestId("lab-hud")).toHaveCount(0); // 설정 유지
    await panel(page).getByRole("button", { name: /^LAB/ }).click();
    await panel(page).getByRole("button", { name: "HUD 켜기" }).click();
    await expect(page.getByTestId("lab-hud")).toBeVisible();
    // 하단 메뉴 전환 → HUD 기록(커밋 수 포함)
    await page.getByTestId("bottom-navigation").getByRole("button", { name: "설정" }).click();
    await expect(page.getByTestId("lab-hud")).toContainText("마지막 메뉴", { timeout: 5000 });
    await expect(page.getByTestId("lab-hud")).toContainText(/commit 이동중 \d+ · 뗀후 [1-9]/);
    // B 로 전환 (패널은 열려 있음)
    await panel(page).getByRole("button", { name: "B", exact: true }).click();
    await expect(page).toHaveURL(/mode=b/);
    await expect(page.locator("[data-screen=home]").getByTestId("name-self")).toHaveText("하늘", { timeout: 60_000 });
  });

  test("모드 B 는 화면 전환 중 IndexedDB 를 조회하지 않는다", async ({ page }) => {
    await page.goto("/lab?mode=b");
    await expect(page.locator("[data-screen=home]").getByTestId("name-self")).toHaveText("하늘", { timeout: 60_000 });
    await page.getByTestId("bottom-navigation").getByRole("button", { name: "기념일" }).click();
    await expect(page.getByTestId("lab-hud")).toContainText("마지막 메뉴", { timeout: 5000 });
    await expect(page.getByTestId("lab-hud")).toContainText("DB 0 ·");
  });

  test("설정 제목 7번 탭으로 LAB 에 들어가고, 테스트 데이터 삭제 후 앱으로 돌아온다", async ({ page }) => {
    await onboardUser(page);
    await page.getByTestId("bottom-navigation").getByRole("button", { name: "설정" }).click();
    const title = page.getByRole("heading", { name: "설정", exact: true });
    for (let i = 0; i < 6; i++) await title.click();
    await expect(page).not.toHaveURL(/\/lab/); // 6번까지는 이동하지 않음
    await title.click();
    await expect(page).toHaveURL(/\/lab$/);
    await expect(page.locator("[data-screen=home]").getByTestId("name-self")).toHaveText("하늘", { timeout: 60_000 });
    await panel(page).getByRole("button", { name: /^LAB/ }).click();
    await panel(page).getByRole("button", { name: "테스트 데이터 삭제하고 앱으로" }).click();
    await expect(page.getByTestId("name-self")).toHaveText("민수");
    expect(await dbNames(page)).toEqual(["couple-dday"]);
  });
});
