/**
 * 자동 일수 기념일 번호 판정: 10, 30, 50 또는 100의 배수 (ANN-001, ANN-002).
 */
import { AUTO_DAY_MILESTONES_BEFORE_100, AUTO_DAY_MILESTONE_STEP } from "./generator";

export function isAutoDayMilestoneNumber(days: number): boolean {
  return (AUTO_DAY_MILESTONES_BEFORE_100 as readonly number[]).includes(days) || (days > 0 && days % AUTO_DAY_MILESTONE_STEP === 0);
}
