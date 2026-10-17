import { useState } from "react";
import { LungCanvas } from "./LungCanvas";
import { HeartCanvas } from "./HeartCanvas";
import { Activity, Heart } from "lucide-react";

interface OrganViewerProps {
    recoveryDays: number;
    smokingIntensity?: number;  // 0=light, 1=heavy
    fullRecoveryDays?: number;  // personalised target (180–1460 days)
}

function getHealthStatus(days: number, fullRecoveryDays: number): { label: string; color: string } {
    const pct = days / fullRecoveryDays;
    if (pct < 0.01) return { label: "Severe Damage", color: "text-red-400" };
    if (pct < 0.10) return { label: "Early Recovery", color: "text-orange-400" };
    if (pct < 0.40) return { label: "Recovering", color: "text-yellow-400" };
    if (pct < 0.75) return { label: "Good Progress", color: "text-green-500" };
    return { label: "Healthy", color: "text-green-400" };
}

function getImprovementPct(days: number, fullRecoveryDays: number): number {
    return Math.round(Math.min(days / fullRecoveryDays, 1) * 100);
}

export function OrganViewer({ recoveryDays, smokingIntensity = 0.75, fullRecoveryDays = 730 }: OrganViewerProps) {
    const [activeOrgan, setActiveOrgan] = useState<"lungs" | "heart">("lungs");

    // Derive a label that reflects how severe the user's smoking was
    function getSmokerDamageLabel(intensity: number): { label: string; color: string } {
        if (intensity < 0.25) return { label: "Mild Damage", color: "text-orange-400" };
        if (intensity < 0.55) return { label: "Moderate Damage", color: "text-red-400" };
        if (intensity < 0.80) return { label: "Heavy Damage", color: "text-red-500" };
        return { label: "Severe Damage", color: "text-red-600" };
    }

    const smokerStatus = getSmokerDamageLabel(smokingIntensity);
    const userStatus = getHealthStatus(recoveryDays, fullRecoveryDays);
    const pct = getImprovementPct(recoveryDays, fullRecoveryDays);

    return (
        <div className="w-full space-y-4">
            {/* Organ toggle */}
            {/* Tab toggle — light theme */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                    onClick={() => setActiveOrgan("lungs")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${activeOrgan === "lungs"
                        ? "bg-white text-primary shadow-sm border border-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/60"
                        }`}
                >
                    <Activity className="w-4 h-4" />
                    Lungs
                </button>
                <button
                    onClick={() => setActiveOrgan("heart")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${activeOrgan === "heart"
                        ? "bg-white text-secondary shadow-sm border border-secondary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/60"
                        }`}
                >
                    <Heart className="w-4 h-4" />
                    Heart
                </button>
            </div>

            {/* Comparison panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Smoker panel */}
                <div className="rounded-2xl border border-red-200 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-red-100 bg-red-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-sm font-bold text-red-700">Smoker State</span>
                        </div>
                        <span className="text-xs font-semibold text-red-500">{smokerStatus.label}</span>
                    </div>
                    {/* Canvas needs contrast — use a deep neutral bg */}
                    <div className="h-72 md:h-96 relative bg-slate-200">
                        {activeOrgan === "lungs"
                            ? <LungCanvas recoveryDays={0} isSmoker={true} smokingIntensity={smokingIntensity} fullRecoveryDays={fullRecoveryDays} className="absolute inset-0" />
                            : <HeartCanvas recoveryDays={0} isSmoker={true} smokingIntensity={smokingIntensity} fullRecoveryDays={fullRecoveryDays} className="absolute inset-0" />
                        }
                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-200/90 to-transparent pointer-events-none" />
                        <p className="absolute bottom-2.5 left-0 right-0 text-center text-xs text-slate-500 pointer-events-none">
                            Tar-coated · Oxygen-deprived · Damaged
                        </p>
                    </div>
                </div>

                {/* Recovery panel */}
                <div className="rounded-2xl border border-primary/20 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-primary/10 bg-primary/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            <span className="text-sm font-bold text-primary">Your Recovery</span>
                        </div>
                        <span className={`text-xs font-semibold ${userStatus.color}`}>{userStatus.label}</span>
                    </div>
                    {/* Canvas needs contrast — use a deep neutral bg */}
                    <div className="h-72 md:h-96 relative bg-slate-200">
                        {activeOrgan === "lungs"
                            ? <LungCanvas recoveryDays={recoveryDays} isSmoker={false} smokingIntensity={smokingIntensity} fullRecoveryDays={fullRecoveryDays} className="absolute inset-0" />
                            : <HeartCanvas recoveryDays={recoveryDays} isSmoker={false} smokingIntensity={smokingIntensity} fullRecoveryDays={fullRecoveryDays} className="absolute inset-0" />
                        }
                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-200/90 to-transparent pointer-events-none" />
                        <p className="absolute bottom-2.5 left-0 right-0 text-center text-xs text-slate-500 pointer-events-none">
                            Day {recoveryDays} · Healing in progress
                        </p>
                    </div>
                </div>
            </div>

            {/* Improvement bar */}
            <div className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Overall Recovery</span>
                    <div className="text-right">
                        <span className="text-sm font-bold text-foreground">{pct}% Healed</span>
                        <span className="ml-2 text-xs text-muted-foreground">(Day {recoveryDays})</span>
                    </div>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full bg-gradient-primary transition-all duration-700"
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] text-muted-foreground">Day 0</span>
                    <span className="text-[10px] text-muted-foreground">
                        Day {fullRecoveryDays}
                        {fullRecoveryDays >= 365 && ` (~${(fullRecoveryDays / 365).toFixed(1)}y)`}
                        {" · Full Recovery"}
                    </span>
                </div>
            </div>
        </div>
    );
}
