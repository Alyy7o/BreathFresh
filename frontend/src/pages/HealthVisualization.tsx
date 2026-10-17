import { useState, useEffect, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Activity, Info, Zap, Wind, Droplets, TrendingUp } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { DashboardHeader } from "@/components/DashboardHeader";
import { OrganViewer } from "@/components/visualization/OrganViewer";
import { PageLoader } from "@/components/PageLoader";
import { supabase } from "@/integrations/supabase/client";
import {
  computeHealthRecovery,
  getDaysSinceQuit,
  type HealthMetricKey,
} from "@/lib/healthRecovery";

const healthTimeline = [
  { time: "20 minutes", days: 0, icon: <Zap className="w-4 h-4" />, impact: "Heart rate & blood pressure drop to normal" },
  { time: "12 hours", days: 0.5, icon: <Wind className="w-4 h-4" />, impact: "Carbon monoxide levels in blood return to normal" },
  { time: "2 weeks", days: 14, icon: <Activity className="w-4 h-4" />, impact: "Circulation improves, lung function increases up to 30%" },
  { time: "1–9 months", days: 30, icon: <Wind className="w-4 h-4" />, impact: "Coughing & shortness of breath decrease significantly" },
  { time: "1 year", days: 365, icon: <Heart className="w-4 h-4" />, impact: "Heart disease risk cut in half vs a current smoker" },
  { time: "5 years", days: 1825, icon: <Droplets className="w-4 h-4" />, impact: "Stroke risk reduced to that of a non-smoker" },
  { time: "10 years", days: 3650, icon: <TrendingUp className="w-4 h-4" />, impact: "Lung cancer risk drops to half of a smoker's" },
];

function getRecoveryStageText(days: number): { title: string; body: string } {
  if (days < 1)
    return {
      title: "Your journey begins now",
      body: "Within the first 20 minutes of quitting, your heart rate and blood pressure start to drop. Every hour that passes is a victory — your body has already begun the healing process.",
    };
  if (days < 14)
    return {
      title: "Early detox phase",
      body: "Carbon monoxide has cleared from your blood. Your circulation is beginning to improve. The tar in your lungs will start being gradually cleared by your recovering cilia.",
    };
  if (days < 90)
    return {
      title: "Significant lung recovery",
      body: "Your lung function is increasing — you should notice it's easier to breathe. Coughing decreases as your airways clear. Blood flow to your heart and muscles is consistently improving.",
    };
  if (days < 365)
    return {
      title: "Cardiovascular healing in progress",
      body: "Your heart and arteries are actively repairing damage. Your cardiovascular risk continues to fall each week. Lung tissue is regenerating at a cellular level.",
    };
  return {
    title: "Major milestones achieved",
    body: "Your heart disease risk is half that of a smoker. Your lungs have regained most of their functional capacity. The risk of stroke, cancer, and chronic disease continues to fall toward non-smoker levels.",
  };
}

const METRIC_ICONS: Record<HealthMetricKey, ReactNode> = {
  oxygen: <Droplets className="w-4 h-4" />,
  lung: <Wind className="w-4 h-4" />,
  circulation: <Activity className="w-4 h-4" />,
  heart: <Heart className="w-4 h-4" />,
};

const METRIC_STYLES: Record<HealthMetricKey, { accent: string; bar: string }> = {
  oxygen: { accent: "text-accent", bar: "bg-accent" },
  lung: { accent: "text-primary", bar: "bg-primary" },
  circulation: { accent: "text-secondary", bar: "bg-secondary" },
  heart: { accent: "text-secondary", bar: "bg-secondary" },
};

