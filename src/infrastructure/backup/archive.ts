/**
 * ZIP 아카이브 처리 (ARCHITECTURE.md §10, §11.1, RES-E01, RES-E05, ARC-D03, AGENTS.md §6).
 *
 * - inspectArchive: 압축 해제 전에 중앙 디렉터리를 직접 읽어 엔트리 수·경로·중복·암호화·심볼릭 링크·중첩 아카이브·
 *   압축 방식·ZIP64 를 검증한다(JSZip 은 같은 이름의 엔트리를 덮어써 중복을 드러내지 않으므로 직접 파싱한다).
 * - readArchiveEntries: JSZip internalStream 으로 엔트리를 청크 단위로 풀며 실제 해제 바이트를 누적해 상한을 넘으면 즉시 중단한다.
 *   ZIP 헤더의 선언 크기는 신뢰하지 않는다(Phase 0 스파이크 검증, §4.4). CRC 일괄 검사는 전체 해제를 유발하므로 사용하지 않는다.
 * - buildArchive: 백업 ZIP 생성. 이미 압축된 이미지는 STORE, JSON 은 DEFLATE.
 * 오류 메시지에 개인 데이터를 포함하지 않는다.
 */
import JSZip from "jszip";

export interface ArchiveLimits {
  /** ZIP 입력 파일 최대 크기(잠정, §17) */
  maxArchiveBytes: number;
  /** 최대 엔트리 수(잠정, §17) */
  maxEntries: number;
  /** 실제 압축 해제 총량 상한 (ARC-D03 확정 초기값 256MiB) */
  maxTotalUncompressedBytes: number;
  /** 엔트리 하나의 최대 해제 크기(잠정) */
  maxEntryBytes: number;
}

export const DEFAULT_ARCHIVE_LIMITS: ArchiveLimits = {
  maxArchiveBytes: 300 * 1024 * 1024,
  maxEntries: 10_000,
  maxTotalUncompressedBytes: 268_435_456,
  maxEntryBytes: 64 * 1024 * 1024,
};

export type ArchiveFailure =
  | "too-large"
  | "not-zip"
  | "unsupported"
  | "too-many-entries"
  | "unsafe-path"
  | "duplicate-entry"
  | "encrypted"
  | "symlink"
  | "nested-archive"
  | "uncompressed-limit"
  | "entry-limit"
  | "corrupt";

export class ArchiveError extends Error {
  constructor(readonly reason: ArchiveFailure) {
    super(`백업 파일 오류: ${reason}`);
    this.name = "ArchiveError";
  }
}

