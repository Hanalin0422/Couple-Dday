/**
 * 확정 디자인용 Custom SVG 아이콘 (SKILL.md §5: 하단 메뉴 면형 톱니·하트·달력, 기본 프로필).
 * 기능 아이콘(편집, chevron 등)은 lucide-react 라운드 라인 아이콘을 사용한다.
 * 색상은 currentColor 또는 디자인 토큰 CSS 변수만 사용한다.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function gearPath(): string {
  const cx = 12;
  const cy = 12;
  const teeth = 8;
  const outer = 10.4;
  const inner = 7.9;
  const points: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const center = (i / teeth) * Math.PI * 2;
    const wOut = (Math.PI / teeth) * 0.42;
    const wIn = (Math.PI / teeth) * 0.62;
    for (const [angle, r] of [
      [center - wIn, inner],
      [center - wOut, outer],
      [center + wOut, outer],
      [center + wIn, inner],
    ] as const) {
      points.push(`${(cx + r * Math.cos(angle)).toFixed(2)} ${(cy + r * Math.sin(angle)).toFixed(2)}`);
    }
  }
  const hole = 3.3;
  return `M${points.join("L")}Z M${cx + hole} ${cy}a${hole} ${hole} 0 1 0 ${-2 * hole} 0a${hole} ${hole} 0 1 0 ${2 * hole} 0Z`;
}

const GEAR_PATH = gearPath();

export function GearFilledIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d={GEAR_PATH} fill="currentColor" fillRule="evenodd" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}

export function CalendarFilledIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M6.5 4.5h11A3.5 3.5 0 0 1 21 8v10a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 18V8a3.5 3.5 0 0 1 3.5-3.5ZM7 12h2.2v2.2H7Zm3.9 0h2.2v2.2h-2.2Zm3.9 0H17v2.2h-2.2ZM7 15.9h2.2v2.2H7Zm3.9 0h2.2v2.2h-2.2Z"
      />
      <rect x="6.6" y="2.2" width="2.2" height="4.6" rx="1.1" fill="currentColor" />
      <rect x="15.2" y="2.2" width="2.2" height="4.6" rx="1.1" fill="currentColor" />
    </svg>
  );
}

const HEART_PATH =
  "M12 20.6c-.4-.3-7.6-4.9-8.3-10.4C3.2 6.6 5.6 4 8.6 4c1.6 0 2.8.9 3.4 2.1C12.6 4.9 13.8 4 15.4 4c3 0 5.4 2.6 4.9 6.2-.7 5.5-7.9 10.1-8.3 10.4Z";

export function HeartFilledIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d={HEART_PATH} fill="currentColor" stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round" />
    </svg>
  );
}

/** 프로필 사이의 작은 하트 (시안: 라인 하트, accent). */
export function HeartOutlineIcon({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d={HEART_PATH} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

/** 기본 프로필 그래픽 (profile-*-bg 원 위 profile-*-icon 인물). 원형 클리핑은 ProfileAvatar 가 담당한다. */
export function DefaultProfileGraphic({ role }: { role: "self" | "partner" }) {
  const bg = role === "self" ? "var(--profile-self-bg)" : "var(--profile-partner-bg)";
  const fg = role === "self" ? "var(--profile-self-icon)" : "var(--profile-partner-icon)";
  return (
    <svg viewBox="0 0 76 76" width="100%" height="100%" aria-hidden="true">
      <rect width="76" height="76" fill={bg} />
      <circle cx="38" cy="30" r="11" fill={fg} />
      <path d="M17.5 59c0-11 9-16.5 20.5-16.5S58.5 48 58.5 59c0 1.4-1.1 2.5-2.5 2.5H20c-1.4 0-2.5-1.1-2.5-2.5Z" fill={fg} />
    </svg>
  );
}

/** 온보딩 상단 하트 그래픽과 작은 반짝임 (SKILL.md §6-1, 승인된 그래픽 예외). 앱 아이콘(src/app/icon.svg)과 같은 디자인. */
export function OnboardingHeartGraphic({ size = 64 }: { size?: number }) {
  return (
    <svg width={size * 1.25} height={size} viewBox="40 60 440 352" aria-hidden="true">
      <defs>
        <linearGradient id="obHeartFill" x1="0.2" y1="0.05" x2="0.8" y2="1">
          <stop offset="0" stopColor="#E7B4C2" />
          <stop offset="0.55" stopColor="#C98C9D" />
          <stop offset="1" stopColor="#B57889" />
        </linearGradient>
        <radialGradient id="obHeartShade" cx="0.5" cy="0.95" r="0.6">
          <stop offset="0" stopColor="#A16678" stopOpacity="0.45" />
          <stop offset="1" stopColor="#A16678" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="obGloss" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform="translate(244 268) scale(0.74) translate(-256 -257)">
        <path
          fill="url(#obHeartFill)"
          d="M256 438C240 426 88 330 72 206C62 128 116 76 178 76C216 76 242 98 256 124C270 98 296 76 334 76C396 76 450 128 440 206C424 330 272 426 256 438Z"
        />
        <path
          fill="url(#obHeartShade)"
          d="M256 438C240 426 88 330 72 206C62 128 116 76 178 76C216 76 242 98 256 124C270 98 296 76 334 76C396 76 450 128 440 206C424 330 272 426 256 438Z"
        />
        <ellipse cx="160" cy="150" rx="62" ry="38" transform="rotate(-32 160 150)" fill="url(#obGloss)" />
        <circle cx="214" cy="118" r="9" fill="#FFFFFF" fillOpacity="0.7" />
      </g>
      <path fill="#D9A3B3" d="M398 96C401 116 408 123 428 126C408 129 401 136 398 156C395 136 388 129 368 126C388 123 395 116 398 96Z" />
      <path fill="#E7C2CD" d="M436 168C438 178 441 181 451 183C441 185 438 188 436 198C434 188 431 185 421 183C431 181 434 178 436 168Z" />
    </svg>
  );
}
