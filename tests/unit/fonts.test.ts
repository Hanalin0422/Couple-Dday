/**
 * TC-DSN-002 / PWA-004 / PWA-014: 로컬 폰트 리소스 및 라이선스 검증.
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokensCss = readFileSync("src/styles/tokens.css", "utf-8");
const fontUrls = [...tokensCss.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);

describe("로컬 폰트", () => {
  it("@font-face가 Pretendard, MaruBuri(400/600), Cormorant Garamond(400/500 italic)를 정의한다", () => {
    const faces = [...tokensCss.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]);
    const describeFace = (f: string) =>
      `${f.match(/font-family:\s*"([^"]+)"/)?.[1]}|${f.match(/font-weight:\s*([^;]+);/)?.[1]}|${f.match(/font-style:\s*([^;]+);/)?.[1]}`;
    expect(faces.map(describeFace).sort()).toEqual(
      [
        "Cormorant Garamond|400|normal",
        "Cormorant Garamond|500|italic",
        "MaruBuri|400|normal",
        "MaruBuri|600|normal",
        "Pretendard|45 920|normal",
      ].sort(),
    );
  });

  it("외부 CDN 폰트를 참조하지 않는다", () => {
    expect(fontUrls.length).toBeGreaterThan(0);
    for (const url of fontUrls) expect(url.startsWith("/fonts/")).toBe(true);
  });

  it.each(fontUrls)("%s 파일이 존재하고 유효한 WOFF2이다", (url) => {
    const path = `public${url}`;
    expect(existsSync(path)).toBe(true);
    const header = readFileSync(path).subarray(0, 4).toString("latin1");
    expect(header).toBe("wOF2");
  });

  it.each(["pretendard", "maruburi", "cormorant-garamond"])("%s 라이선스(SIL OFL 1.1) 파일이 함께 배포된다", (dir) => {
    const license = readFileSync(`public/fonts/${dir}/LICENSE.txt`, "utf-8");
    expect(license).toMatch(/SIL Open Font License, Version 1\.1/);
  });
});
