/**
 * 사진 준비 (ONB-004, SET-003, MEM-006, MEM-014, MEM-015, ARC-B02, ARC-B07, ARC-B08).
 * - 프로필: 512×512 이내 / 추억: 긴 변 1920px 이내, JPEG 품질 0.85(투명 이미지는 PNG)
 * - 원본 SHA-256(sourceHash)으로 중복 판정, 저장 바이트 SHA-256(contentHash)은 백업 무결성용
 * - 실제 디코딩으로 이미지 여부를 검증하며 Canvas 재인코딩으로 EXIF/GPS 등 메타데이터를 제거한다.
 * 해시·디코딩·압축은 DB 트랜잭션 밖에서 끝낸다(§8.1).
 */
import type { DraftImage } from "@/domain/entities";
import { ImageProcessingError, resizeAndEncode } from "@/infrastructure/image/compress";
import { sha256Hex } from "@/infrastructure/image/hash";

export const PROFILE_MAX_SIZE = 512;
export const MEMORY_MAX_LONG_SIDE = 1920;
/**
 * 원본 파일 크기 잠정 상한(메모리 보호). 명세상 실기기 검증 후 확정한다(ARCHITECTURE.md §17 "사진/ZIP 자원 제한").
 */
export const MAX_SOURCE_FILE_BYTES = 50 * 1024 * 1024;

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;
export const IMAGE_ACCEPT_ATTRIBUTE = "image/jpeg,image/png,image/webp,image/heic,image/heif";

export type ImagePrepareFailure = "unsupported-type" | "too-large" | "decode-failed" | "encode-failed";

export class ImagePrepareError extends Error {
  constructor(readonly reason: ImagePrepareFailure) {
    super(`이미지 처리 실패: ${reason}`);
    this.name = "ImagePrepareError";
  }
}

export function isAcceptedImageFile(file: File): boolean {
  return ACCEPTED_TYPES.has(file.type) || (file.type === "" && ACCEPTED_EXTENSIONS.test(file.name));
}

/** 원본 파일 SHA-256 (중복 사전 확인용). */
export function hashSourceFile(file: Blob): Promise<string> {
  return sha256Hex(file);
}

async function prepareImage(file: File, maxWidth: number, maxHeight: number, sourceHash?: string): Promise<DraftImage> {
  if (!isAcceptedImageFile(file)) throw new ImagePrepareError("unsupported-type");
  if (file.size > MAX_SOURCE_FILE_BYTES) throw new ImagePrepareError("too-large");
  try {
    const hash = sourceHash ?? (await sha256Hex(file));
    const encoded = await resizeAndEncode(file, maxWidth, maxHeight);
    const data = await encoded.blob.arrayBuffer();
    const contentHash = await sha256Hex(data);
    return { data, sourceHash: hash, contentHash, mimeType: encoded.mimeType, width: encoded.width, height: encoded.height, size: data.byteLength };
  } catch (error) {
    if (error instanceof ImageProcessingError) throw new ImagePrepareError(error.reason);
    throw error;
  }
}

export function prepareProfileImage(file: File): Promise<DraftImage> {
  return prepareImage(file, PROFILE_MAX_SIZE, PROFILE_MAX_SIZE);
}

export function prepareMemoryImage(file: File, sourceHash?: string): Promise<DraftImage> {
  return prepareImage(file, MEMORY_MAX_LONG_SIDE, MEMORY_MAX_LONG_SIDE, sourceHash);
}
