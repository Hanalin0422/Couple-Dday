/**
 * 온보딩·메인·설정·화면 전환 E2E (고정 날짜 2026-11-25, 가상 데이터).
 * 관련: TC-ONB-001/005/006/009/012/015/016, TC-HOME-016~021, TC-HOME-020, TC-NAV-001/002, TC-SET-003/004/006/009/011,
 *       TC-DATE-014/015/018, TC-CEL-009~012, TC-CEL-014, TC-HOME-022/023
 */
import { expect, test, type Page } from "@playwright/test";

const FX_TODAY = new Date("2026-11-25T10:00:00+09:00");

async function pickDate(page: Page, year: number, month: number, date: string) {
  await page.getByRole("button", { name: /\d{4}년 \d{1,2}월/ }).click();
  await page.getByRole("option", { name: String(year), exact: true }).click();
  await page.getByRole("option", { name: `${month}월`, exact: true }).click();
  await page.getByRole("button", { name: date, exact: true }).click();
}

async function onboard(page: Page, { myName = "하늘", partnerName = "바다", offset = "1일부터" } = {}) {
  await page.goto("/");
  await page.getByLabel("내 이름").fill(myName);
  await page.getByLabel("상대방 이름").fill(partnerName);
  await page.getByRole("button", { name: "처음 사귄 날" }).click();
  await pickDate(page, 2026, 7, "2026-07-01");
  await page.getByRole("button", { name: "선택", exact: true }).click();
  if (offset === "0일부터") await page.getByRole("radio", { name: "0일부터" }).click();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page.getByText("TOGETHER")).toBeVisible();
}

async function swipe(page: Page, dx: number) {
  const { width, height } = page.viewportSize()!;
  const startX = dx < 0 ? width * 0.8 : width * 0.2;
  const y = height * 0.45;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(startX + (dx * i) / 8, y + i);
  await page.mouse.up();
  await page.waitForTimeout(400);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FX_TODAY);
});

test.describe("온보딩", () => {
  test("필수 입력이 유효할 때만 시작하기가 활성화되고, 하단 메뉴가 없다", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /우리의 시간을/ })).toBeVisible();
    await expect(page.getByTestId("bottom-navigation")).toHaveCount(0);
    const start = page.getByRole("button", { name: "시작하기" });
    await expect(start).toBeDisabled();
    await page.getByLabel("내 이름").fill("   ");
    await page.getByLabel("상대방 이름").fill("바다");
    await expect(start).toBeDisabled();
    await page.getByLabel("내 이름").fill("하늘");
    await expect(start).toBeDisabled(); // 날짜 미선택
    await page.getByRole("button", { name: "처음 사귄 날" }).click();
    await expect(page.getByRole("button", { name: "2026-11-26" })).toBeDisabled(); // 미래 비활성
    await expect(page.getByRole("button", { name: "다음 달" })).toBeDisabled(); // 다음 달 이동 차단
    await page.getByRole("button", { name: "2026-11-25" }).click(); // 오늘 선택 가능
    await page.getByRole("button", { name: "선택", exact: true }).click();
    await expect(start).toBeEnabled();
  });

  test("이름은 10자를 넘겨 입력할 수 없다", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("내 이름").fill("가나다라마바사아자차카타");
    await expect(page.getByLabel("내 이름")).toHaveValue("가나다라마바사아자차");
  });

  test("날짜 선택 취소 시 기존 값을 유지한다 (DATE-006)", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "처음 사귄 날" }).click();
    await page.getByRole("button", { name: "2026-11-20" }).click();
    await page.getByRole("button", { name: "취소", exact: true }).click();
    await expect(page.getByRole("button", { name: "처음 사귄 날" })).toContainText("날짜 선택");
  });

  test("입력 중 새로고침하면 임시 저장된 입력을 복구한다 (ONB-012)", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("내 이름").fill("하늘");
    await page.getByRole("radio", { name: "0일부터" }).click();
    await page.waitForTimeout(900);
    await page.reload();
    await expect(page.getByLabel("내 이름")).toHaveValue("하늘");
    await expect(page.getByRole("radio", { name: "0일부터" })).toHaveAttribute("aria-checked", "true");
  });

  test("프로필 사진을 선택하면 미리보기와 메인에 표시된다 (ONB-004)", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("image-file-input").setInputFiles("public/icons/icon-512.png");
    await expect(page.getByRole("button", { name: /나 사진 선택/ }).locator("img")).toBeVisible();
    await page.getByLabel("내 이름").fill("하늘");
    await page.getByLabel("상대방 이름").fill("바다");
    await page.getByRole("button", { name: "처음 사귄 날" }).click();
    await pickDate(page, 2026, 7, "2026-07-01");
    await page.getByRole("button", { name: "선택", exact: true }).click();
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page.getByRole("img", { name: "하늘 프로필" }).locator("img")).toBeVisible();
  });
});

