/**
 * 백업·복원·초기화 통합 테스트 (TC-BAK-001~009, TC-RES-001~014, TC-RST-001~002, TC-ENV-003/004 연장, ARC-D01~D04).
 */
import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";
import type { DraftImage } from "@/domain/entities";
import { RevisionConflictError } from "@/application/errors";
import { addCustomAnniversary, deleteAnniversaryOccurrence, updateAnniversaryOccurrence } from "@/application/services/anniversaries";
import { loadAppState } from "@/application/services/app-bootstrap";
import {
  BackupError,
  backupFileName,
  createBackupFile,
  parseBackupFile,
  recordBackupDelivered,
  resetAllData,
  restoreFromBackup,
  type ParseOptions,
} from "@/application/services/backup";
import { setProfilePhoto } from "@/application/services/couple-settings";
import { saveMemory } from "@/application/services/memories";
import { completeOnboarding, saveOnboardingDraft } from "@/application/services/onboarding";
import { checkIntegrity } from "@/application/validation/integrity";
import { DEFAULT_ARCHIVE_LIMITS } from "@/infrastructure/backup/archive";
import { openDatabase, type CoupleDatabase } from "@/infrastructure/db/database";
import { sha256Hex } from "@/infrastructure/image/hash";

const TODAY = "2026-11-25";
const NOW = () => new Date("2026-11-25T05:30:00.000Z");
const opts: ParseOptions = { today: TODAY, verifyImage: async () => true };
const opened: CoupleDatabase[] = [];
afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await indexedDB.deleteDatabase(db.name);
  }
});

async function image(seed: string): Promise<DraftImage> {
  const data = new Uint8Array([0xff, 0xd8, 0xff, ...Array.from(seed, (c) => c.charCodeAt(0)), 0xff, 0xd9]).buffer;
  return { data, sourceHash: await sha256Hex(new TextEncoder().encode(`src-${seed}`).buffer), contentHash: await sha256Hex(data), mimeType: "image/jpeg", width: 10, height: 10, size: data.byteLength };
}

async function newDb() {
  const db = await openDatabase({ name: `test-${crypto.randomUUID()}` });
  opened.push(db);
  await loadAppState(db);
  return db;
}

const rev = async (db: CoupleDatabase) => (await db.settings.get("default"))!.revision;

/** 다양한 데이터가 있는 완료 상태 DB */
async function populatedDb() {
  const db = await newDb();
  await completeOnboarding(db, { myName: "하늘", partnerName: "바다", startDate: "2026-07-01", dayOffset: 0, myPhoto: null, partnerPhoto: null }, { expectedRevision: 0, today: TODAY });
  await setProfilePhoto(db, "self", await image("profile"), { expectedRevision: await rev(db) });
  const yearly = await addCustomAnniversary(db, { title: "첫 여행", date: "2026-08-15", repeatType: "yearly" }, { expectedRevision: await rev(db) });
  await updateAnniversaryOccurrence(db, yearly.id, 2027, { title: "제주 여행", date: "2027-08-20" }, { expectedRevision: await rev(db) });
  await deleteAnniversaryOccurrence(db, yearly.id, 2028, { expectedRevision: await rev(db) });
  const once = await addCustomAnniversary(db, { title: "기념", date: "2026-09-01", repeatType: "none" }, { expectedRevision: await rev(db) });
  const a = await image("a");
  const b = await image("b");
  await saveMemory(db, "auto:day:100", { order: ["a", "b"], newPhotos: [{ key: "a", image: a }, { key: "b", image: b }], cover: "b", memo: "가상 메모" }, { expectedRevision: await rev(db), today: TODAY });
  await saveMemory(db, `custom:${once.id}`, { order: [], newPhotos: [], cover: null, memo: "메모만" }, { expectedRevision: await rev(db), today: TODAY });
  return db;
}

async function snapshotOf(db: CoupleDatabase) {
  return {
    couple: await db.couple.toArray(),
    settings: await db.settings.toArray(),
    anniversaries: await db.anniversaries.toArray(),
    anniversaryExceptions: await db.anniversaryExceptions.toArray(),
    memories: await db.memories.toArray(),
    photos: await db.photos.toArray(),
    onboardingDraft: await db.onboardingDraft.toArray(),
  };
}

