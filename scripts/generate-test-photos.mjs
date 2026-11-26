/**
 * E2E 용 가상 사진 픽스처 생성 (실제 사용자 사진 사용 금지). 사용법: node scripts/generate-test-photos.mjs "$PWD"
 * 생성물: tests/fixtures/photos/{photo-1..6, exif-gps.jpg, broken.jpg}
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const root = process.argv[2];
const require = createRequire(root + "/package.json");
const { chromium } = require("@playwright/test");
const b = await chromium.launch(); const p = await b.newPage();
const colors = ["#E7B4C2", "#B57889", "#F5D77B", "#B5A4C5", "#9FC5B8", "#C9A24C"];
for (const [i, color] of colors.entries()) {
  const type = i % 2 === 0 ? "image/jpeg" : "image/png";
  const dataUrl = await p.evaluate(({ color, type, i }) => {
    const c = document.createElement("canvas"); c.width = 640 + i * 40; c.height = 480;
    const ctx = c.getContext("2d"); ctx.fillStyle = color; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#ffffff"; ctx.font = "120px sans-serif"; ctx.fillText(String(i + 1), 260, 280);
    return c.toDataURL(type, 0.9);
  }, { color, type, i });
  writeFileSync(`${root}/tests/fixtures/photos/photo-${i + 1}.${type === "image/jpeg" ? "jpg" : "png"}`, Buffer.from(dataUrl.split(",")[1], "base64"));
}
// EXIF(GPS 표식 포함) JPEG: SOI 뒤에 APP1 "Exif" 세그먼트를 삽입
const base = Buffer.from((await p.evaluate(() => { const c = document.createElement("canvas"); c.width = 400; c.height = 300; const x = c.getContext("2d"); x.fillStyle = "#88aacc"; x.fillRect(0,0,400,300); return c.toDataURL("image/jpeg", 0.9); })).split(",")[1], "base64");
const tiff = Buffer.concat([Buffer.from("MM\0*\0\0\0\x08\0\0\0\0\0\0", "latin1"), Buffer.from("GPSLatitude=37.5665;GPSLongitude=126.9780;TEST-LOCATION", "latin1")]);
const payload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([((payload.length + 2) >> 8) & 0xff, (payload.length + 2) & 0xff]), payload]);
writeFileSync(`${root}/tests/fixtures/photos/exif-gps.jpg`, Buffer.concat([base.subarray(0, 2), app1, base.subarray(2)]));
writeFileSync(`${root}/tests/fixtures/photos/broken.jpg`, Buffer.from("이 파일은 이미지가 아닌 가상 테스트 데이터입니다."));
await b.close();
console.log("ok");
