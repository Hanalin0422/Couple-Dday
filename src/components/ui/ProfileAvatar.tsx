"use client";

/**
 * 원형 프로필 (SKILL.md §6-4, §7-4, §8-1). 사진이 없으면 지정 기본 프로필을 표시한다(ONB-004).
 * badge: 온보딩은 + 아이콘, 설정은 카메라 아이콘(우측 하단).
 */
import { Camera, Plus } from "lucide-react";
import { useObjectUrl, type StoredImage } from "@/hooks/useObjectUrl";
import { DefaultProfileGraphic } from "./icons";

export function ProfileAvatar({
  role,
  photo,
  size,
  badge,
  onClick,
  label,
}: {
  role: "self" | "partner";
  photo: StoredImage | null | undefined;
  /** px 또는 CSS 길이 */
  size: number | string;
  badge?: "plus" | "camera";
  onClick?: () => void;
  label: string;
}) {
  const url = useObjectUrl(photo);
  const dimension = typeof size === "number" ? `${size}px` : size;
  const content = (
    <span className="relative block" style={{ width: dimension, height: dimension }}>
      <span className="block h-full w-full overflow-hidden rounded-full">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- 로컬 Blob 객체 URL 은 next/image 최적화 대상이 아니다.
          <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <DefaultProfileGraphic role={role} />
        )}
      </span>
      {badge && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-surface text-text-secondary">
          {badge === "plus" ? <Plus size={16} strokeWidth={2.4} aria-hidden="true" /> : <Camera size={14} strokeWidth={2.2} aria-hidden="true" />}
        </span>
      )}
    </span>
  );
  if (!onClick) return <span aria-label={label} role="img">{content}</span>;
  return (
    <button type="button" onClick={onClick} aria-label={label} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      {content}
    </button>
  );
}
