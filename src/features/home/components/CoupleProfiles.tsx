"use client";

/**
 * 두 사람의 프로필과 작은 하트 (SKILL.md §7-4, HOME-006, HOME-007). 사진이 없으면 기본 프로필.
 */
import { HeartOutlineIcon } from "@/components/ui/icons";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import type { Couple, Photo } from "@/domain/entities";
import { usePhoto } from "@/hooks/useDatabase";

export function CoupleProfiles({ couple, size }: { couple: Couple; size: string }) {
  const myPhoto = usePhoto(couple.myPhotoId);
  const partnerPhoto = usePhoto(couple.partnerPhotoId);
  const person = (role: "self" | "partner", name: string, image: Photo | null | undefined) => (
    <div className="flex w-[132px] flex-col items-center gap-2">
      <ProfileAvatar role={role} photo={image} size={size} label={`${name} 프로필`} />
      <p className="break-keep text-center text-[16px] font-semibold leading-snug text-text-primary" data-testid={`name-${role}`}>
        {name}
      </p>
    </div>
  );
  return (
    <div className="flex items-start justify-center">
      {person("self", couple.myName, myPhoto)}
      <span className="flex text-accent" style={{ height: size, alignItems: "center" }}>
        <HeartOutlineIcon size={14} />
      </span>
      {person("partner", couple.partnerName, partnerPhoto)}
    </div>
  );
}