export interface ArchiveEntryInfo {
  name: string;
  isDirectory: boolean;
  declaredSize: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const NESTED_ARCHIVE = /\.(zip|jar|rar|7z|tar|gz|tgz|bz2|xz)$/i;

function isUnsafePath(name: string): boolean {
  if (name.length === 0 || name.includes("\0") || name.includes("\\")) return true;
  if (name.startsWith("/") || /^[A-Za-z]:/.test(name)) return true;
  return name.split("/").some((part) => part === ".." || part === ".");
}

/** 중앙 디렉터리 검증. 통과한 엔트리 목록을 돌려준다. */
export function inspectArchive(bytes: Uint8Array, limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS): ArchiveEntryInfo[] {
  if (bytes.byteLength > limits.maxArchiveBytes) throw new ArchiveError("too-large");
  if (bytes.byteLength < 22) throw new ArchiveError("not-zip");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const searchStart = Math.max(0, bytes.byteLength - 22 - 0xffff);
  for (let i = bytes.byteLength - 22; i >= searchStart; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ArchiveError("not-zip");
  const diskNumber = view.getUint16(eocd + 4, true);
  const entryCount = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (diskNumber !== 0) throw new ArchiveError("unsupported");
  if (entryCount === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new ArchiveError("unsupported"); // ZIP64
  if (entryCount > limits.maxEntries) throw new ArchiveError("too-many-entries");
  if (cdOffset + cdSize > eocd) throw new ArchiveError("corrupt");

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const entries: ArchiveEntryInfo[] = [];
  const names = new Set<string>();
  let offset = cdOffset;
  let declaredTotal = 0;
  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) throw new ArchiveError("corrupt");
    const madeBy = view.getUint16(offset + 4, true);
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const declaredSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const externalAttributes = view.getUint32(offset + 38, true);
    if (offset + 46 + nameLength > bytes.byteLength) throw new ArchiveError("corrupt");
    let name: string;
    try {
      name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    } catch {
      throw new ArchiveError("unsafe-path");
    }
    if (flags & 0x0001 || flags & 0x0040) throw new ArchiveError("encrypted");
    const unixMode = (externalAttributes >>> 16) & 0xffff;
    if (madeBy >> 8 === 3 && (unixMode & 0xf000) === 0xa000) throw new ArchiveError("symlink");
    if (method !== 0 && method !== 8) throw new ArchiveError("unsupported");
    if (declaredSize === 0xffffffff) throw new ArchiveError("unsupported");
    if (isUnsafePath(name)) throw new ArchiveError("unsafe-path");
    if (names.has(name)) throw new ArchiveError("duplicate-entry");
    names.add(name);
    const isDirectory = name.endsWith("/");
    if (!isDirectory && NESTED_ARCHIVE.test(name)) throw new ArchiveError("nested-archive");
    declaredTotal += declaredSize;
    entries.push({ name, isDirectory, declaredSize });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  // 선언 크기 합이 상한을 넘으면 조기 거부(선언값은 위조 가능하므로 실제 해제 시에도 다시 제한한다)
  if (declaredTotal > limits.maxTotalUncompressedBytes) throw new ArchiveError("uncompressed-limit");
  return entries;
}

type StreamableZipObject = JSZip.JSZipObject & { internalStream(type: "uint8array"): JSZip.JSZipStreamHelper<Uint8Array> };

/** 지정한 엔트리를 실제 해제 바이트 누적 상한을 지키며 읽는다. */
export async function readArchiveEntries(
  bytes: Uint8Array,
  names: readonly string[],
  limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
): Promise<Map<string, Uint8Array>> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes, { checkCRC32: false });
  } catch {
    throw new ArchiveError("not-zip");
  }
  const result = new Map<string, Uint8Array>();
  let total = 0;
  for (const name of names) {
    const file = zip.file(name) as StreamableZipObject | null;
    if (!file || typeof file.internalStream !== "function") throw new ArchiveError("corrupt");
    const data = await new Promise<Uint8Array>((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      let entryBytes = 0;
      let settled = false;
      const stream = file.internalStream("uint8array");
      const fail = (reason: ArchiveFailure) => {
        if (settled) return;
        settled = true;
        stream.pause();
        reject(new ArchiveError(reason));
      };
      stream
        .on("data", (chunk) => {
          if (settled) return;
          entryBytes += chunk.length;
          total += chunk.length;
          if (total > limits.maxTotalUncompressedBytes) return fail("uncompressed-limit");
          if (entryBytes > limits.maxEntryBytes) return fail("entry-limit");
          chunks.push(chunk);
        })
        .on("error", () => fail("corrupt"))
        .on("end", () => {
          if (settled) return;
          settled = true;
          const out = new Uint8Array(entryBytes);
          let position = 0;
          for (const chunk of chunks) {
            out.set(chunk, position);
            position += chunk.length;
          }
          resolve(out);
        })
        .resume();
    });
    result.set(name, data);
  }
  return result;
}

export interface ArchiveFile {
  path: string;
  data: Uint8Array | string;
  /** 이미 압축된 이미지는 false(STORE) */
  compress: boolean;
}

export async function buildArchive(files: readonly ArchiveFile[]): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const file of files) zip.file(file.path, file.data, { compression: file.compress ? "DEFLATE" : "STORE", binary: typeof file.data !== "string" });
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