/** 비교용: 이미지 바이트는 hex 로, 설정은 의미 있는 필드만 */
async function comparable(db: CoupleDatabase) {
  const s = await snapshotOf(db);
  const sortBy = <T,>(list: T[], key: (t: T) => string) => [...list].sort((x, y) => key(x).localeCompare(key(y)));
  return {
    couple: s.couple,
    dayOffset: s.settings[0].dayOffset,
    anniversaries: sortBy(s.anniversaries, (a) => a.id),
    anniversaryExceptions: sortBy(s.anniversaryExceptions, (e) => `${e.seriesId}${e.occurrenceYear}`),
    memories: sortBy(s.memories, (m) => m.occurrenceId),
    photos: sortBy(s.photos, (p) => p.id).map((p) => ({ ...p, data: Buffer.from(p.data).toString("hex") })),
  };
}

/** ZIP 내용 수정 후 다시 만들기 */
async function rewrite(bytes: Uint8Array, mutate: (files: Map<string, Uint8Array | string>) => void): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes);
  const files = new Map<string, Uint8Array | string>();
  for (const name of Object.keys(zip.files)) {
    const entry = zip.files[name];
    if (entry.dir) continue;
    files.set(name, name.endsWith(".json") ? await entry.async("string") : await entry.async("uint8array"));
  }
  mutate(files);
  const out = new JSZip();
  for (const [name, data] of files) out.file(name, data);
  return out.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

const editJson = (files: Map<string, Uint8Array | string>, name: string, fn: (value: never) => unknown) =>
  files.set(name, JSON.stringify(fn(JSON.parse(files.get(name) as string) as never)));

/** 중앙 디렉터리 엔트리를 찾아 수정 */
function patchCentral(bytes: Uint8Array, entryName: string, patch: (view: DataView, offset: number) => void): Uint8Array {
  const out = bytes.slice();
  const view = new DataView(out.buffer);
  const target = new TextEncoder().encode(entryName);
  for (let i = 0; i < out.length - 46; i++) {
    if (view.getUint32(i, true) !== 0x02014b50) continue;
    const nameLength = view.getUint16(i + 28, true);
    const name = out.subarray(i + 46, i + 46 + nameLength);
    if (name.length === target.length && name.every((byte, j) => byte === target[j])) {
      patch(view, i);
      return out;
    }
  }
  throw new Error(`entry not found: ${entryName}`);
}

/** 로컬 헤더와 중앙 디렉터리의 이름 바이트를 같은 길이의 다른 이름으로 바꾼다 */
function renameEntry(bytes: Uint8Array, from: string, to: string): Uint8Array {
  const a = new TextEncoder().encode(from);
  const b = new TextEncoder().encode(to);
  expect(a.length).toBe(b.length);
  const out = bytes.slice();
  for (let i = 0; i <= out.length - a.length; i++) {
    if (a.every((byte, j) => out[i + j] === byte)) out.set(b, i);
  }
  return out;
}

const reason = async (p: Promise<unknown>) => {
  const error = await p.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(BackupError);
  return (error as BackupError).reason;
};

