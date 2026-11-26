"use client";

/**
 * 텍스트 입력 (SKILL.md §6-5: input 색상 영역, placeholder).
 * 최대 글자 수를 사용자 인식 문자 기준으로 제한하되 한글 IME 조합 중에는 자르지 않고 조합 완료 시 적용한다 (ONB-E02).
 * 16px 이상 글자 크기로 iOS 확대를 막는다.
 */
import { useId, useRef } from "react";
import { truncateToMaxCharacters } from "@/domain/policies/text-rules";

export function TextField({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  autoFocus,
  hideLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  autoFocus?: boolean;
  hideLabel?: boolean;
}) {
  const id = useId();
  const composing = useRef(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-[14px] font-medium text-text-body"}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="done"
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          onChange(truncateToMaxCharacters(event.currentTarget.value, maxLength));
        }}
        onChange={(event) => {
          const next = event.target.value;
          onChange(composing.current ? next : truncateToMaxCharacters(next, maxLength));
        }}
        className="h-[52px] w-full rounded-[14px] bg-input px-4 text-[16px] font-medium text-text-primary outline-none placeholder:text-text-inactive focus-visible:outline-2 focus-visible:outline-accent"
      />
    </div>
  );
}
