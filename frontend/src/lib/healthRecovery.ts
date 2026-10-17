import { differenceInDays } from "date-fns";

export type HealthMetricKey = "oxygen" | "lung" | "circulation" | "heart";

export interface HealthRecoveryInput {
  cigarettesPerDay?: number | null;
  yearsSmoked?: number | null;
}

export interface HealthMetric {
  key: HealthMetricKey;
  label: string;
  value: number;
  base: number;
  description: string;
}

export interface HealthRecoverySnapshot {
  daysSinceQuit: number;
  packYears: number;
  smokingIntensity: number;
  fullRecoveryDays: number;
  overallRecoveryPct: number;
  metrics: HealthMetric[];
}

const METRIC_META: Record<
  HealthMetricKey,
  { label: string; description: string; baseAtIntensity0: number; baseRange: number }
> = {
  oxygen: {
    label: "Oxygen Level",
    description: "Blood oxygen and CO clearance",
    baseAtIntensity0: 82,
    baseRange: 24,
  },
  lung: {
    label: "Lung Capacity",
    description: "Improving breathing and oxygen intake",
    baseAtIntensity0: 60,
    baseRange: 30,
  },
  circulation: {
    label: "Circulation",
    description: "Better blood flow and heart health",
    baseAtIntensity0: 72,
    baseRange: 24,
  },
  heart: {
    label: "Heart Health",
    description: "Cardiovascular recovery and stamina",
    baseAtIntensity0: 68,
    baseRange: 28,
  },
};

export function getDaysSinceQuit(quitDate: Date | string | null | undefined): number {
  if (!quitDate) return 0;
  const qd = typeof quitDate === "string" ? new Date(quitDate) : quitDate;
  if (Number.isNaN(qd.getTime())) return 0;
  return Math.max(0, differenceInDays(new Date(), qd));
}

export function computePackYears(cigarettesPerDay: number, yearsSmoked: number): number {
  return (cigarettesPerDay / 20) * yearsSmoked;
}

export function computeSmokingIntensity(packYears: number): number {
  return Math.min(packYears / 40, 1);
}

export function computeFullRecoveryDays(packYears: number): number {
  const cappedPY = Math.min(packYears, 40);
  return Math.round(180 + (cappedPY / 40) * 1280);
}

export function calcMetric(
  damagedBase: number,
  fullRecoveryDays: number,
  currentDays: number,
): number {
  const progress = Math.min(currentDays / fullRecoveryDays, 1);
  return Math.round(damagedBase + (100 - damagedBase) * progress);
}

function metricBase(intensity: number, key: HealthMetricKey): number {
  const meta = METRIC_META[key];
  return Math.round(meta.baseAtIntensity0 - intensity * meta.baseRange);
}

export function computeHealthRecovery(
  input: HealthRecoveryInput,
  daysSinceQuit: number,
): HealthRecoverySnapshot {
  const cigs = Number(input.cigarettesPerDay ?? 20);
  const years = Number(input.yearsSmoked ?? 5);
  const packYears = computePackYears(cigs, years);
  const smokingIntensity = computeSmokingIntensity(packYears);
  const fullRecoveryDays = computeFullRecoveryDays(packYears);
  const overallRecoveryPct = Math.round(
    Math.min(daysSinceQuit / fullRecoveryDays, 1) * 100,
  );

  const metrics: HealthMetric[] = (Object.keys(METRIC_META) as HealthMetricKey[]).map(
    (key) => {
      const meta = METRIC_META[key];
      const base = metricBase(smokingIntensity, key);
      const value = calcMetric(base, fullRecoveryDays, daysSinceQuit);
      return {
        key,
        label: meta.label,
        value,
        base,
        description: meta.description,
      };
    },
  );

  return {
    daysSinceQuit,
    packYears,
    smokingIntensity,
    fullRecoveryDays,
    overallRecoveryPct,
    metrics,
  };
}

/** Chart colors aligned with Progress page styling */
export const HEALTH_METRIC_COLORS: Record<HealthMetricKey, string> = {
  lung: "#10b981",
  circulation: "#ef4444",
  oxygen: "#3b82f6",
  heart: "#f59e0b",
};
