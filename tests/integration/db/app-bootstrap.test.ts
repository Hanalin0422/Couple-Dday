/**
 * 앱 시작 상태 판정 (ONB-001, PWA-007, PWA-008, PWA-E03, TC-DB-002, TC-DB-008, TC-DB-009, TC-ONB-001 일부).
 */
import { afterEach, describe, expect, it } from "vitest";
import { loadAppState } from "@/application/services/app-bootstrap";
import { CoupleDatabase, openDatabase } from "@/infrastructure/db/database";
import { anniversary, couple, draft, photo, settings } from "../../fixtures/entities";

const opened: CoupleDatabase[] = [];
async function freshDb() {
  const db = await openDatabase({ name: `test-${crypto.randomUUID()}` });
  opened.push(db);
  return db;
}

afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await indexedDB.deleteDatabase(db.name);
  }
});

const now = () => new Date("2026-11-26T00:00:00.000Z");

async function counts(db: CoupleDatabase) {
  return Object.fromEntries(await Promise.all(db.tables.map(async (t) => [t.name, await t.count()] as const)));
}

describe("loadAppState", () => {
  it("빈 DB: 기본 설정을 만들고 온보딩 (TC-DB-009, ONB-007)", async () => {
    const db = await freshDb();
    const state = await loadAppState(db, now);
    expect(state).toEqual({
      status: "onboarding",
      settings: { id: "default", dayOffset: 1, onboardingCompleted: false, lastBackupAt: null, revision: 0, updatedAt: "2026-11-26T00:00:00.000Z" },
      draft: null,
    });
    expect(await db.settings.count()).toBe(1);
    // 두 번째 실행은 기존 설정을 그대로 사용한다.
    expect((await loadAppState(db, () => new Date("2027-01-01T00:00:00Z"))).status).toBe("onboarding");
    expect((await db.settings.get("default"))?.updatedAt).toBe("2026-11-26T00:00:00.000Z");
  });

  it("미완료 + 임시 입력: 온보딩과 임시 입력 복구 (ONB-012)", async () => {
    const db = await freshDb();
    await db.settings.put(settings({ onboardingCompleted: false }));
    await db.onboardingDraft.put(draft({ myName: "하늘", startDate: "2026-07-01" }));
    const state = await loadAppState(db, now);
    expect(state.status).toBe("onboarding");
    expect(state.status === "onboarding" && state.draft).toMatchObject({ myName: "하늘", startDate: "2026-07-01" });
  });

  it("완료 + 유효한 커플: 메인 (HOME-001, ONB-E09)", async () => {
    const db = await freshDb();
    const profile = photo({ ownerType: "profile", ownerId: "self" });
    await db.settings.put(settings({ revision: 5 }));
    await db.couple.put(couple({ myPhotoId: profile.id }));
    await db.photos.add(profile);
    const state = await loadAppState(db, now);
    expect(state).toMatchObject({ status: "ready", settings: { revision: 5 }, couple: { myName: "하늘", startDate: "2026-07-01" } });
  });

  it("완료 플래그인데 커플이 없으면 손상으로 판정하고 아무것도 덮어쓰지 않는다 (TC-DB-002)", async () => {
    const db = await freshDb();
    await db.settings.put(settings({ onboardingCompleted: true }));
    await db.anniversaries.add(anniversary());
    const before = await counts(db);
    const state = await loadAppState(db, now);
    expect(state).toEqual({ status: "corrupt", problems: [{ rule: "DB-002", store: "couple", ref: "default" }] });
    expect(await counts(db)).toEqual(before);
  });

  it("설정이 없고 다른 데이터만 남아 있으면 신규 사용자로 판단하지 않는다 (PWA-E03)", async () => {
    const db = await freshDb();
    await db.couple.put(couple());
    const state = await loadAppState(db, now);
    expect(state.status).toBe("corrupt");
    expect(await db.settings.count()).toBe(0);
    expect(await db.couple.count()).toBe(1);
  });

  it("미완료 플래그인데 커플 데이터가 있으면 손상 (완료 플래그·데이터 불일치)", async () => {
    const db = await freshDb();
    await db.settings.put(settings({ onboardingCompleted: false }));
    await db.couple.put(couple());
    expect((await loadAppState(db, now)).status).toBe("corrupt");
  });

  it("잘못된 형식의 설정/커플/임시 입력/프로필 참조는 손상", async () => {
    const cases: [string, (db: CoupleDatabase) => Promise<unknown>][] = [
      ["settings", (db) => db.settings.put({ ...settings(), revision: -1 })],
      ["couple", async (db) => (await db.settings.put(settings()), db.couple.put(couple({ startDate: "2026-02-30" })))],
      ["draft", async (db) => (await db.settings.put(settings({ onboardingCompleted: false })), db.onboardingDraft.put(draft({ myName: "가".repeat(20) })))],
      ["profile", async (db) => (await db.settings.put(settings()), db.couple.put(couple({ partnerPhotoId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })))],
    ];
    for (const [label, seed] of cases) {
      const db = await freshDb();
      await seed(db);
      expect((await loadAppState(db, now)).status, label).toBe("corrupt");
    }
  });

  it("DB 를 열 수 없으면 오류 상태 (자동 초기화 없음, TC-DB-008)", async () => {
    const db = await freshDb();
    db.close();
    const state = await loadAppState(db, now);
    expect(state.status).toBe("error");
  });
});
