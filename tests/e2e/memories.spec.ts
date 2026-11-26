/**
 * 추억 사진·메모 E2E — "저장" 한 번으로 반영하는 흐름 (고정 날짜 2026-11-25, 시작일 2026-07-01, 가상 사진).
 * 관련: TC-MEM-001~022, TC-MEM-025, TC-TML-011, TC-TML-012
 */
import { expect, test, type Page } from "@playwright/test";

const PHOTOS = "tests/fixtures/photos";

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
  await gotoAnniversary(page);
}

async function gotoAnniversary(page: Page) {
  await page.getByTestId("bottom-navigation").getByRole("button", { name: "기념일" }).click();
}

const card = (page: Page, title: string) => page.getByTestId("timeline-item").filter({ has: page.getByText(title, { exact: true }) });
const dialog = (page: Page) => page.getByRole("dialog");
const thumbs = (page: Page) => dialog(page).getByRole("button", { name: /^사진 \d/ });

async function openMemory(page: Page, title: string) {
  await card(page, title).getByRole("button", { name: new RegExp(`^${title} (추억 사진 추가|추억 보기)$`) }).click();
  await expect(dialog(page)).toBeVisible();
}

async function pick(page: Page, files: string[]) {
  await page.getByTestId("memory-file-input").setInputFiles(files.map((f) => `${PHOTOS}/${f}`));
}