test.describe("메인", () => {
  test("디데이 148, DAYS, 시작일, 진행률 48%, 다음 기념일 미표시", async ({ page }) => {
    await onboard(page);
    await expect(page.getByTestId("dday-number")).toHaveText("148");
    await expect(page.getByText("DAYS", { exact: true })).toBeVisible();
    await expect(page.getByText("2026.07.01")).toBeVisible();
    await expect(page.getByTestId("name-self")).toHaveText("하늘");
    await expect(page.getByTestId("name-partner")).toHaveText("바다");
    await expect(page.locator("svg[data-progress]")).toHaveAttribute("data-progress", "48.00");
    await expect(page.getByText(/D-\d+/)).toHaveCount(0);
    await expect(page.getByText("200일")).toHaveCount(0);
  });

  test("완료 후 재실행하면 온보딩 없이 메인으로 진입한다 (ONB-E09)", async ({ page }) => {
    await onboard(page);
    await page.reload();
    await expect(page.getByTestId("dday-number")).toHaveText("148");
    await expect(page.getByRole("heading", { name: /우리의 시간을/ })).toHaveCount(0);
  });

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    test(`${viewport.width}×${viewport.height}: 문서 스크롤이 없고 원·프로필이 잘리지 않는다 (HOME-012)`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await onboard(page);
      const metrics = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, inner: window.innerHeight }));
      expect(metrics.scroll).toBeLessThanOrEqual(metrics.inner);
      const nav = await page.getByTestId("bottom-navigation").boundingBox();
      for (const locator of [page.locator("[data-circle]"), page.getByTestId("name-self"), page.getByTestId("name-partner")]) {
        const box = await locator.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThanOrEqual(nav!.y + 1);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      }
    });
  }

  test("공통 반응형 기준: 세 화면과 하단 메뉴가 같은 단위로 조절되고, 화면 전환 시 하단 메뉴 크기·위치가 같다", async ({ page }) => {
    await onboard(page);
    const read = () =>
      page.evaluate(() => {
        const box = (el: Element | null) => el!.getBoundingClientRect();
        const nav = document.querySelector("[data-testid=bottom-navigation]")!;
        const navButton = nav.querySelector("button")!;
        const title = document.querySelector("[data-screen] h1:not(.sr-only)");
        const circle = document.querySelector("[data-circle]");
        return {
          u: parseFloat(getComputedStyle(document.querySelector(".app-scale")!).getPropertyValue("--u")),
          nav: { top: Math.round(box(nav).top), height: Math.round(box(nav).height), icon: Math.round(box(navButton.querySelector("svg")).width), buttonH: box(navButton).height, buttonW: box(navButton).width },
          title: title ? parseFloat(getComputedStyle(title).fontSize) : null,
          circle: circle ? box(circle).width : null,
          frame: box(document.querySelector("[data-testid=app-frame]")).width,
          scroll: document.documentElement.scrollHeight > window.innerHeight,
        };
      });
    const goto = async (label: string) => {
      await page.getByTestId("bottom-navigation").getByRole("button", { name: label }).click();
      await page.waitForTimeout(300);
      return read();
    };
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 375, height: 667 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 860, height: 810 },
    ]) {
      await page.setViewportSize(viewport);
      const settings = await goto("설정");
      const home = await goto("메인");
      const anniversary = await goto("기념일");
      const u = home.u;
      // 같은 viewport 에서 하단 메뉴는 화면과 무관하게 동일
      expect(settings.nav).toEqual(home.nav);
      expect(anniversary.nav).toEqual(home.nav);
      // 모든 요소가 같은 공통 단위(--u)의 배수 (최소 크기 보장 포함)
      expect(home.nav.height).toBeCloseTo(Math.max(48, 64 * u), 0);
      expect(home.nav.icon).toBeCloseTo(22 * u, 0);
      expect(home.circle!).toBeCloseTo(272 * u, 0);
      expect(settings.title!).toBeCloseTo(Math.max(20, 28 * u), 1);
      expect(anniversary.title).toBe(settings.title);
      // 터치 영역 최소 44px, 문서 스크롤 없음
      expect(home.nav.buttonH).toBeGreaterThanOrEqual(44);
      expect(home.nav.buttonW).toBeGreaterThanOrEqual(44);
      for (const m of [settings, home, anniversary]) expect(m.scroll).toBe(false);
      expect(home.frame).toBeLessThanOrEqual(480);
    }
    // 시안 기준 기기(390×844)에서는 SKILL.md 크기 그대로
    await page.setViewportSize({ width: 390, height: 844 });
    const settings = await goto("설정");
    const home = await goto("메인");
    expect(home.u).toBe(1);
    expect({ title: settings.title, circle: home.circle, navHeight: home.nav.height, navIcon: home.nav.icon }).toEqual({ title: 28, circle: 272, navHeight: 64, navIcon: 22 });
  });

  test("기기 날짜가 시작일보다 이전이면 음수 대신 안내를 표시한다 (DATE-E05)", async ({ page }) => {
    await onboard(page);
    await page.clock.setFixedTime(new Date("2026-06-20T10:00:00+09:00"));
    await page.reload();
    await expect(page.getByText("기기 날짜를 확인해 주세요").first()).toBeVisible();
    await expect(page.getByTestId("dday-number")).toHaveCount(0);
  });
});

