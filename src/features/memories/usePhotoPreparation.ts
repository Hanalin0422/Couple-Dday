"use client";

/**
 * 선택한 사진을 저장 전에 미리 처리한다 (MEM-003, MEM-011, MEM-012, MEM-014, MEM-E02~E07, NFR-002).
 * - 한 장씩 해시 → 중복 확인(이미 담긴 사진·같은 선택 안) → 디코딩·압축(긴 변 1920px, EXIF 제거).
 * - 남은 자리(최대 5장)를 넘는 파일, 손상·지원하지 않는 파일, 중복은 사유와 함께 돌려주고 나머지는 저장 대기 목록에 담는다.
 * 실제 DB 저장은 사용자가 "저장"을 누를 때 saveMemory 로 한 번에 한다.
 */
import { useCallback, useState } from "react";
import type { DraftImage } from "@/domain/entities";
import { MemoryPolicyError } from "@/application/services/memories";
import { hashSourceFile, ImagePrepareError, prepareMemoryImage } from "@/application/services/image-preparation";
import { MAX_MEMORY_PHOTOS } from "@/application/validation/integrity";

export interface PreparedPhoto {
  key: string;
  name: string;
  image: DraftImage;
}

export interface PrepareFailure {
  name: string;
  reason: string;
}

/** 사용자 안내 문구 (개인 데이터 미포함). */
export function memoryErrorText(error: unknown): string {
  if (error instanceof MemoryPolicyError) {
    return {
      "future-occurrence": "아직 오지 않은 기념일이에요",
      "limit-reached": `최대 ${MAX_MEMORY_PHOTOS}장까지 추가할 수 있어요`,
      duplicate: "이미 추가한 사진이에요",
      "unknown-occurrence": "기념일을 찾을 수 없어요",
    }[error.reason];
  }
  if (error instanceof ImagePrepareError) {
    return { "unsupported-type": "지원하지 않는 형식이에요", "too-large": "파일이 너무 커요", "decode-failed": "사진을 읽을 수 없어요", "encode-failed": "사진을 변환하지 못했어요" }[error.reason];
  }
  const name = error instanceof Error ? error.name : "";
  if (name === "StorageError") {
    const kind = (error as { kind?: string }).kind;
    if (kind === "quota") return "저장 공간이 부족해요. 공간을 확보한 뒤 다시 시도해 주세요";
    if (kind === "constraint") return "이미 추가한 사진이에요";
  }
  if (name === "RevisionConflictError") return "다른 곳에서 정보가 바뀌었어요. 다시 시도해 주세요";
  if (name === "ValidationError") return "입력한 내용을 다시 확인해 주세요";
  return "저장하지 못했어요. 다시 시도해 주세요";
}

let keySeed = 0;

export function usePhotoPreparation() {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const prepare = useCallback(async (files: File[], currentHashes: readonly string[]): Promise<{ prepared: PreparedPhoto[]; failures: PrepareFailure[] }> => {
    const failures: PrepareFailure[] = [];
    const prepared: PreparedPhoto[] = [];
    const slots = Math.max(0, MAX_MEMORY_PHOTOS - currentHashes.length);
    const accepted = files.slice(0, slots);
    for (const file of files.slice(slots)) failures.push({ name: file.name, reason: `최대 ${MAX_MEMORY_PHOTOS}장까지 추가할 수 있어요` });
    const seen = new Set(currentHashes);
    setProgress({ done: 0, total: accepted.length });
    for (const [index, file] of accepted.entries()) {
      try {
        const sourceHash = await hashSourceFile(file);
        if (seen.has(sourceHash)) throw new MemoryPolicyError("duplicate");
        const image = await prepareMemoryImage(file, sourceHash);
        seen.add(sourceHash);
        keySeed += 1;
        prepared.push({ key: `new-${keySeed}`, name: file.name, image });
      } catch (error) {
        failures.push({ name: file.name, reason: memoryErrorText(error) });
      }
      setProgress({ done: index + 1, total: accepted.length });
    }
    setProgress(null);
    return { prepared, failures };
  }, []);

  return { prepare, progress };
}