async function saveAndClose(page: Page) {
  await dialog(page).getByRole("button", { name: "저장", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
}

test("등록 Sheet 는 시안 순서, 사진을 고르면 저장 전 편집 화면이 되고 '저장' 한 번으로 저장된다 (MEM-016, MEM-001, MEM-009)", async ({ page }) => {
  await setup(page);
  await openMemory(page, "100일");
  const d = dialog(page);
  await expect(d.getByRole("heading", { name: "100일" })).toBeVisible();
  await expect(d.getByText("소중한 순간을 남겨보세요")).toBeVisible();
  await expect(d.getByText("사진 추가", { exact: true })).toBeVisible();
  const buttons = await d.getByRole("button").allTextContents();
  expect(buttons.indexOf("사진 선택하기")).toBeLessThan(buttons.indexOf("다음에"));

  await pick(page, ["photo-1.jpg", "photo-2.png"]);
  await expect(thumbs(page)).toHaveCount(2);
  await expect(d.getByRole("button", { name: "사진 1, 대표 사진" })).toBeVisible();
  await expect(d.getByRole("button", { name: "메모 저장" })).toHaveCount(0); // 저장 버튼은 하나
  await expect(d.getByText(/저장했어요/)).toHaveCount(0); // 고르는 즉시 저장하지 않음
  await d.getByLabel("메모").fill("가상의 메모");
  await saveAndClose(page);
  await expect(card(page, "100일").getByText("사진 2장")).toBeVisible();
  await expect(card(page, "100일").getByText("가상의 메모")).toBeVisible();
});

test("저장 전 닫으면 취소 확인, 취소하면 아무것도 저장되지 않는다 (BTS-014)", async ({ page }) => {
  await setup(page);
  await openMemory(page, "100일");
  await pick(page, ["photo-1.jpg"]);
  await expect(thumbs(page)).toHaveCount(1);
  await dialog(page).getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByText("변경 사항을 취소할까요?")).toBeVisible();
  await page.getByRole("button", { name: "취소하기" }).click();
  await expect(card(page, "100일").getByTestId("memory-preview")).toHaveCount(0);
});

test("저장된 추억을 다시 열면 사진·메모를 보여 주고 삭제·닫기 버튼이 있다 (MEM-004, MEM-005)", async ({ page }) => {
  await setup(page);
  await openMemory(page, "100일");
  await pick(page, ["photo-1.jpg", "photo-2.png"]);
  await dialog(page).getByLabel("메모").fill("가상의 메모");
  await saveAndClose(page);

  await openMemory(page, "100일");
  const d = dialog(page);
  await expect(d.getByTestId("memory-view")).toBeVisible();
  await expect(d.getByText("가상의 메모")).toBeVisible();
  await expect(d.getByRole("button", { name: "삭제", exact: true })).toBeVisible();
  await expect(d.getByRole("button", { name: "닫기", exact: true })).toBeVisible();
  // 삭제 버튼 글씨가 배경에 묻히지 않는다: input 배경 + danger 글씨
  await expect(d.getByRole("button", { name: "삭제", exact: true })).toHaveCSS("color", "rgb(198, 83, 99)");
  await expect(d.getByRole("button", { name: "삭제", exact: true })).toHaveCSS("background-color", "rgb(243, 237, 240)");
  await expect(d.getByRole("button", { name: "수정" })).toHaveCSS("color", "rgb(181, 120, 137)");
  await expect(d.getByRole("button", { name: "메모 저장" })).toHaveCount(0);
  await expect(d.getByLabel("메모")).toHaveCount(0); // 보기 화면은 읽기 전용

  await d.getByRole("button", { name: "사진 2 크게 보기" }).click();
  await expect(page.getByTestId("photo-viewer")).toContainText("2 / 2");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("photo-viewer")).toHaveCount(0);
  await expect(dialog(page)).toBeVisible(); // 사진 보기만 닫힘

  await d.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(d.getByText("추억을 삭제할까요?")).toBeVisible();
  await expect(d.getByRole("button", { name: "삭제하기" })).toHaveCSS("background-color", "rgb(198, 83, 99)");
  await expect(d.getByRole("button", { name: "삭제하기" })).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(d.getByText("사진 2장과 메모가 함께 삭제돼요.", { exact: false })).toBeVisible();
  await d.getByRole("button", { name: "삭제하기" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(card(page, "100일").getByTestId("memory-preview")).toHaveCount(0);
});

test("메모만 남기기는 사진 영역 없이 메모와 '메모 저장'만 표시한다 (MEM-013, ARC-B05, MEM-007)", async ({ page }) => {
  await setup(page);
  await openMemory(page, "50일");
  await dialog(page).getByRole("button", { name: "메모만 남기기" }).click();
  const d = dialog(page);
  await expect(d.getByLabel("메모")).toBeVisible();
  await expect(d.getByText("사진", { exact: true })).toHaveCount(0);
  await expect(d.getByRole("button", { name: "사진 추가" })).toHaveCount(0);
  await expect(d.getByRole("button", { name: "메모 저장" })).toBeDisabled();
  await d.getByLabel("메모").fill("가상의 추억 메모");
  await d.getByRole("button", { name: "메모 저장" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(card(page, "50일").getByText("가상의 추억 메모")).toBeVisible();
  await page.reload();
  await gotoAnniversary(page);
  await expect(card(page, "50일").getByText("가상의 추억 메모")).toBeVisible();
});

test("메모는 500자까지만 입력된다 (MEM-E11)", async ({ page }) => {
  await setup(page);
  await openMemory(page, "50일");
  await dialog(page).getByRole("button", { name: "메모만 남기기" }).click();
  await dialog(page).getByLabel("메모").fill("가".repeat(501));
  await expect(dialog(page).getByLabel("메모")).toHaveValue("가".repeat(500));
  await expect(dialog(page).getByText("500/500")).toBeVisible();
});

test("중복·손상·5장 초과 사진은 고를 때 안내하고 제외, 나머지만 저장된다 (MEM-003, MEM-011, MEM-012, MEM-E02, MEM-E04, MEM-E07)", async ({ page }) => {
  await setup(page);
  await openMemory(page, "100일");
  await pick(page, ["photo-1.jpg", "photo-1.jpg", "broken.jpg", "photo-2.png"]);
  const d = dialog(page);
  await expect(thumbs(page)).toHaveCount(2);
  await expect(d.getByText("사진 2장은 추가하지 못했어요.")).toBeVisible();
  await expect(d.getByText("photo-1.jpg: 이미 추가한 사진이에요")).toBeVisible();
  await expect(d.getByText("broken.jpg: 사진을 읽을 수 없어요")).toBeVisible();
  await pick(page, ["photo-3.jpg", "photo-4.png", "photo-5.jpg", "photo-6.png"]);
  await expect(thumbs(page)).toHaveCount(5);
  await expect(d.getByText("photo-6.png: 최대 5장까지 추가할 수 있어요")).toBeVisible();
  await expect(d.getByRole("button", { name: "사진 추가" })).toHaveCount(0);
  await saveAndClose(page);
  await expect(card(page, "100일").getByText("사진 5장")).toBeVisible();
});

test("수정: 대표 변경·순서 이동·대표 빼기 후 저장하면 남은 첫 사진이 대표, 새로고침 후 유지 (MEM-007, MEM-009, MEM-010, ARC-B03, ARC-B04)", async ({ page }) => {
  await setup(page);
  await openMemory(page, "100일");
  await pick(page, ["photo-1.jpg", "photo-2.png", "photo-3.jpg"]);
  const d = dialog(page);
  await d.getByRole("button", { name: "사진 2", exact: true }).click();
  await d.getByRole("button", { name: "대표로" }).click();
  await d.getByRole("button", { name: "앞으로" }).click();
  await expect(d.getByRole("button", { name: "사진 1, 대표 사진" })).toBeVisible();
  await saveAndClose(page);

  await page.reload();
  await gotoAnniversary(page);
  await openMemory(page, "100일");
  await expect(dialog(page).getByRole("button", { name: "사진 1, 대표 사진 크게 보기" })).toBeVisible();
  await dialog(page).getByRole("button", { name: "수정" }).click();
  await dialog(page).getByRole("button", { name: "사진 1, 대표 사진" }).click();
  await dialog(page).getByRole("button", { name: "빼기" }).click();
  await expect(thumbs(page)).toHaveCount(2);
  await saveAndClose(page);
  await openMemory(page, "100일");
  await expect(dialog(page).getByText("사진 2장")).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "사진 1, 대표 사진 크게 보기" })).toBeVisible();
});

test("카드에서 사진을 펼치기/접기, 전체 화면으로 볼 수 있다 (TML-011, MEM-004)", async ({ page }) => {
  await setup(page);
  await openMemory(page, "100일");
  await pick(page, ["photo-1.jpg", "photo-2.png"]);
  await saveAndClose(page);
  const c = card(page, "100일");
  await c.getByRole("button", { name: "펼치기" }).click();
  await expect(c.getByTestId("memory-photo-grid").getByRole("button")).toHaveCount(2);
  await c.getByRole("button", { name: "100일 사진 1 크게 보기" }).click();
  await expect(page.getByTestId("photo-viewer").locator("img")).toHaveJSProperty("complete", true);
  expect(await page.getByTestId("photo-viewer").locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await c.getByRole("button", { name: "접기" }).click();
  await expect(c.getByTestId("memory-photo-grid")).toHaveCount(0);
});

test("미래 기념일에는 사진 추가 버튼이 없고, 당일에는 등록할 수 있다 (MEM-002, TML-012)", async ({ page }) => {
  await setup(page);
  await expect(card(page, "200일").getByRole("button", { name: /추억/ })).toHaveCount(0);
  await page.clock.setFixedTime(new Date("2027-01-16T10:00:00+09:00"));
  await page.reload();
  await gotoAnniversary(page);
  await expect(card(page, "200일").getByText("D-DAY")).toBeVisible();
  await openMemory(page, "200일");
  await pick(page, ["photo-1.jpg"]);
  await saveAndClose(page);
  await expect(card(page, "200일").getByText("사진 1장")).toBeVisible();
});

test("저장된 사진에는 EXIF·위치 정보가 남지 않는다 (MEM-006, MEM-015, ARC-B08)", async ({ page }) => {
  await setup(page);
  await openMemory(page, "100일");
  await pick(page, ["exif-gps.jpg"]);
  await saveAndClose(page);
  const stored = await page.evaluate(
    () =>
      new Promise<{ isArrayBuffer: boolean; hasExif: boolean; hasGps: boolean; width: number; height: number; mime: string }>((resolve, reject) => {
        const request = indexedDB.open("couple-dday");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const all = request.result.transaction("photos").objectStore("photos").getAll();
          all.onsuccess = () => {
            const photo = all.result[0];
            const text = new TextDecoder("latin1").decode(new Uint8Array(photo.data));
            resolve({ isArrayBuffer: photo.data instanceof ArrayBuffer, hasExif: text.includes("Exif"), hasGps: text.includes("TEST-LOCATION"), width: photo.width, height: photo.height, mime: photo.mimeType });
            request.result.close();
          };
        };
      }),
  );
  expect(stored).toEqual({ isArrayBuffer: true, hasExif: false, hasGps: false, width: 400, height: 300, mime: "image/jpeg" });
});
