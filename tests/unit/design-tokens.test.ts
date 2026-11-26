/**
 * TC-DSN-001 / NFR-011: SKILL.md §3 디자인 토큰과 src/styles/tokens.css 의 일치 검증.
 * SKILL.md 가 SSOT 이므로 tokens.css 가 다르면 실패한다.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const skill = readFileSync(".agents/skills/dday-design/SKILL.md", "utf-8");
const tokensCss = readFileSync("src/styles/tokens.css", "utf-8");

function parseSkillTokens(md: string): Map<string, string> {
  const section = md.split("## 3. 디자인 토큰")[1]?.split("\n## ")[0] ?? "";
  const tokens = new Map<string, string>();
  for (const line of section.split("\n")) {
    const m = line.match(/^\|\s*([a-z][a-z-]*)\s*\|\s*(#[0-9A-Fa-f]{6})\s*\|/);
    if (m) tokens.set(m[1], m[2].toUpperCase());
  }
  return tokens;
}

function parseCssColorVars(css: string): Map<string, string> {
  const root = css.split(":root")[1] ?? "";
  const vars = new Map<string, string>();
  for (const m of root.matchAll(/--([a-z][a-z-]*):\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
    vars.set(m[1], m[2].toUpperCase());
  }
  return vars;
}

describe("디자인 토큰 (SKILL.md §3)", () => {
  const expected = parseSkillTokens(skill);
  const actual = parseCssColorVars(tokensCss);

  it("SKILL.md에서 토큰 표를 읽을 수 있다", () => {
    expect(expected.size).toBe(24);
  });

  it("모든 SKILL.md 토큰이 동일한 값으로 정의되어 있다", () => {
    for (const [name, value] of expected) {
      expect(actual.get(name), `--${name}`).toBe(value);
    }
  });

  it("SKILL.md에 없는 색상 토큰을 임의로 추가하지 않는다", () => {
    const extra = [...actual.keys()].filter((k) => !expected.has(k));
    expect(extra).toEqual([]);
  });

  it("라이트모드 전용이며 다크모드 분기를 두지 않는다 (SYS-007, PWA-011)", () => {
    const globals = readFileSync("src/app/globals.css", "utf-8");
    for (const css of [tokensCss, globals]) {
      expect(css).not.toMatch(/prefers-color-scheme\s*:\s*dark/);
    }
    expect(tokensCss).toMatch(/color-scheme:\s*light/);
  });
});
