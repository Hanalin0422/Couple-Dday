/**
 * 백업 파일 전달 (BAK-012, ARC-D04, ARCHITECTURE.md §10.1).
 * Web Share API 의 파일 공유를 지원하면 공유 시트를 사용하고, 아니면 다운로드한다.
 * - 공유 완료: "shared" / 사용자가 공유 시트를 닫음: "cancelled"
 * - 다운로드 전달 동작 성공: "downloaded" (OS 의 실제 저장 완료는 관찰할 수 없다)
 * 실제 파일 보존을 보장한다고 표현하지 않는다.
 */
export type DeliveryResult = "shared" | "downloaded" | "cancelled";

export async function deliverFile(bytes: Uint8Array, fileName: string, mimeType = "application/zip"): Promise<DeliveryResult> {
  const file = new File([bytes as BlobPart], fileName, { type: mimeType });
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  if (nav && typeof nav.canShare === "function" && typeof nav.share === "function" && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: fileName });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // 공유가 허용되지 않는 상황(NotAllowedError 등)에서는 다운로드로 전달한다.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // 다운로드가 시작될 시간을 둔 뒤 해제한다(NFR-002).
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return "downloaded";
}
