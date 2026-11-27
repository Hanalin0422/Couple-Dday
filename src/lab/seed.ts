/**
 * [LAB] 테스트 전용 DB(couple-dday-lab) 준비. 사용자 DB(couple-dday)는 열지도, 읽지도, 쓰지도 않는다.
 * - 커플(10년 차, 오늘이 정확히 3650일째 → 주년·100일 단위가 아니어서 축하 효과가 실행되지 않음),
 *   프로필 사진 1장, 추억 3건(3600일·3500일·9주년, 사진 2장씩). 사진은 실제 앱의 이미지 준비 과정을 그대로 거친다.
 * - 날짜가 바뀌면(시작일이 오늘 기준과 다르면) 테스트 DB 만 지우고 다시 만든다.
 */
import type { LocalDate, Photo } from "@/domain/entities";
import { addDaysToLocalDate } from "@/domain/date/local-date";
import { loadAppState } from "@/application/services/app-bootstrap";
import { completeOnboarding } from "@/application/services/onboarding";
import { saveMemory } from "@/application/services/memories";
import { prepareMemoryImage, prepareProfileImage } from "@/application/services/image-preparation";
import { openDatabase, type CoupleDatabase } from "@/infrastructure/db/database";
import { LAB_DB_NAME } from "./config";
import type { StaticData } from "./static-data";

export const labStartDate = (today: LocalDate) => addDaysToLocalDate(today, -3649);

/** 이름이 테스트 DB 인지 확인한 뒤에만 삭제한다 */
export async function deleteLabDatabase(db?: CoupleDatabase): Promise<void> {
  db?.close();
  if (LAB_DB_NAME !== "couple-dday-lab") throw new Error("lab db name guard");
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(LAB_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

async function sampleImage(label: string, hue: number, width: number, height: number): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `hsl(${hue} 55% 70%)`);
  gradient.addColorStop(1, `hsl(${(hue + 40) % 360} 45% 45%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `bold ${Math.round(height / 6)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(label, width / 2, height / 2);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9));
  return new File([blob], `${label}.jpg`, { type: "image/jpeg" });
}

/** 테스트 DB 를 열고, 오늘 기준 데이터가 아니면 새로 만든다 */
export async function openLabDatabase(today: LocalDate, onProgress?: (text: string) => void): Promise<CoupleDatabase> {
  let db = await openDatabase({ name: LAB_DB_NAME });
  const couple = await db.couple.get("default");
  if (couple && couple.startDate === labStartDate(today)) return db;
  onProgress?.("테스트 데이터를 만드는 중…");
  await deleteLabDatabase(db);
  db = await openDatabase({ name: LAB_DB_NAME });
  await loadAppState(db); // 앱 시작과 같은 기본 설정 생성
  const rev = async () => (await db.settings.get("default"))?.revision ?? 0;
  const myPhoto = await prepareProfileImage(await sampleImage("나", 340, 1200, 1200));
  await completeOnboarding(
    db,
    { myName: "하늘", partnerName: "바다", startDate: labStartDate(today), dayOffset: 1, myPhoto, partnerPhoto: null },
    { expectedRevision: await rev(), today },
  );
  let hue = 10;
  for (const occurrenceId of ["auto:day:3600", "auto:day:3500", "auto:year:9"]) {
    const a = await prepareMemoryImage(await sampleImage("A", (hue += 50), 3024, 4032));
    const b = await prepareMemoryImage(await sampleImage("B", (hue += 50), 4032, 3024));
    await saveMemory(db, occurrenceId, { order: ["a", "b"], newPhotos: [{ key: "a", image: a }, { key: "b", image: b }], cover: "a", memo: "테스트 메모" }, { expectedRevision: await rev(), today });
  }
  return db;
}

/** 조건 B: 테스트 DB 내용을 한 번만 읽어 메모리에 고정한다(전환 중 DB 조회 없음) */
export async function readStaticData(db: CoupleDatabase): Promise<StaticData> {
  const [couple, settings, anniversaries, exceptions, memories, photos] = await Promise.all([
    db.couple.get("default"),
    db.settings.get("default"),
    db.anniversaries.toArray(),
    db.anniversaryExceptions.toArray(),
    db.memories.toArray(),
    db.photos.toArray(),
  ]);
  return {
    couple: couple!,
    settings: settings!,
    anniversaries,
    exceptions,
    memories: new Map(memories.map((m) => [m.occurrenceId, m])),
    photos: new Map<string, Photo>(photos.map((p) => [p.id, p])),
  };
}
