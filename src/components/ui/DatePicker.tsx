"use client";

/**
 * 공통 날짜 선택 Bottom Sheet (DATE-001~008, DATE-E06). 온보딩과 설정에서 같은 컴포넌트를 사용한다.
 * - max(오늘) 이후 날짜는 비활성, max 의 월 이후로 이동 불가. min 이전 날짜 비활성(사용자 지정 기념일용).
 * - 열 때마다 전달받은 오늘 날짜 기준으로 범위를 갱신한다. 취소 시 기존 값 유지.
 * - 연·월 빠른 선택 보기 제공 (상세 UI 미확정, 사용자 검수 대상).
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { LocalDate } from "@/domain/entities";
import { BottomSheet, SheetCancelButton } from "./BottomSheet";
import { Button, cx } from "./primitives";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MIN_YEAR = 1900;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // month: 1~12
}

function firstWeekday(year: number, month: number): number {
  const date = new Date(2000, 0, 1);
  date.setFullYear(year, month - 1, 1);
  return date.getDay();
}

function parts(date: LocalDate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

export function DatePicker({
  open,
  onClose,
  onConfirm,
  value,
  max,
  min,
  today,
  title = "날짜 선택",
  confirmLabel = "선택",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (date: LocalDate) => void;
  value: LocalDate | null;
  max: LocalDate;
  min?: LocalDate;
  /** 오늘 표시 기준. 생략 시 max(시작일 선택처럼 오늘까지만 선택하는 경우) */
  today?: LocalDate;
  title?: string;
  confirmLabel?: string;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title} footer={null}>
      {open && <DatePickerPanel key={`${value}|${max}|${min}`} value={value} max={max} min={min} today={today} onConfirm={onConfirm} confirmLabel={confirmLabel} />}
    </BottomSheet>
  );
}

/**
 * 날짜 선택 패널. 다른 Sheet 안에서 Sheet 를 중첩하지 않고 같은 Sheet 의 단계로 쓸 때 사용한다(BTS-010).
 * onCancel 을 생략하면 Sheet 의 공통 닫기 경로를 사용한다.
 */
