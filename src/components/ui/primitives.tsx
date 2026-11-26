"use client";

/**
 * 공통 UI 기본 요소: Button, Card, PageHeader, SegmentedControl, MenuRow (SKILL.md §5).
 * 모든 크기는 공통 반응형 토큰(src/styles/tokens.css .app-scale)을 사용한다.
 * 시안 기준: 화면 좌우 24px, 카드 모서리 20px·내부 여백 20px, 주요 버튼 56px, 메뉴 행 52px, 터치 영역 최소 44px.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronRight } from "lucide-react";

function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export { cx };

/**
 * 버튼 종류. 색상은 className 으로 덧씌우지 않고 종류로만 지정한다(유틸리티 충돌로 글씨·배경색이 뒤바뀌는 문제 방지).
 * - primary: accent 배경 / danger: danger 배경(되돌릴 수 없는 삭제 확인) / danger-soft: input 배경 + danger 글씨(보조 삭제)
 * - text / accent-text / danger-text: 글씨 버튼
 */
type ButtonVariant = "primary" | "danger" | "danger-soft" | "text" | "accent-text" | "danger-text";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={cx(
        "select-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        (variant === "primary" || variant === "danger" || variant === "danger-soft") && "h-button w-full rounded-button text-ui-body font-semibold",
        variant === "primary" && "bg-accent text-surface disabled:bg-accent-soft disabled:text-accent/50",
        variant === "danger" && "bg-danger text-surface disabled:opacity-50",
        variant === "danger-soft" && "bg-input text-danger disabled:opacity-50",
        (variant === "text" || variant === "accent-text" || variant === "danger-text") && "min-h-touch px-3 text-ui-caption font-medium disabled:text-text-inactive",
        variant === "text" && "text-text-secondary",
        variant === "accent-text" && "text-accent",
        variant === "danger-text" && "text-danger",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-card bg-surface p-(--card-padding)", className)}>{children}</section>;
}

/** 온보딩/설정/기념일 공통 페이지 제목: 마루 부리 28px 600, 왼쪽 정렬, 좌우 24px (SKILL.md §4). 상단 Safe Area 는 AppFrame 이 반영한다. */
export function PageHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex shrink-0 items-center justify-between px-gutter pb-4 pt-5">
      <h1 className="font-maruburi text-ui-title font-semibold leading-[1.35] text-text-primary">{title}</h1>
      {action}
    </header>
  );
}

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
}

/** 선택 영역은 흰색, 나머지는 input 색상 (SKILL.md §6-7, §8-2, §9). */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  disabled,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-segment rounded-control bg-input p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => !selected && onChange(option.value)}
            className={cx(
              "flex-1 rounded-segment text-ui-body-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent",
              selected ? "bg-surface font-semibold text-text-primary" : "font-medium text-text-secondary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** 카드 내부 메뉴 행: 왼쪽 라벨, 오른쪽 현재 값과 chevron. 행 사이 구분선 없음 (SKILL.md §8). */
export function MenuRow({
  label,
  value,
  icon,
  onClick,
  tone = "default",
  chevron = true,
}: {
  label: string;
  value?: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  tone?: "default" | "danger";
  chevron?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-row w-full items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-accent"
    >
      {icon}
      <span className={cx("flex-1 text-ui-body font-medium", tone === "danger" ? "text-danger" : "text-text-body")}>{label}</span>
      {value !== undefined && <span className="max-w-[55%] truncate text-ui-body-sm text-text-secondary">{value}</span>}
      {chevron && <ChevronRight className="size-4.5 shrink-0 text-icon-inactive" aria-hidden="true" />}
    </button>
  );
}
