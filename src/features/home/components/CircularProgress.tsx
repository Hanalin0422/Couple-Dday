/**
 * 원형 디데이 진행률 (SKILL.md §7-2, HOME-004).
 * 시안 기준 SVG 272×272, 반지름 121, 트랙 5(accent-soft), 진행선 7(accent). 12시 방향부터 시계 방향, 끝은 둥글게.
 * 컨테이너 크기에 맞춰 비례 조정된다(viewBox).
 */
const SIZE = 272;
const RADIUS = 121;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CircularProgress({ percentage }: { percentage: number }) {
  const clamped = Math.min(100, Math.max(0, percentage));
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 h-full w-full" aria-hidden="true" data-progress={clamped.toFixed(2)}>
      <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--accent-soft)" strokeWidth={5} />
      {clamped > 0 && (
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped / 100)}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      )}
    </svg>
  );
}
