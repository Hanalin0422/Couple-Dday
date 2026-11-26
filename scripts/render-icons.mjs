/**
 * 홈 화면 아이콘 PNG 생성 스크립트. 원본은 src/app/icon.svg (사용자 승인 2026-11-26).
 * maskable 아이콘은 원형 마스크 안전 영역을 위해 80% 크기로 배치한다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
// 사용법: npm run icons  (src/app/icon.svg → public/icons/*.png)
const root = process.argv[2] ?? process.cwd();
const require = createRequire(root + "/package.json");
const { chromium } = require("@playwright/test");
const svg = readFileSync(root + "/src/app/icon.svg", "utf-8");
const targets = [
  { file: "public/icons/apple-touch-icon.png", size: 180, scale: 1 },
  { file: "public/icons/icon-192.png", size: 192, scale: 1 },
  { file: "public/icons/icon-512.png", size: 512, scale: 1 },
  { file: "public/icons/icon-maskable-512.png", size: 512, scale: 0.8 },
];
const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 });
  const inner = Math.round(t.size * t.scale);
  await page.setContent(`<html><body style="margin:0;background:#FFF8FA;width:${t.size}px;height:${t.size}px;display:flex;align-items:center;justify-content:center">
    <div style="width:${inner}px;height:${inner}px">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
  writeFileSync(root + "/" + t.file, await page.screenshot({ type: "png", omitBackground: false }));
  console.log("wrote", t.file);
}
await browser.close();
