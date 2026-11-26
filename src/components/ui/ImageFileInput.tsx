"use client";

/**
 * 숨김 사진 선택 입력. open() 은 사용자 터치 이벤트 안에서 호출해야 한다(iOS).
 * 선택 취소 시 아무것도 바꾸지 않는다(ONB-E03, MEM-E01). 처리 중 중복 실행을 막는다.
 */
import { forwardRef, useImperativeHandle, useRef } from "react";
import type { DraftImage } from "@/domain/entities";
import { IMAGE_ACCEPT_ATTRIBUTE, prepareProfileImage } from "@/application/services/image-preparation";

export interface ImageFileInputHandle {
  open: () => void;
}

export const ImageFileInput = forwardRef<
  ImageFileInputHandle,
  { onImage: (image: DraftImage) => void; onError: (error: unknown) => void; onBusyChange?: (busy: boolean) => void }
>(function ImageFileInput({ onImage, onError, onBusyChange }, ref) {
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  useImperativeHandle(ref, () => ({ open: () => !busy.current && input.current?.click() }), []);
  return (
    <input
      ref={input}
      type="file"
      accept={IMAGE_ACCEPT_ATTRIBUTE}
      className="hidden"
      data-testid="image-file-input"
      onChange={async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        busy.current = true;
        onBusyChange?.(true);
        try {
          onImage(await prepareProfileImage(file));
        } catch (error) {
          onError(error);
        } finally {
          busy.current = false;
          onBusyChange?.(false);
        }
      }}
    />
  );
});
