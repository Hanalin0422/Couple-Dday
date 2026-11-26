/**
 * 이미지 디코딩·리사이즈·재인코딩 (ARCHITECTURE.md §9, ARC-B07, MEM-006, MEM-014, MEM-015).
 *
 * - 실제 디코딩으로 이미지 여부를 검증한다(확장자/MIME 만 신뢰하지 않음). HEIC 는 브라우저가 디코딩할 수 있을 때만 처리한다.
 * - EXIF 방향을 반영해 그린 뒤 Canvas 로 재인코딩하므로 EXIF/GPS 등 메타데이터가 제거된다.
 * - 작은 이미지는 확대하지 않는다. 투명도가 있으면 PNG, 아니면 JPEG(품질 0.85).
 * - 사용한 ImageBitmap·객체 URL 은 즉시 해제한다(NFR-002).
 */
export const JPEG_QUALITY = 0.85;

export type ImageFailure = "decode-failed" | "encode-failed";

export class ImageProcessingError extends Error {
  constructor(readonly reason: ImageFailure) {
    super(reason === "decode-failed" ? "이미지를 읽을 수 없습니다." : "이미지를 변환할 수 없습니다.");
    this.name = "ImageProcessingError";
  }
}

export interface EncodedImage {
  blob: Blob;
  mimeType: "image/jpeg" | "image/png";
  width: number;
  height: number;
}

interface Drawable {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decode(file: Blob): Promise<Drawable> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // 일부 Safari 버전은 HEIC 등을 createImageBitmap 으로 열지 못하므로 <img> 디코딩으로 재시도한다.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error("empty image");
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => undefined };
  } catch {
    throw new ImageProcessingError("decode-failed");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 최대 박스 안에 비율을 유지해 맞춘 크기. 확대하지 않는다. */
export function fitWithin(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new ImageProcessingError("encode-failed"))), type, quality);
  });
}

export async function resizeAndEncode(file: Blob, maxWidth: number, maxHeight: number): Promise<EncodedImage> {
  const drawable = await decode(file);
  try {
    const { width, height } = fitWithin(drawable.width, drawable.height, maxWidth, maxHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageProcessingError("encode-failed");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(drawable.source, 0, 0, width, height);
    const transparent = file.type !== "image/jpeg" && hasTransparency(ctx, width, height);
    const mimeType = transparent ? "image/png" : "image/jpeg";
    const blob = await toBlob(canvas, mimeType, transparent ? undefined : JPEG_QUALITY);
    canvas.width = 0;
    canvas.height = 0;
    return { blob, mimeType, width, height };
  } finally {
    drawable.release();
  }
}

/** 실제 디코딩 가능 여부 (복원 시 이미지 검증, ARCHITECTURE.md §11.1-4). */
export async function canDecodeImage(data: ArrayBuffer, mimeType: string): Promise<boolean> {
  try {
    const drawable = await decode(new Blob([data], { type: mimeType }));
    drawable.release();
    return true;
  } catch {
    return false;
  }
}