export function DatePickerPanel({
  value,
  max,
  min,
  today,
  onConfirm,
  onCancel,
  confirmLabel = "선택",
}: {
  value: LocalDate | null;
  max: LocalDate;
  min?: LocalDate;
  today?: LocalDate;
  onConfirm: (date: LocalDate) => void;
  onCancel?: () => void;
  confirmLabel?: string;
}) {
  const maxParts = parts(max);
  const todayMark = today ?? max;
  const clamp = (date: LocalDate) => (date > max ? max : min && date < min ? min : date);
  const initial = parts(clamp(value ?? todayMark));
  const [view, setView] = useState<{ year: number; month: number }>({ year: initial.year, month: initial.month });
  const [mode, setMode] = useState<"days" | "years" | "months">("days");
  const [selected, setSelected] = useState<LocalDate | null>(value && value <= max && (!min || value >= min) ? value : null);
  const minYear = min ? parts(min).year : MIN_YEAR;

  const canPrev = view.year > minYear || (view.year === minYear && (!min || view.month > parts(min).month));
  const canNext = view.year < maxParts.year || (view.year === maxParts.year && view.month < maxParts.month);
  const move = (delta: number) => {
    const index = view.year * 12 + (view.month - 1) + delta;
    setView({ year: Math.floor(index / 12), month: (index % 12) + 1 });
  };

  const cells = useMemo(() => {
    const blanks = firstWeekday(view.year, view.month);
    const total = daysInMonth(view.year, view.month);
    return [
      ...Array.from({ length: blanks }, () => null),
      ...Array.from({ length: total }, (_, i) => `${String(view.year).padStart(4, "0")}-${pad(view.month)}-${pad(i + 1)}`),
    ];
  }, [view]);

  const years = useMemo(() => Array.from({ length: maxParts.year - minYear + 1 }, (_, i) => maxParts.year - i), [maxParts.year, minYear]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMode(mode === "days" ? "years" : "days")}
          className="flex min-h-touch items-center gap-1 text-ui-section font-semibold text-text-primary"
          aria-expanded={mode !== "days"}
        >
          {view.year}년 {view.month}월
          <ChevronDown className={cx("size-4.5 text-text-secondary transition-transform", mode !== "days" && "rotate-180")} aria-hidden="true" />
        </button>
        {mode === "days" && (
          <div className="flex">
            <button type="button" aria-label="이전 달" disabled={!canPrev} onClick={() => move(-1)} className="flex size-touch items-center justify-center text-text-body disabled:text-icon-inactive">
              <ChevronLeft className="size-5.5" aria-hidden="true" />
            </button>
            <button type="button" aria-label="다음 달" disabled={!canNext} onClick={() => move(1)} className="flex size-touch items-center justify-center text-text-body disabled:text-icon-inactive">
              <ChevronRight className="size-5.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {mode === "days" && (
        <div className="mt-3" role="grid" aria-label={`${view.year}년 ${view.month}월`}>
          <div className="grid grid-cols-7 text-center text-ui-caption-sm text-text-secondary">
            {WEEKDAYS.map((w) => (
              <span key={w} className="py-2">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((date, index) => {
              if (!date) return <span key={`b${index}`} />;
              const disabled = date > max || (min !== undefined && date < min);
              const isSelected = date === selected;
              const isToday = date === todayMark;
              return (
                <button
                  key={date}
                  type="button"
                  disabled={disabled}
                  aria-pressed={isSelected}
                  aria-label={date}
                  onClick={() => setSelected(date)}
                  className="flex h-touch items-center justify-center"
                >
                  <span
                    className={cx(
                      "flex size-10 items-center justify-center rounded-full text-ui-body",
                      isSelected && "bg-accent font-semibold text-surface",
                      !isSelected && disabled && "text-text-inactive/50",
                      !isSelected && !disabled && (isToday ? "font-semibold text-accent" : "text-text-body"),
                    )}
                  >
                    {Number(date.slice(8))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mode === "years" && (
        <div className="mt-3 grid max-h-75 grid-cols-4 gap-2 overflow-y-auto" role="listbox" aria-label="연도 선택">
          {years.map((year) => (
            <button
              key={year}
              type="button"
              role="option"
              aria-selected={year === view.year}
              onClick={() => {
                setView({ year, month: year === maxParts.year ? Math.min(view.month, maxParts.month) : view.month });
                setMode("months");
              }}
              className={cx("h-touch rounded-xl text-ui-body-sm", year === view.year ? "bg-accent font-semibold text-surface" : "bg-input text-text-body")}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {mode === "months" && (
        <div className="mt-3 grid grid-cols-4 gap-2" role="listbox" aria-label="월 선택">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
            const disabled =
              (view.year === maxParts.year && month > maxParts.month) || (min !== undefined && view.year === parts(min).year && month < parts(min).month);
            return (
              <button
                key={month}
                type="button"
                role="option"
                aria-selected={month === view.month}
                disabled={disabled}
                onClick={() => {
                  setView({ year: view.year, month });
                  setMode("days");
                }}
                className={cx(
                  "h-touch rounded-xl text-ui-body-sm disabled:text-text-inactive/50",
                  month === view.month ? "bg-accent font-semibold text-surface" : "bg-input text-text-body",
                )}
              >
                {month}월
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2 pb-[calc(env(safe-area-inset-bottom)+16*var(--u))]">
        <Button disabled={!selected || selected > max} onClick={() => selected && onConfirm(selected)}>
          {confirmLabel}
        </Button>
        {onCancel ? (
          <Button variant="text" onClick={onCancel}>
            취소
          </Button>
        ) : (
          <SheetCancelButton />
        )}
      </div>
    </div>
  );
}
