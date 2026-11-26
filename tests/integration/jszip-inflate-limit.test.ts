/**
 * 기술 검증 스파이크 (ARCHITECTURE.md §11.1-3, §17 "ZIP 구현", AGENTS.md §6, RES-E05, ARC-D03).
 *
 * 질문: JSZip 만으로 "실제 압축 해제 누적 바이트" 상한을 강제하고, 상한 초과 시 즉시 중단할 수 있는가?
 * 방법: internalStream 으로 엔트리를 청크 단위로 해제하며 바이트를 누적 계산하고, 상한 초과 시 pause 한다.
 *       ZIP 헤더의 선언 크기를 위조한 아카이브로 "선언 크기를 신뢰하지 않는다"는 조건도 확인한다.
 *
 * 실제 importer 의 archive-limits.ts 는 Phase 7 에서 이 결과를 바탕으로 구현한다.
 */
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

const MiB = 1024 * 1024;

class InflateLimitExceededError extends Error {}

/**
 * ZipObject#internalStream 은 JSZip 공식 문서에 명시된 API 이지만 번들 타입 정의에 누락되어 있다.
 * https://stuk.github.io/jszip/documentation/api_zipobject/internal_stream.html
 * 런타임 존재 여부를 확인한 뒤에만 좁은 타입으로 취급한다.
 */
type StreamableZipObject = JSZip.JSZipObject & {
  internalStream(type: "uint8array"): JSZip.JSZipStreamHelper<Uint8Array>;
};
function asStreamable(file: JSZip.JSZipObject): StreamableZipObject {
  if (typeof (file as Partial<StreamableZipObject>).internalStream !== "function") {
    throw new Error("JSZip internalStream API를 사용할 수 없습니다.");
  }
  return file as StreamableZipObject;
}

/** 엔트리를 스트리밍 해제하며 누적 바이트가 limit 을 넘으면 즉시 중단한다. */
function inflateWithLimit(file: JSZip.JSZipObject, limit: number): Promise<{ bytes: number; chunks: Uint8Array[] }> {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    let settled = false;
    const chunks: Uint8Array[] = [];
    const stream = asStreamable(file).internalStream("uint8array");
    stream
      .on("data", (chunk: Uint8Array) => {
        if (settled) return;
        bytes += chunk.length;
        if (bytes > limit) {
          settled = true;
          stream.pause();
          reject(Object.assign(new InflateLimitExceededError("압축 해제 상한 초과"), { bytes }));
          return;
        }
        chunks.push(chunk);
      })
      .on("error", (err: Error) => {
        if (settled) return;
        settled = true;
        reject(err);
      })
      .on("end", () => {
        if (settled) return;
        settled = true;
        resolve({ bytes, chunks });
      })
      .resume();
  });
}

/** 로컬 헤더와 중앙 디렉터리의 uncompressed size 필드를 위조한다. */
function forgeDeclaredSize(zipBytes: Uint8Array, declared: number): Uint8Array {
  const out = zipBytes.slice();
  const view = new DataView(out.buffer);
  for (let i = 0; i < out.length - 4; i++) {
    const sig = view.getUint32(i, true);
    if (sig === 0x04034b50) view.setUint32(i + 22, declared, true); // local file header
    if (sig === 0x02014b50) view.setUint32(i + 24, declared, true); // central directory header
  }
  return out;
}

async function buildBomb(size: number): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("images/memories/bomb.bin", new Uint8Array(size)); // 0으로 채운 데이터는 매우 높은 압축률을 가진다
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 9 } });
}

describe("JSZip 실제 압축 해제 상한 강제 (스파이크)", () => {
  it("상한 이하의 정상 엔트리는 전체 해제된다", async () => {
    const zip = new JSZip();
    const payload = new TextEncoder().encode(JSON.stringify({ format: "couple-dday-backup", formatVersion: 1 }));
    zip.file("manifest.json", payload);
    const loaded = await JSZip.loadAsync(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
    const { bytes } = await inflateWithLimit(loaded.file("manifest.json")!, 1 * MiB);
    expect(bytes).toBe(payload.length);
  });

  it("압축 폭탄 엔트리를 상한 직후 중단하고 전체를 해제하지 않는다", async () => {
    const bomb = await buildBomb(16 * MiB);
    expect(bomb.length).toBeLessThan(64 * 1024); // 16MiB → 수십 KB
    const loaded = await JSZip.loadAsync(bomb);
    const limit = 1 * MiB;
    const err = await inflateWithLimit(loaded.file("images/memories/bomb.bin")!, limit).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InflateLimitExceededError);
    const { bytes } = err as InflateLimitExceededError & { bytes: number };
    expect(bytes).toBeGreaterThan(limit);
    // 중단 시점까지 해제된 양이 상한 + 1 청크 수준이며, 16MiB 전체를 해제하지 않았다.
    expect(bytes).toBeLessThan(limit + 1 * MiB);
  });

  it("ZIP 헤더의 선언 크기를 위조해도 실제 해제 바이트로 차단한다", async () => {
    const forged = forgeDeclaredSize(await buildBomb(8 * MiB), 100);
    const loaded = await JSZip.loadAsync(forged); // CRC 검사 비활성(기본값) 상태에서도 로드된다
    const entry = loaded.file("images/memories/bomb.bin")!;
    // JSZip 이 노출하는 선언 크기는 위조값을 따른다 → 선언값만으로는 안전하지 않다는 근거.
    const declared = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
    expect(declared).toBe(100);
    const err = await inflateWithLimit(entry, 1 * MiB).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InflateLimitExceededError);
  });
});
