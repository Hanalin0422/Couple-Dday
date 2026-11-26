/**
 * 텍스트 길이 규칙 (ONB-002, ONB-003, ONB-E01, ONB-E02, CUS-002, MEM-013, DB-003).
 *
 * 문자 수는 사용자가 인식하는 문자(grapheme) 기준으로 센다(ARCHITECTURE.md §5.2 구현 제안).
 * 예: "👩‍❤️‍👨" 1자, "한글" 2자. Intl.Segmenter 미지원 환경은 코드 포인트 수로 대체한다.
 * 한글 IME 조합 중 잘라내기는 UI 입력 컴포넌트에서 처리한다(조합 중 미절단).
 */
export const NAME_MAX_LENGTH = 10;
export const ANNIVERSARY_TITLE_MAX_LENGTH = 30;
export const MEMO_MAX_LENGTH = 500;

let segmenter: Intl.Segmenter | null | undefined;

function getSegmenter(): Intl.Segmenter | null {
  if (segmenter === undefined) {
    segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("ko", { granularity: "grapheme" }) : null;
  }
  return segmenter;
}

/** 사용자 인식 문자 수. */
export function countCharacters(value: string, useSegmenter = true): number {
  const seg = useSegmenter ? getSegmenter() : null;
  if (!seg) return Array.from(value).length;
  return Array.from(seg.segment(value)).length;
}

export type TextRuleViolation = "empty" | "too-long";

/** 필수 텍스트(이름, 기념일 이름): 앞뒤 공백 제거 후 1자 이상 max 자 이하. */
export function validateRequiredText(value: string, max: number): TextRuleViolation | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "empty";
  return countCharacters(trimmed) > max ? "too-long" : null;
}

/** 선택 텍스트(메모): max 자 이하. 빈 값 허용. */
export function validateOptionalText(value: string, max: number): TextRuleViolation | null {
  return countCharacters(value) > max ? "too-long" : null;
}

/** 저장용 정규화: 앞뒤 공백 제거 (ONB-E01). */
export function normalizeRequiredText(value: string): string {
  return value.trim();
}