export default function HealthVisualization() {
  const [daysSinceQuit, setDaysSinceQuit] = useState(0);
  const [quitDate, setQuitDate] = useState<Date | null>(null);
  const [showDevSlider, setShowDevSlider] = useState(false);
  const [simDays, setSimDays] = useState(0);
  const [profileSmoking, setProfileSmoking] = useState({ cigarettesPerDay: 20, yearsSmoked: 5 });
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    const fetchQuitDate = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("quit_date, cigarettes_per_day, years_smoked")
        .eq("id", user.id)
        .single();
      if (profile?.quit_date) {
        const qd = new Date(profile.quit_date);
        setQuitDate(qd);
        setDaysSinceQuit(getDaysSinceQuit(qd));
      }

      setProfileSmoking({
        cigarettesPerDay: Number(profile?.cigarettes_per_day ?? 20),
        yearsSmoked: Number(profile?.years_smoked ?? 5),
      });
      setPageLoading(false);
    };
    fetchQuitDate();
  }, []);

  if (pageLoading) {
    return <PageLoader message="Loading organ health..." />;
  }

  const displayDays = showDevSlider ? simDays : daysSinceQuit;
  const { title: aiTitle, body: aiBody } = getRecoveryStageText(displayDays);

  const recovery = computeHealthRecovery(profileSmoking, displayDays);
  const { smokingIntensity, fullRecoveryDays } = recovery;

  const metrics = recovery.metrics.map((m) => ({
    ...m,
    icon: METRIC_ICONS[m.key],
    ...METRIC_STYLES[m.key],
  }));

  // Build personalised health timeline — static milestones + a user-specific
  // "full organ recovery" entry anchored to their pack-year damage level
  const fullRecoveryYears = (fullRecoveryDays / 365).toFixed(1);
  const daysUntilFull = Math.max(0, fullRecoveryDays - displayDays);
  const daysUntilFullLabel = daysUntilFull === 0
    ? "Achieved!"
    : daysUntilFull < 30
      ? `${daysUntilFull}d remaining`
      : daysUntilFull < 365
        ? `~${Math.round(daysUntilFull / 30)}mo remaining`
        : `~${(daysUntilFull / 365).toFixed(1)}y remaining`;

  const personalTimeline = [
    ...healthTimeline,
    {
      time: `Full Organ Recovery (${fullRecoveryYears}y · Day ${fullRecoveryDays})`,
      days: fullRecoveryDays,
      icon: <TrendingUp className="w-4 h-4" />,
      impact: `Based on your smoking history, your organs are estimated to reach full recovery by Day ${fullRecoveryDays}. ${daysUntilFull === 0 ? "You\'ve done it!" : `${daysUntilFullLabel}.`}`,
    },
  ].sort((a, b) => a.days - b.days);

  return (
    <div className="min-h-screen bg-gradient-hero pb-24">
      <DashboardHeader dayNumber={displayDays} />

      <div className="container mx-auto px-4 py-6 space-y-6 max-w-5xl">

        {/* Hero */}
        <div className="text-center space-y-1 pb-2">
          <h1 className="text-3xl font-semibold tracking-tight text-[#0483C8] sm:text-4xl">
            Organ Health
          </h1>
          <p className="text-muted-foreground text-base">
            {quitDate
              ? `Quit on ${quitDate.toLocaleDateString()} · Day ${displayDays} of healing`
              : "3D visualization of your recovery journey"}
          </p>
        </div>

        {/* 3D Organ Viewer */}
        <Card className="p-4 md:p-6 shadow-md border-primary/10">
          <div className="mb-5 flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Smoker vs Your Recovery</h2>
            <span className="ml-auto text-xs text-muted-foreground">Drag to rotate</span>
          </div>
          <OrganViewer recoveryDays={displayDays} smokingIntensity={smokingIntensity} fullRecoveryDays={fullRecoveryDays} />
        </Card>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {metrics.map((m) => (
            <Card key={m.label} className="p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow">
              <div className={`inline-flex p-2 rounded-lg bg-muted ${m.accent}`}>
                {m.icon}
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">{m.label}</p>
                <p className="text-2xl font-bold text-foreground">
                  {m.value}<span className="text-sm text-muted-foreground">%</span>
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  Started at {m.base}%
                </p>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${m.bar} transition-all duration-700`}
                  style={{ width: `${m.value}%` }}
                />
              </div>
            </Card>
          ))}
        </div>

        {/* AI Insight card */}
        <Card className="p-5 shadow-sm border-accent/20 bg-accent/5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-2 rounded-lg bg-accent/10">
              <Info className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">
                AI Recovery Insight · Day {displayDays}
              </p>
              <p className="text-sm font-bold text-foreground mb-1">{aiTitle}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{aiBody}</p>
            </div>
          </div>
        </Card>

        {/* Health milestones timeline */}
        <Card className="p-5 shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Health Benefits Timeline</h2>
          </div>
          <div className="space-y-2">
            {personalTimeline.map((item, idx) => {
              const achieved = displayDays >= item.days;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-4 p-3.5 rounded-xl border transition-all duration-300 ${item.days === fullRecoveryDays
                    ? achieved
                      ? "border-green-400/40 bg-green-50"
                      : "border-primary/30 bg-primary/5 ring-1 ring-primary/20"
                    : achieved
                      ? "border-primary/20 bg-primary/5"
                      : "border-border bg-muted/30"
                    }`}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${item.days === fullRecoveryDays
                    ? achieved
                      ? "bg-green-500 text-white shadow-sm"
                      : "bg-primary/20 text-primary"
                    : achieved
                      ? "bg-gradient-primary text-white shadow-sm"
                      : "bg-muted text-muted-foreground"
                    }`}>
                    {achieved ? "✓" : idx + 1}
                  </div>
                  <div className={`flex-shrink-0 ${achieved ? "text-primary" : "text-muted-foreground/50"}`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${item.days === fullRecoveryDays
                      ? achieved ? "text-green-600" : "text-primary"
                      : achieved ? "text-primary" : "text-muted-foreground"
                      }`}>
                      {item.time}
                    </p>
                    <p className={`text-xs ${achieved ? "text-foreground" : "text-muted-foreground/70"}`}>
                      {item.impact}
                    </p>
                  </div>
                  {achieved && (
                    <Badge className={`flex-shrink-0 text-[10px] px-2 py-0.5 border-0 text-white ${item.days === fullRecoveryDays ? "bg-green-500" : "bg-gradient-primary"
                      }`}>
                      ✓ Done
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Dev slider (hidden) */}
        <div className="text-center">
          <button
            onClick={() => { setShowDevSlider(!showDevSlider); setSimDays(displayDays); }}
            className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            {showDevSlider ? "hide" : "simulate"} recovery days
          </button>
          {showDevSlider && (
            <Card className="mt-3 p-4 space-y-2">
              <label className="text-xs text-muted-foreground block">
                Simulating: <span className="text-foreground font-bold">Day {simDays}</span>
                {" "}({Math.round(Math.min(simDays / fullRecoveryDays, 1) * 100)}% recovered)
              </label>
              <input
                type="range" min="0" max={fullRecoveryDays} value={simDays}
                onChange={(e) => setSimDays(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Day 0</span><span>Day {fullRecoveryDays} (Full Recovery)</span>
              </div>
            </Card>
          )}
        </div>

      </div>
      <BottomNav />
    </div>
  );
}