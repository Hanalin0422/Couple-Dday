"use client";

/**
 * 공통 UI 기본 요소: Button, Card, PageHeader, SegmentedControl, MenuRow (SKILL.md §5).
 * 수치: 화면 좌우 24px, 카드 모서리 20px·내부 여백 20px, 주요 버튼 56px, 메뉴 행 52~56px.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronRight } from "lucide-react";

function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export { cx };

type ButtonVariant = "primary" | "text" | "danger-text";

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
        variant === "primary" &&
          "h-14 w-full rounded-2xl bg-accent text-[16px] font-semibold text-surface disabled:bg-accent-soft disabled:text-accent/50",
        variant === "text" && "min-h-11 px-3 text-[14px] font-medium text-text-secondary disabled:text-text-inactive",
        variant === "danger-text" && "min-h-11 px-3 text-[14px] font-medium text-danger",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-card bg-surface p-5", className)}>{children}</section>;
}

/** 온보딩/설정/기념일 공통 페이지 제목: 마루 부리 28px 600, 왼쪽 정렬, 좌우 24px (SKILL.md §4). */
export function PageHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-center justify-between px-gutter pb-4 pt-[calc(env(safe-area-inset-top)+20px)]">
      <h1 className="font-maruburi text-[28px] font-semibold leading-[1.35] text-text-primary">{title}</h1>
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
    <div role="radiogroup" aria-label={label} className="flex h-12 rounded-[14px] bg-input p-1">
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
              "flex-1 rounded-[10px] text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-accent",
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
      className="flex h-[52px] w-full items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-accent"
    >
      {icon}
      <span className={cx("flex-1 text-[16px] font-medium", tone === "danger" ? "text-danger" : "text-text-body")}>{label}</span>
      {value !== undefined && <span className="max-w-[55%] truncate text-[15px] text-text-secondary">{value}</span>}
      {chevron && <ChevronRight size={18} className="shrink-0 text-icon-inactive" aria-hidden="true" />}
    </button>
  );
}
