/**
 * 프로필 사진 준비 (ONB-004, SET-003, ARC-B07: 512×512 이내, JPEG 0.85).
 * 해시·디코딩·압축은 DB 트랜잭션 밖에서 끝낸다(§8.1).
 */
import type { DraftImage } from "@/domain/entities";
import { ImageProcessingError, resizeAndEncode } from "@/infrastructure/image/compress";
import { sha256Hex } from "@/infrastructure/image/hash";

export const PROFILE_MAX_SIZE = 512;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;
export const IMAGE_ACCEPT_ATTRIBUTE = "image/jpeg,image/png,image/webp,image/heic,image/heif";

export type ImagePrepareFailure = "unsupported-type" | "decode-failed" | "encode-failed";

export class ImagePrepareError extends Error {
  constructor(readonly reason: ImagePrepareFailure) {
    super(`이미지 처리 실패: ${reason}`);
    this.name = "ImagePrepareError";
  }
}

export function isAcceptedImageFile(file: File): boolean {
  return ACCEPTED_TYPES.has(file.type) || (file.type === "" && ACCEPTED_EXTENSIONS.test(file.name));
}

export async function prepareProfileImage(file: File): Promise<DraftImage> {
  if (!isAcceptedImageFile(file)) throw new ImagePrepareError("unsupported-type");
  try {
    const sourceHash = await sha256Hex(file);
    const encoded = await resizeAndEncode(file, PROFILE_MAX_SIZE, PROFILE_MAX_SIZE);
    const data = await encoded.blob.arrayBuffer();
    const contentHash = await sha256Hex(data);
    return {
      data,
      sourceHash,
      contentHash,
      mimeType: encoded.mimeType,
      width: encoded.width,
      height: encoded.height,
      size: data.byteLength,
    };
  } catch (error) {
    if (error instanceof ImageProcessingError) throw new ImagePrepareError(error.reason);
    throw error;
  }
}
