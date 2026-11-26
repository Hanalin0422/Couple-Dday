"use client";

/**
 * 기념일 화면 (SKILL.md §9). 제목 "우리의 기념일"과 우측 + 아이콘.
 * 필터·타임라인·기념일 추가는 ARCHITECTURE.md §16 5단계(Phase 5)에서 구현한다.
 */
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";

export function AnniversaryScreen() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="우리의 기념일"
        action={
          <button type="button" aria-label="기념일 추가" className="flex size-touch items-center justify-center text-text-body" disabled>
            <Plus className="size-6" aria-hidden="true" />
          </button>
        }
      />
    </div>
  );
}
