"use client";

/**
 * 공통 Bottom Sheet (REQUIREMENTS.md §14 BTS-001~015, SKILL.md §5 모서리 24~28px).
 *
 * - 하단에서 위로 표시, 배경 dim, 배경 터치·스크롤 차단, 상단 핸들, 핸들 아래 스와이프로 닫기
 * - 변경 사항이 있으면 모든 닫기 경로(배경 터치·스와이프·취소·Esc)에서 취소 확인 (BTS-014)
 * - 처리 중(busy)에는 닫기 제한 (BTS-015), 긴 내용은 Sheet 내부만 스크롤 (BTS-007), Safe Area 반영 (BTS-011)
 * - 동시에 하나만 표시 (BTS-010): ui-store.activeSheet 로 관리
 *
 * 세부 픽셀(핸들 32×4, 제목 20px/600, 상단 모서리 24px)은 REQUIREMENTS.md §14의 이전 제안 수치를 공통 반응형 토큰으로 잠정 적용한다.
 */
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { OVERLAY_ROOT_ID } from "@/components/layout/AppFrame";
import { useIsClient } from "@/hooks/useIsClient";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "./primitives";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** undefined: 기본 닫기 버튼, null: 하단 영역 없음(본문에서 직접 버튼 배치) */
  footer?: ReactNode;
  /** 입력 변경 여부 (닫기 시 취소 확인) */
  dirty?: boolean;
  /** 저장/복원 처리 중 (닫기 제한) */
  busy?: boolean;
}

/** Sheet 안의 취소 버튼이 공통 닫기 경로(변경 사항 확인·처리 중 제한)를 따르도록 제공한다 (BTS-014). */
const SheetCloseContext = createContext<() => void>(() => undefined);

export function useSheetClose(): () => void {
  return useContext(SheetCloseContext);
}

/** 공통 닫기 경로를 따르는 취소 버튼. */
export function SheetCancelButton({ label = "취소", disabled, variant = "text" }: { label?: string; disabled?: boolean; variant?: "text" | "primary" }) {
  const requestClose = useSheetClose();
  return (
    <Button variant={variant} onClick={requestClose} disabled={disabled}>
      {label}
    </Button>
  );
}

const CLOSE_DRAG_OFFSET = 96;
const CLOSE_DRAG_VELOCITY = 600;

export function BottomSheet({ open, onClose, title, description, children, footer, dirty = false, busy = false }: BottomSheetProps) {
  const sheetId = useId();
  const titleId = useId();
  const openSheet = useUIStore((s) => s.openSheet);
  const closeSheet = useUIStore((s) => s.closeSheet);
  const activeSheet = useUIStore((s) => s.activeSheet);
  const dragControls = useDragControls();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const mounted = useIsClient();

  // 열릴 때 다른 Sheet 를 대체하고(중첩 없음), 닫힐 때 등록 해제
  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openSheet(sheetId);
    const raf = requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      closeSheet(sheetId);
      setConfirmingDiscard(false);
      restoreFocus.current?.focus?.();
    };
  }, [open, sheetId, openSheet, closeSheet]);

  // 이 Sheet 가 활성화된 뒤 다른 Sheet 가 열리면 이 Sheet 는 닫는다(중첩 없음).
  // 활성화 전의 이전 값(직전에 닫힌 Sheet)으로 잘못 닫지 않도록 활성화 여부를 기록한다.
  const wasActive = useRef(false);
  useEffect(() => {
    if (!open) {
      wasActive.current = false;
      return;
    }
    if (activeSheet === sheetId) wasActive.current = true;
    else if (wasActive.current && activeSheet !== null) {
      wasActive.current = false;
      onClose();
    }
  }, [activeSheet, open, sheetId, onClose]);

  const requestClose = useCallback(() => {
    if (busy) return;
    if (dirty) {
      setConfirmingDiscard(true);
      return;
    }
    onClose();
  }, [busy, dirty, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > CLOSE_DRAG_OFFSET || info.velocity.y > CLOSE_DRAG_VELOCITY) requestClose();
  };

  if (!mounted) return null;

  return createPortal(
    <SheetCloseContext.Provider value={requestClose}>
    <AnimatePresence>
      {open && (
        <div className="absolute inset-0" data-testid="bottom-sheet">
          <motion.div
            className="absolute inset-0 bg-text-primary/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={requestClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 flex max-h-[90%] flex-col rounded-t-sheet bg-surface outline-none"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            <div
              className="flex shrink-0 touch-none justify-center pb-2 pt-3"
              onPointerDown={(event) => dragControls.start(event)}
              aria-hidden="true"
            >
              <span className="h-1 w-8 rounded-full bg-icon-inactive/50" />
            </div>
            {confirmingDiscard ? (
              <div className="px-gutter pb-[calc(env(safe-area-inset-bottom)+16*var(--u))] pt-2">
                <h2 className="text-ui-sheet-title font-semibold leading-snug text-text-primary">변경 사항을 취소할까요?</h2>
                <p className="mt-2 text-ui-caption text-text-secondary">입력한 내용은 저장되지 않아요.</p>
                <div className="mt-6 flex flex-col gap-2">
                  <Button onClick={onClose}>취소하기</Button>
                  <Button variant="text" onClick={() => setConfirmingDiscard(false)}>
                    계속 편집하기
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter pt-2">
                  {title && (
                    <h2 id={titleId} className="text-ui-sheet-title font-semibold leading-snug text-text-primary">
                      {title}
                    </h2>
                  )}
                  {description && <div className="mt-2 text-ui-caption leading-relaxed text-text-secondary">{description}</div>}
                  {children && <div className={title || description ? "mt-6" : undefined}>{children}</div>}
                </div>
                {footer !== null && (
                  <div className="shrink-0 px-gutter pb-[calc(env(safe-area-inset-bottom)+16*var(--u))] pt-4">
                    {footer ?? (
                      <Button variant="text" className="w-full" onClick={requestClose} disabled={busy}>
                        닫기
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </SheetCloseContext.Provider>,
    // 앱 프레임 내부 overlay 영역에 렌더링하여 공통 반응형 토큰과 폭 제한을 상속한다.
    document.getElementById(OVERLAY_ROOT_ID) ?? document.body,
  );
}

/** 확인 Sheet (ConfirmSheet): 시작일/계산 방식 변경 안내, 삭제 확인 등. 실패 시 Sheet 를 유지하고 오류를 표시한다. */
export function ConfirmSheet({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel = "취소",
  tone = "primary",
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setError(null);
    onClose();
  };
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <BottomSheet
      open={open}
      onClose={close}
      busy={busy}
      title={title}
      description={description}
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="pb-2 text-center text-ui-caption text-danger">
              {error}
            </p>
          )}
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={confirm} disabled={busy}>
            {confirmLabel}
          </Button>
          <SheetCancelButton label={cancelLabel} disabled={busy} />
        </div>
      }
    />
  );
}

/** 저장 실패 안내 문구 (개인 데이터 미포함). */
export function errorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "RevisionConflictError") return "다른 곳에서 정보가 바뀌었어요. 다시 시도해 주세요.";
  if (name === "ValidationError") return "입력한 내용을 다시 확인해 주세요.";
  if (name === "StorageError" && (error as { kind?: string }).kind === "quota") return "저장 공간이 부족해요. 공간을 확보한 뒤 다시 시도해 주세요.";
  return "저장하지 못했어요. 다시 시도해 주세요.";
}