describe("백업 생성 (BAK-001~011)", () => {
  it("manifest·JSON·이미지를 포함한 ZIP 을 만들고 자동 기념일·임시 입력은 제외한다", async () => {
    const db = await populatedDb();
    const file = await createBackupFile(db, NOW);
    expect(file.fileName).toBe(backupFileName(NOW()));
    expect(file.fileName).toMatch(/^couple-dday-backup-\d{8}-\d{6}\.zip$/);
    const zip = await JSZip.loadAsync(file.bytes);
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
    expect(names.filter((n) => n.endsWith(".json"))).toEqual(
      ["anniversaries.json", "anniversaryExceptions.json", "couple.json", "manifest.json", "memories.json", "photos.json", "settings.json"],
    );
    expect(names.filter((n) => n.startsWith("images/profiles/"))).toHaveLength(1);
    expect(names.filter((n) => n.startsWith("images/memories/"))).toHaveLength(2);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
    expect(manifest).toEqual({
      format: "couple-dday-backup",
      formatVersion: 1,
      databaseVersion: 1,
      appVersion: expect.any(String),
      createdAt: "2026-11-25T05:30:00.000Z",
      encrypted: false,
      counts: { couples: 1, anniversaries: 2, anniversaryExceptions: 2, memories: 2, photos: 3 },
    });
    expect(JSON.parse(await zip.file("settings.json")!.async("string"))).toEqual({ dayOffset: 0 });
    const photos = JSON.parse(await zip.file("photos.json")!.async("string"));
    expect(photos[0]).not.toHaveProperty("data");
    expect(photos[0]).toHaveProperty("path");
    const exceptions = JSON.parse(await zip.file("anniversaryExceptions.json")!.async("string"));
    expect(exceptions.map((e: { kind: string }) => e.kind).sort()).toEqual(["cancelled", "override"]); // tombstone 포함
  });

  it("DB 를 변경하지 않는다 (BAK-010)", async () => {
    const db = await populatedDb();
    const before = await snapshotOf(db);
    await createBackupFile(db, NOW);
    expect(await snapshotOf(db)).toEqual(before);
  });

  it("미완료 상태에서는 백업하지 않는다", async () => {
    const db = await newDb();
    expect(await reason(createBackupFile(db, NOW))).toBe("not-completed");
  });

  it("전달 성공 시 마지막 백업 일시 = 파일 생성 일시, 이후 데이터가 바뀌었으면 기록하지 않는다 (BAK-012, ARC-D04)", async () => {
    const db = await populatedDb();
    const file = await createBackupFile(db, NOW);
    expect(await recordBackupDelivered(db, file)).toBe(true);
    expect((await db.settings.get("default"))?.lastBackupAt).toBe(file.createdAt);

    const stale = await createBackupFile(db, () => new Date("2026-11-25T06:00:00.000Z"));
    await resetAllData(db, { expectedRevision: await rev(db) }); // 다른 탭에서 초기화된 상황
    expect(await recordBackupDelivered(db, stale)).toBe(false);
    expect((await db.settings.get("default"))?.lastBackupAt).toBeNull();
  });
});

describe("복원 왕복 (RES-001~009, MEM-008)", () => {
  it("백업 → 초기화 → 복원 후 모든 기록·ID·사진이 동일하고 무결성 유지", async () => {
    const db = await populatedDb();
    const expected = await comparable(db);
    const file = await createBackupFile(db, NOW);
    await resetAllData(db, { expectedRevision: await rev(db) });
    expect((await loadAppState(db)).status).toBe("onboarding");

    const payload = await parseBackupFile(file.bytes, opts);
    const before = await rev(db);
    const after = await restoreFromBackup(db, payload, { expectedRevision: before, today: TODAY });
    expect(after).toBe(before + 1); // 백업의 revision 이 아니라 현재 값에서 증가
    expect(await comparable(db)).toEqual(expected);
    expect(await db.settings.get("default")).toMatchObject({ onboardingCompleted: true, lastBackupAt: "2026-11-25T05:30:00.000Z" }); // ARC-D01
    expect(checkIntegrity(await snapshotOf(db))).toEqual([]);
    expect((await loadAppState(db)).status).toBe("ready");
  });

  it("온보딩 중 복원: 임시 입력을 지우고 메인 상태가 된다 (RES-007, ONB-013)", async () => {
    const source = await populatedDb();
    const file = await createBackupFile(source, NOW);
    const db = await newDb();
    await saveOnboardingDraft(db, { myName: "임시", partnerName: "", startDate: null, dayOffset: 1, myPhoto: null, partnerPhoto: null }, { expectedRevision: 0 });
    await restoreFromBackup(db, await parseBackupFile(file.bytes, opts), { expectedRevision: await rev(db), today: TODAY });
    expect(await db.onboardingDraft.count()).toBe(0);
    expect(await loadAppState(db)).toMatchObject({ status: "ready", couple: { myName: "하늘" } });
  });

  it("교체 트랜잭션 실패 시 기존 데이터 유지 (RES-006, RES-E06)", async () => {
    const db = await populatedDb();
    const file = await createBackupFile(db, NOW);
    const before = await snapshotOf(db);
    const payload = await parseBackupFile(file.bytes, opts);
    await expect(restoreFromBackup(db, payload, { expectedRevision: (await rev(db)) - 1, today: TODAY })).rejects.toBeInstanceOf(RevisionConflictError);
    expect(await snapshotOf(db)).toEqual(before);
  });

  it("확인 이후 기기 날짜가 시작일 이전이면 복원하지 않는다 (RES-E09, ARC-D02)", async () => {
    const db = await populatedDb();
    const payload = await parseBackupFile((await createBackupFile(db, NOW)).bytes, opts);
    expect(await reason(restoreFromBackup(db, payload, { expectedRevision: await rev(db), today: "2026-06-30" }))).toBe("future-start-date");
  });
});