test.describe("자동 주년 당일", () => {
  test("N주년·HAPPY ANNIVERSARY·진행률 100%, DAYS 미표시. 모션 감소 시 자동 재생 없음, 터치 시 재생 (HOME-014/015/020/027)", async ({ page }) => {
    await onboard(page);
    await page.clock.setFixedTime(new Date("2027-07-01T10:00:00+09:00"));
    await page.reload();
    await expect(page.getByTestId("anniversary-label")).toHaveAttribute("aria-label", "1주년");
    await expect(page.getByText("HAPPY ANNIVERSARY")).toBeVisible();
    await expect(page.getByText("DAYS", { exact: true })).toHaveCount(0);
    await expect(page.locator("svg[data-progress]")).toHaveAttribute("data-progress", "100.00");
    await page.waitForTimeout(500);
    await expect(page.getByTestId("celebration-canvas")).toHaveCount(0);
    await page.getByRole("button", { name: /축하 효과 다시 보기/ }).click();
    await expect(page.getByTestId("celebration-canvas")).toHaveCount(1);
  });

  test("다음 날에는 일반 디데이로 복귀한다 (HOME-021)", async ({ page }) => {
    await onboard(page);
    await page.clock.setFixedTime(new Date("2027-07-02T10:00:00+09:00"));
    await page.reload();
    await expect(page.getByTestId("dday-number")).toHaveText("367");
  });

  test.describe("모션 허용 환경", () => {
    test.use({ reducedMotion: "no-preference" });

    test("최초 진입 시 1회 자동 재생, 화면 이동·재실행 후 반복하지 않으며 재생 중에도 하단 메뉴가 동작한다 (HOME-022/023/026)", async ({ page }) => {
      await onboard(page);
      await page.clock.setFixedTime(new Date("2027-07-01T10:00:00+09:00"));
      await page.reload();
      await expect(page.getByTestId("celebration-canvas")).toHaveCount(1);
      await expect(page.getByTestId("celebration-canvas")).toHaveCSS("pointer-events", "none");
      await page.getByRole("button", { name: "설정" }).click();
      await expect(page.getByRole("heading", { name: "설정", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "메인" }).click();
      await page.waitForTimeout(500);
      await expect(page.getByTestId("celebration-canvas")).toHaveCount(0);
      await page.reload();
      await page.waitForTimeout(500);
      await expect(page.getByTestId("celebration-canvas")).toHaveCount(0);
    });
  });
});

test.describe("100일 단위 자동 기념일 당일 (HOME-033)", () => {
  test("일반 디데이 표시를 유지하고, 모션 감소 시 자동 재생 없이 원 터치로 꽃가루 재생", async ({ page }) => {
    await onboard(page);
    await page.clock.setFixedTime(new Date("2026-10-08T10:00:00+09:00")); // 1일 방식 100일
    await page.reload();
    await expect(page.getByTestId("dday-number")).toHaveText("100");
    await expect(page.getByText("DAYS", { exact: true })).toBeVisible();
    await expect(page.getByTestId("anniversary-label")).toHaveCount(0);
    await page.waitForTimeout(500);
    await expect(page.getByTestId("celebration-canvas")).toHaveCount(0);
    await page.getByRole("button", { name: /축하 효과 다시 보기/ }).click();
    await expect(page.getByTestId("celebration-canvas")).toHaveCount(1);
  });

  test("50일 등 100일 단위가 아닌 자동 기념일에는 꽃가루와 재생 버튼이 없다 (HOME-028)", async ({ page }) => {
    await onboard(page);
    await page.clock.setFixedTime(new Date("2026-08-19T10:00:00+09:00")); // 50일
    await page.reload();
    await expect(page.getByTestId("dday-number")).toHaveText("50");
    await expect(page.getByRole("button", { name: /축하 효과 다시 보기/ })).toHaveCount(0);
    await expect(page.getByTestId("celebration-canvas")).toHaveCount(0);
  });

  test.describe("모션 허용 환경", () => {
    test.use({ reducedMotion: "no-preference" });

    test("200일 당일 최초 진입 시 1회 자동 재생, 재실행 후 반복하지 않는다", async ({ page }) => {
      await onboard(page);
      await page.clock.setFixedTime(new Date("2027-01-16T10:00:00+09:00")); // 200일
      await page.reload();
      await expect(page.getByTestId("dday-number")).toHaveText("200");
      await expect(page.getByTestId("celebration-canvas")).toHaveCount(1);
      await page.reload();
      await page.waitForTimeout(500);
      await expect(page.getByTestId("celebration-canvas")).toHaveCount(0);
    });
  });
});

test.describe("화면 전환", () => {
  test("하단 메뉴 순서 설정/메인/기념일, 가운데 하트는 텍스트 없음 (NAV-001, HOME-013)", async ({ page }) => {
    await onboard(page);
    const nav = page.getByTestId("bottom-navigation");
    await expect(nav.getByRole("button")).toHaveText(["설정", "", "기념일"]);
    await expect(nav.getByRole("button", { name: "메인" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("button", { name: "기념일" }).click();
    await expect(page.getByRole("heading", { name: "우리의 기념일" })).toBeVisible();
  });

  test("좌우 스와이프로 이동하고 양 끝에서는 멈춘다 (NAV-002, NAV-003, ARC-C04)", async ({ page }) => {
    await onboard(page);
    await swipe(page, -160); // 메인 → 기념일
    await expect(page.getByRole("heading", { name: "우리의 기념일" })).toBeVisible();
    await swipe(page, -160); // 끝: 이동 없음
    await expect(page.getByRole("heading", { name: "우리의 기념일" })).toBeVisible();
    await swipe(page, 160); // 기념일 → 메인
    await expect(page.getByText("TOGETHER")).toBeVisible();
    await swipe(page, 160); // 메인 → 설정
    await expect(page.getByRole("heading", { name: "설정", exact: true })).toBeVisible();
    await swipe(page, 160); // 끝: 이동 없음
    await expect(page.getByRole("heading", { name: "설정", exact: true })).toBeVisible();
    await swipe(page, -30); // 임계값 미만
    await expect(page.getByRole("heading", { name: "설정", exact: true })).toBeVisible();
  });
});

test.describe("설정", () => {
  test("카드 순서와 데이터 관리 메뉴가 유지된다", async ({ page }) => {
    await onboard(page);
    await page.getByRole("button", { name: "설정" }).click();
    const titles = page.locator("main, [data-screen=settings]").getByRole("heading", { level: 2 });
    await expect(titles).toHaveText(["디데이 설정", "화면 꾸미기", "데이터 관리"]);
    await expect(page.getByRole("button", { name: "데이터 백업" })).toBeVisible();
    await expect(page.getByRole("button", { name: "데이터 복원" })).toBeVisible();
    await expect(page.getByRole("button", { name: "데이터 초기화" })).toBeVisible();
    await expect(page.getByText("Dusty Rose")).toBeVisible();
  });

  test("이름 변경은 저장 후 메인에 즉시 반영된다 (SET-001, HOME-010)", async ({ page }) => {
    await onboard(page);
    await page.getByRole("button", { name: "설정" }).click();
    await page.getByRole("button", { name: /^내 이름/ }).click();
    const input = page.getByRole("dialog").getByRole("textbox");
    await input.fill("하늘빛");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "메인" }).click();
    await expect(page.getByTestId("name-self")).toHaveText("하늘빛");
  });

  test("변경 후 닫으면 취소 확인을 묻고, 취소하면 기존 값을 유지한다 (BTS-014, SET-E01)", async ({ page }) => {
    await onboard(page);
    await page.getByRole("button", { name: "설정" }).click();
    await page.getByRole("button", { name: /^상대방 이름/ }).click();
    await page.getByRole("dialog").getByRole("textbox").fill("다른이름");
    await page.getByRole("button", { name: "취소", exact: true }).click();
    await expect(page.getByText("변경 사항을 취소할까요?")).toBeVisible();
    await page.getByRole("button", { name: "취소하기" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^상대방 이름/ })).toContainText("바다");
  });

  test("계산 방식 변경은 확인 후 저장되고 디데이가 재계산된다 (SET-006, SET-014)", async ({ page }) => {
    await onboard(page);
    await page.getByRole("button", { name: "설정" }).click();
    await page.getByRole("radio", { name: "0일부터" }).click();
    await expect(page.getByText("처음 사귄 날을 0일로 계산할까요?")).toBeVisible();
    await expect(page.getByRole("radio", { name: "1일부터" })).toHaveAttribute("aria-checked", "true"); // 확인 전 미반영
    await page.getByRole("button", { name: "변경하기" }).click();
    await expect(page.getByText("처음 사귄 날을 0일로 계산해요.")).toBeVisible();
    await page.getByRole("button", { name: "메인" }).click();
    await expect(page.getByTestId("dday-number")).toHaveText("147");
  });

  test("연애 시작일 변경: 오늘까지만 선택, 확인 후 저장 (SET-005, SET-014)", async ({ page }) => {
    await onboard(page);
    await page.getByRole("button", { name: "설정" }).click();
    await page.getByRole("button", { name: /^연애 시작일/ }).click();
    await page.getByRole("button", { name: "다음 달" }).click(); // 7월 → 8월
    await page.getByRole("button", { name: "2026-08-01" }).click();
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await expect(page.getByText("연애 시작일을 2026.08.01로 바꿀까요?")).toBeVisible();
    await page.getByRole("button", { name: "변경하기" }).click();
    await expect(page.getByRole("button", { name: /^연애 시작일/ })).toContainText("2026.08.01");
    await page.getByRole("button", { name: "메인" }).click();
    await expect(page.getByTestId("dday-number")).toHaveText("117");
  });

  test("설정 콘텐츠만 스크롤되고 하단 메뉴는 고정된다 (SET-012)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await onboard(page);
    await page.getByRole("button", { name: "설정" }).click();
    const navBefore = await page.getByTestId("bottom-navigation").boundingBox();
    await page.getByTestId("settings-scroll").evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(page.getByRole("button", { name: "데이터 초기화" })).toBeInViewport();
    expect(await page.getByTestId("bottom-navigation").boundingBox()).toEqual(navBefore);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});
