/**
 * TC-NFR-005 / NFR-012: 요구사항 ID ↔ TEST_CASES.md 추적성 검사.
 * - REQUIREMENTS.md, ARCHITECTURE.md 표에 정의된 모든 요구사항 ID가 TEST_CASES.md 상세 표(§3, §5)에 1회 이상 등장해야 한다.
 * - TEST_CASES.md가 존재하지 않는 요구사항 ID를 참조하면 실패한다.
 * - 테스트 케이스 ID는 중복되지 않아야 한다.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ID_PATTERN = /(?<![-\w])(?:(?:SYS|ONB|DATE|HOME|ANN|CUS|TML|MEM|SET|BAK|RES|RST|BTS|NAV|PWA|NFR|DB)-E?\d{2,3}|ARC-[A-E]\d{2})\b/g;

/** 표의 첫 번째 셀에 정의된 요구사항 ID를 수집한다. */
function definedIds(markdown: string): Set<string> {
  const ids = new Set<string>();
  for (const line of markdown.split(/\r?\n/)) {
    const firstCell = line.match(/^\|\s*([A-Z]+-[A-Z]?\d{2,3})\s*\|/)?.[1];
    if (firstCell && new RegExp(`^${ID_PATTERN.source}$`).test(firstCell)) ids.add(firstCell);
  }
  return ids;
}

function section(markdown: string, start: string, end: string): string {
  const from = markdown.indexOf(start);
  const to = markdown.indexOf(end, from);
  expect(from, `${start} 섹션`).toBeGreaterThanOrEqual(0);
  return markdown.slice(from, to < 0 ? undefined : to);
}

const requirements = readFileSync("REQUIREMENTS.md", "utf-8");
const architecture = readFileSync("ARCHITECTURE.md", "utf-8");
const testCases = readFileSync("TEST_CASES.md", "utf-8");

const specIds = new Set([...definedIds(requirements), ...definedIds(architecture)]);
const detail = section(testCases, "## 3.", "## 4.") + section(testCases, "## 5.", "## 6.");
const referenced = new Set(detail.match(ID_PATTERN) ?? []);

describe("요구사항 추적성 (TEST_CASES.md)", () => {
  it("명세에서 요구사항 ID를 수집할 수 있다", () => {
    expect(specIds.size).toBeGreaterThan(300);
    for (const sample of ["SYS-001", "ONB-E09", "HOME-032", "HOME-E29", "ARC-A01", "ARC-E03", "DB-015", "NFR-014"]) {
      expect(specIds.has(sample), sample).toBe(true);
    }
  });

  it("모든 요구사항 ID가 테스트 케이스에 연결되어 있다", () => {
    const missing = [...specIds].filter((id) => !referenced.has(id)).sort();
    expect(missing).toEqual([]);
  });

  it("존재하지 않는 요구사항 ID를 참조하지 않는다", () => {
    const unknown = [...referenced].filter((id) => !specIds.has(id)).sort();
    expect(unknown).toEqual([]);
  });

  it("테스트 케이스 ID가 중복되지 않는다", () => {
    const tcIds = [...detail.matchAll(/^\|\s*(TC-[A-Z]+-\d{3})\s*\|/gm)].map((m) => m[1]);
    const duplicates = tcIds.filter((id, i) => tcIds.indexOf(id) !== i);
    expect(tcIds.length).toBeGreaterThan(0);
    expect(duplicates).toEqual([]);
  });
});