describe("복원 파일 검증 실패 (RES-E01~E05, RES-E09)", () => {
  let backup: Uint8Array;
  const valid = async () => {
    if (!backup) backup = (await createBackupFile(await populatedDb(), NOW)).bytes;
    return backup;
  };

  it("ZIP 이 아니거나 잘린 파일 (RES-E01)", async () => {
    expect(await reason(parseBackupFile(new TextEncoder().encode("not a zip file at all, just text"), opts))).toBe("archive:not-zip");
    const bytes = await valid();
    expect(await reason(parseBackupFile(bytes.subarray(0, bytes.length - 40), opts))).toMatch(/^archive:(not-zip|corrupt)$/);
  });

  it("필수 JSON 누락·문법 오류·스키마 위반 (RES-E02)", async () => {
    expect(await reason(parseBackupFile(await rewrite(await valid(), (f) => f.delete("couple.json")), opts))).toBe("missing-file");
    expect(await reason(parseBackupFile(await rewrite(await valid(), (f) => f.set("memories.json", "{ not json")), opts))).toBe("invalid-json");
    expect(await reason(parseBackupFile(await rewrite(await valid(), (f) => editJson(f, "couple.json", (c: { myName: string }) => ({ ...c, myName: "가".repeat(11) }))), opts))).toBe("schema");
    expect(await reason(parseBackupFile(await rewrite(await valid(), (f) => editJson(f, "settings.json", () => ({ dayOffset: 2 }))), opts))).toBe("schema");
  });

  it("지원하지 않는 버전 (RES-003, RES-E04)", async () => {
    const bytes = await rewrite(await valid(), (f) => editJson(f, "manifest.json", (m: object) => ({ ...m, formatVersion: 2 })));
    expect(await reason(parseBackupFile(bytes, opts))).toBe("unsupported-version");
    const db2 = await rewrite(await valid(), (f) => editJson(f, "manifest.json", (m: object) => ({ ...m, databaseVersion: 2 })));
    expect(await reason(parseBackupFile(db2, opts))).toBe("unsupported-version");
  });

  it("개수 불일치·이미지 누락·해시 불일치·디코딩 실패·고아 참조 (RES-E03)", async () => {
    expect(await reason(parseBackupFile(await rewrite(await valid(), (f) => editJson(f, "manifest.json", (m: { counts: object }) => ({ ...m, counts: { ...m.counts, memories: 9 } }))), opts))).toBe("count-mismatch");
    expect(await reason(parseBackupFile(await rewrite(await valid(), (f) => f.delete([...f.keys()].find((n) => n.startsWith("images/memories/"))!)), opts))).toBe("missing-file");
    expect(await reason(parseBackupFile(await rewrite(await valid(), (f) => { const name = [...f.keys()].find((n) => n.startsWith("images/memories/"))!; f.set(name, new Uint8Array([0xff, 0xd8, 1, 2])); }), opts))).toBe("image-mismatch");
    expect(await reason(parseBackupFile(await valid(), { ...opts, verifyImage: async () => false }))).toBe("image-decode");
    const orphan = await rewrite(await valid(), (f) =>
      editJson(f, "memories.json", (list: object[]) => [...list.slice(0, -1), { occurrenceId: "custom:33333333-3333-4333-8333-333333333333", memo: "고아", coverPhotoId: null, createdAt: "2026-11-25T00:00:00Z", updatedAt: "2026-11-25T00:00:00Z" }]),
    );
    expect(await reason(parseBackupFile(orphan, opts))).toBe("integrity");
  });

  it("예상하지 않은 엔트리·중첩 아카이브·비정상 경로 (RES-E05)", async () => {
    expect(await reason(parseBackupFile(await rewrite(await valid(), (f) => f.set("extra.txt", "x")), opts))).toBe("unexpected-entry");
    expect(await reason(parseBackupFile(await rewrite(await valid(), (f) => f.set("images/memories/inner.zip", new Uint8Array([1]))), opts))).toBe("archive:nested-archive");
    const traversal = renameEntry(await rewrite(await valid(), (f) => f.set("qqqqqqq.txt", "x")), "qqqqqqq.txt", "../evil.txt");
    expect(await reason(parseBackupFile(traversal, opts))).toBe("archive:unsafe-path");
    const absolute = renameEntry(await rewrite(await valid(), (f) => f.set("qwerty.txt", "x")), "qwerty.txt", "/abcde.txt");
    expect(await reason(parseBackupFile(absolute, opts))).toBe("archive:unsafe-path");
  });

  it("중복 경로·암호화·심볼릭 링크·과다 엔트리 (RES-E05)", async () => {
    const duplicate = renameEntry(await rewrite(await valid(), (f) => f.set("manifesX.json", "{}")), "manifesX.json", "manifest.json");
    expect(await reason(parseBackupFile(duplicate, opts))).toBe("archive:duplicate-entry");
    const encrypted = patchCentral(await valid(), "couple.json", (view, offset) => view.setUint16(offset + 8, view.getUint16(offset + 8, true) | 1, true));
    expect(await reason(parseBackupFile(encrypted, opts))).toBe("archive:encrypted");
    const symlink = patchCentral(await valid(), "couple.json", (view, offset) => {
      view.setUint16(offset + 4, (3 << 8) | 20, true);
      view.setUint32(offset + 38, (0xa1ff << 16) >>> 0, true);
    });
    expect(await reason(parseBackupFile(symlink, opts))).toBe("archive:symlink");
    expect(await reason(parseBackupFile(await valid(), { ...opts, limits: { ...DEFAULT_ARCHIVE_LIMITS, maxEntries: 5 } }))).toBe("archive:too-many-entries");
  });

  it("압축 폭탄: 실제 해제 바이트 상한 초과 시 중단, 선언 크기를 위조해도 차단 (RES-E05, ARC-D03)", async () => {
    const bomb = await rewrite(await valid(), (f) => editJson(f, "memories.json", (list: object[]) => list.map((m) => ({ ...m, pad: "0".repeat(2_000_000) }))));
    const limits = { ...DEFAULT_ARCHIVE_LIMITS, maxTotalUncompressedBytes: 1_000_000 };
    expect(await reason(parseBackupFile(bomb, { ...opts, limits }))).toBe("archive:uncompressed-limit");
    // 선언 크기를 100 바이트로 위조: 구조 검사는 통과하지만 실제 해제에서 차단
    const forged = patchCentral(bomb, "memories.json", (view, offset) => view.setUint32(offset + 24, 100, true));
    expect(await reason(parseBackupFile(forged, { ...opts, limits }))).toBe("archive:uncompressed-limit");
  });

  it("ZIP 입력 크기 상한 초과 (잠정 상한)", async () => {
    expect(await reason(parseBackupFile(await valid(), { ...opts, limits: { ...DEFAULT_ARCHIVE_LIMITS, maxArchiveBytes: 100 } }))).toBe("archive:too-large");
  });

  it("백업 시작일이 기기 오늘보다 미래면 차단 (RES-E09, ARC-D02)", async () => {
    expect(await reason(parseBackupFile(await valid(), { ...opts, today: "2026-06-30" }))).toBe("future-start-date");
  });

  it("검증 실패는 DB 를 건드리지 않는다 (RES-006)", async () => {
    const db = await populatedDb();
    const before = await snapshotOf(db);
    await parseBackupFile(new Uint8Array([1, 2, 3]), opts).catch(() => undefined);
    expect(await snapshotOf(db)).toEqual(before);
  });
});

describe("전체 초기화 (RST-001~009)", () => {
  it("개인 데이터·사진·기념일·예외·추억을 삭제하고 기본 설정으로 되돌리며 revision 은 증가한다", async () => {
    const db = await populatedDb();
    const before = await rev(db);
    await recordBackupDelivered(db, await createBackupFile(db, NOW));
    await resetAllData(db, { expectedRevision: before + 1 });
    const s = await snapshotOf(db);
    expect([s.couple, s.anniversaries, s.anniversaryExceptions, s.memories, s.photos, s.onboardingDraft].every((t) => t.length === 0)).toBe(true);
    expect(s.settings[0]).toMatchObject({ onboardingCompleted: false, dayOffset: 1, lastBackupAt: null, revision: before + 2 });
    expect((await loadAppState(db)).status).toBe("onboarding");
  });

  it("초기화 실패 시 기존 데이터 유지 (RST-009)", async () => {
    const db = await populatedDb();
    const before = await snapshotOf(db);
    await expect(resetAllData(db, { expectedRevision: 0 })).rejects.toBeInstanceOf(RevisionConflictError);
    expect(await snapshotOf(db)).toEqual(before);
  });
});
