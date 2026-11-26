"use client";

/**
 * 두 사람의 프로필과 작은 하트 (SKILL.md §7-4, HOME-006, HOME-007). 사진이 없으면 기본 프로필.
 */
import { HeartOutlineIcon } from "@/components/ui/icons";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import type { Couple, Photo } from "@/domain/entities";
import { usePhoto } from "@/hooks/useDatabase";

/** 시안: 사진 76px, 이름 16px/600, 사진-이름 간격 8px (공통 반응형 단위). */
export function CoupleProfiles({ couple }: { couple: Couple }) {
  const myPhoto = usePhoto(couple.myPhotoId);
  const partnerPhoto = usePhoto(couple.partnerPhotoId);
  const person = (role: "self" | "partner", name: string, image: Photo | null | undefined) => (
    <div className="flex w-33 flex-col items-center gap-2">
      <ProfileAvatar role={role} photo={image} size={76} label={`${name} 프로필`} />
      <p className="w-full break-keep text-center [overflow-wrap:anywhere] text-ui-body font-semibold leading-snug text-text-primary" data-testid={`name-${role}`}>
        {name}
      </p>
    </div>
  );
  return (
    <div className="flex items-start justify-center">
      {person("self", couple.myName, myPhoto)}
      <span className="flex h-19 items-center text-accent">
        <HeartOutlineIcon className="size-3.5" />
      </span>
      {person("partner", couple.partnerName, partnerPhoto)}
    </div>
  );
}
