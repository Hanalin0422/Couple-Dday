/**
 * 저장소 지속성 요청 (NFR-014, ARCHITECTURE.md §13). 지원 시 영구 보존을 요청하되 결과를 보장으로 표현하지 않는다.
 * 실패·미지원이어도 앱 동작에는 영향이 없다.
 */
export type PersistenceResult = "persisted" | "not-persisted" | "unsupported";

export async function requestPersistentStorage(): Promise<PersistenceResult> {
  try {
    const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
    if (!storage || typeof storage.persist !== "function") return "unsupported";
    if (typeof storage.persisted === "function" && (await storage.persisted())) return "persisted";
    return (await storage.persist()) ? "persisted" : "not-persisted";
  } catch {
    return "unsupported";
  }
}
