/**
 * 애플리케이션 계층 오류. 메시지에 개인 데이터를 포함하지 않는다(NFR-003).
 */
import type { IntegrityViolation } from "./validation/integrity";

/** 다른 탭/오래된 화면에서 읽은 revision 이 현재 값과 다르다 (DB-015, PWA-E05). */
export class RevisionConflictError extends Error {
  constructor(
    readonly expected: number,
    readonly actual: number,
  ) {
    super(`데이터가 다른 곳에서 변경되었습니다. (expected ${expected}, actual ${actual})`);
    this.name = "RevisionConflictError";
  }
}

/** 저장 데이터가 무결성 규칙을 위반한다. 자동 수정·삭제하지 않는다. */
export class IntegrityError extends Error {
  constructor(readonly violations: readonly Pick<IntegrityViolation, "rule" | "store" | "ref">[]) {
    super(`데이터 무결성 오류: ${violations.map((v) => `${v.rule}(${v.store}:${v.ref})`).join(", ")}`);
    this.name = "IntegrityError";
  }
}

/** 입력값이 검증 규칙을 위반한다(저장 차단). */
export class ValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`입력값 오류: ${issues.join(", ")}`);
    this.name = "ValidationError";
  }
}
