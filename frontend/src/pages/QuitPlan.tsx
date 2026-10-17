import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Target, 
  Sparkles, 
  CheckCircle2, 
  Zap, 
  Brain, 
  Banknote, 
  TrendingUp, 
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shield,
  Lightbulb,
  ArrowDown,
  Clock,
  Pill,
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarCheck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PageLoader from "@/components/PageLoader";
import { DashboardHeader } from "@/components/DashboardHeader";
import { BottomNav } from "@/components/BottomNav";

interface Intervention {
  trigger: string;
  strategy: string;
  rationale: string;
}

interface PlanDay {
  day: number;
  cigarette_target: number;
  craving_window: string;
  nrt_guidance: string | null;
  interventions: Intervention[];
}

interface FinancialMilestone {
  cigarettes_reduced: number;
  savings_pkr: number;
  equivalent_to: string;
}

interface AssessmentData {
  struggle_factors: string[];
  success_factors: string[];
  risk_level: "low" | "moderate" | "high";
}

interface WeekSummary {
  baseline_daily_avg: number;
  target_by_day_7: number;
  total_reduction_percent: number;
  projected_quit_date: string;
}

interface QuitPlanData {
  plan_generated_at?: string;
  clinical_reasoning: string;
  motivational_message: string;
  financial_milestone: FinancialMilestone;
  assessment: AssessmentData;
  week_summary: WeekSummary;
  days: PlanDay[];
}

/**
 * Normalize model output — handles key variations and both old/new schemas.
 */
function normalizePlanData(raw: any): QuitPlanData | null {
  if (!raw || typeof raw !== "object") return null;

  // Detect the plan array under any plausible key
  const planArray: any[] | undefined =
    raw["days"] ??
    raw["7_day_plan"] ??
    raw["seven_day_plan"] ??
    raw["daily_plan"] ??
    raw["plan"] ??
    raw["week_plan"] ??
    undefined;

  if (!Array.isArray(planArray) || planArray.length === 0) return null;

  // Normalize each day entry — handle both old string[] and new object[] interventions
  const normalizedDays: PlanDay[] = planArray.map((d: any, idx: number) => {
    let interventions: Intervention[] = [];
    const rawInt = d.interventions ?? d.key_interventions ?? d.activities ?? [];
    if (Array.isArray(rawInt)) {
      interventions = rawInt.map((item: any) =>
        typeof item === "string"
          ? { trigger: "General", strategy: item, rationale: "" }
          : {
              trigger: item.trigger ?? "General",
              strategy: item.strategy ?? item.action ?? String(item),
              rationale: item.rationale ?? item.reason ?? "",
            }
      );
    }

    return {
      day: Number(d.day ?? d.Day ?? idx + 1),
      cigarette_target: Number(d.cigarette_target ?? d.cigarettes ?? d.target ?? 0),
      craving_window: d.craving_window ?? d.peak_craving ?? "",
      nrt_guidance: d.nrt_guidance ?? d.nrt ?? null,
      interventions: interventions.length > 0 ? interventions : [{ trigger: "General", strategy: "Follow your plan for the day", rationale: "" }],
    };
  });

  // Normalize assessment — handle both old string and new object
  let assessment: AssessmentData;
  if (typeof raw.assessment === "object" && raw.assessment !== null) {
    assessment = {
      struggle_factors: Array.isArray(raw.assessment.struggle_factors) ? raw.assessment.struggle_factors : [],
      success_factors: Array.isArray(raw.assessment.success_factors) ? raw.assessment.success_factors : [],
      risk_level: raw.assessment.risk_level ?? "moderate",
    };
  } else {
    assessment = {
      struggle_factors: [],
      success_factors: [],
      risk_level: "moderate",
    };
  }

  // Normalize financial — handle both old string and new object
  let financial: FinancialMilestone;
  if (typeof raw.financial_milestone === "object" && raw.financial_milestone !== null) {
    financial = {
      cigarettes_reduced: Number(raw.financial_milestone.cigarettes_reduced ?? 0),
      savings_pkr: Number(raw.financial_milestone.savings_pkr ?? 0),
      equivalent_to: raw.financial_milestone.equivalent_to ?? "",
    };
  } else {
    financial = { cigarettes_reduced: 0, savings_pkr: 0, equivalent_to: String(raw.financial_milestone ?? "—") };
  }

  // Normalize week_summary
  const ws = raw.week_summary ?? {};
  const weekSummary: WeekSummary = {
    baseline_daily_avg: Number(ws.baseline_daily_avg ?? normalizedDays[0]?.cigarette_target ?? 0),
    target_by_day_7: Number(ws.target_by_day_7 ?? normalizedDays[normalizedDays.length - 1]?.cigarette_target ?? 0),
    total_reduction_percent: Number(ws.total_reduction_percent ?? 0),
    projected_quit_date: ws.projected_quit_date ?? "",
  };

  return {
    plan_generated_at: raw.plan_generated_at ?? "",
    clinical_reasoning: raw.clinical_reasoning ?? raw.reasoning ?? "",
    motivational_message: raw.motivational_message ?? raw.motivation ?? "Stay strong — you've got this!",
    financial_milestone: financial,
    assessment,
    week_summary: weekSummary,
    days: normalizedDays,
  };
}

const QuitPlan = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<QuitPlanData | null>(null);
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [dayNumber, setDayNumber] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [planExpired, setPlanExpired] = useState(false);
  const [weekNumber, setWeekNumber] = useState(1);

  useEffect(() => {
    const fetchCurrentPlan = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('quit_date')
        .eq('id', user.id)
        .single();
      
      if (profile?.quit_date) {
        const diff = Math.floor((Date.now() - new Date(profile.quit_date).getTime()) / 86400000);
        setDayNumber(Math.max(0, diff));
      }

      // Count total plans to determine week number
      const { count } = await supabase
        .from('quit_plans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      setWeekNumber((count || 0) + 1);

      const { data: plans } = await supabase
        .from('quit_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (plans && plans.length > 0) {
        const normalized = normalizePlanData(plans[0].plan_data);
        setPlan(normalized);
        const planStart = new Date((plans[0] as any).start_date);
        const dayDiff = Math.floor((Date.now() - planStart.getTime()) / 86400000);
        
        if (dayDiff >= 7) {
          // Plan week is over
          setPlanExpired(true);
          setActiveDayIdx(6);
        } else {
          setActiveDayIdx(Math.min(Math.max(0, dayDiff), 6));
        }
        setWeekNumber((count || 0) + 1);
      }
      
      setLoading(false);
    };

    fetchCurrentPlan();
  }, [navigate]);

  const generateNewPlan = async () => {
    if (!userId) return;
    setGenerating(true);
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // Fetch recent cravings (last 7 days)
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: cravings } = await supabase
        .from('cravings')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', weekAgo)
        .order('created_at', { ascending: false })
        .limit(30);

      const formattedCravings = cravings?.map(c => ({
        intensity: c.intensity,
        trigger: c.trigger || "Unknown",
        notes: c.notes || ""
      })) || [];

      // Fetch previous plans for context (last 3)
      const { data: prevPlans } = await supabase
        .from('quit_plans')
        .select('plan_data, start_date, end_date')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3);

      const previousPlansSummary = prevPlans?.map((p: any) => {
        const pd = normalizePlanData(p.plan_data);
        const pDays = pd?.days || [];
        return {
          start_date: p.start_date,
          end_date: p.end_date,
          start_target: pDays[0]?.cigarette_target,
          end_target: pDays[pDays.length - 1]?.cigarette_target,
          assessment: typeof pd?.assessment === "object" ? JSON.stringify(pd.assessment) : ""
        };
      }) || [];

      // Use previous plan's last day target as this week's reference
      const lastPlanData = normalizePlanData(prevPlans?.[0]?.plan_data);
      const lastPlanDays = lastPlanData?.days || [];
      const lastWeekTarget = lastPlanDays.length > 0
        ? lastPlanDays[lastPlanDays.length - 1].cigarette_target
        : (profile?.cigarettes_per_day || 20);

      const payload = {
        user: {
          baseline: {
            cigs_per_day: profile?.cigarettes_per_day || 20,
            years_smoked: profile?.years_smoked || 10,
            motivation: 8,
            pack_cost: profile?.pack_cost || 450
          },
          last_week_target: lastWeekTarget,
          last_week_actual: lastWeekTarget, // Best estimate without daily tracking
          craving_logs: formattedCravings,
          quit_preference: "gradual",
          previous_plans: previousPlansSummary,
          week_number: weekNumber
        }
      };

      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Failed to generate plan");
      
      const result = await response.json();
      
      if (!result.success) {
        toast.error(result.error || "Generation failed");
        return;
      }

      // Normalize model output before saving / rendering
      const normalizedResult = normalizePlanData(result);
      if (!normalizedResult) {
        toast.error("The AI returned an unrecognizable plan format. Please try again.");
        console.error("Raw model output:", result);
        return;
      }

      const { data: savedPlan, error: saveError } = await (supabase
        .from('quit_plans' as any)
        .insert({
          user_id: userId,
          plan_data: normalizedResult as any,
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          is_active: true
        } as any)
        .select()
        .single() as any);

      if (saveError) throw saveError;

      // Deactivate old plans
      await supabase
        .from('quit_plans' as any)
        .update({ is_active: false } as any)
        .eq('user_id', userId)
        .neq('id', savedPlan.id);

      setPlan(normalizedResult);
      setActiveDayIdx(0);
      setPlanExpired(false);
      setWeekNumber(prev => prev + 1);
      toast.success(`Week ${weekNumber} plan is ready!`);
    } catch (error: any) {
      console.error("Plan Generation Error:", error);
      toast.error(error.message || "An unexpected error occurred");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <PageLoader message="Loading your quit plan..." />;

  const days = plan?.days ?? [];
  const activeDay = days[activeDayIdx];
  const totalReduction = days.length >= 7
    ? (days[0]?.cigarette_target ?? 0) - (days[6]?.cigarette_target ?? 0)
    : 0;

  // If a plan was loaded but has no valid days, treat it as empty
  const hasPlan = plan && days.length > 0;
  const riskColor = plan?.assessment?.risk_level === "high" ? "text-red-500" : plan?.assessment?.risk_level === "low" ? "text-green-500" : "text-yellow-500";

  return (
    <div className="min-h-screen max-w-full bg-gradient-hero overflow-x-hidden pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)]">
      <DashboardHeader dayNumber={dayNumber} />
      
      <div className="px-3 py-4 sm:px-6 sm:py-6 max-w-5xl mx-auto space-y-4 sm:space-y-5 w-full min-w-0">
        {!hasPlan ? (
          /* ─── Empty State ─── */
          <div className="flex flex-col items-center justify-center min-h-[55vh] sm:min-h-[70vh] animate-fade-in px-2 w-full">
            <div className="relative mb-8">
              <div className="w-28 h-28 rounded-full bg-primary flex items-center justify-center shadow-lg">
                <Brain className="w-14 h-14 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-secondary flex items-center justify-center shadow-md">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-3 text-primary">
              Ready for a Strategic Quit?
            </h2>
            <p className="text-muted-foreground text-center max-w-sm mb-8 leading-relaxed px-4">
              Our AI will analyze your smoking history and recent cravings to build a custom <strong>7-day roadmap</strong> just for you.
            </p>
            
            <Button 
              size="lg" 
              onClick={generateNewPlan} 
              disabled={generating}
              className="w-full max-w-xs sm:max-w-none sm:w-auto bg-primary hover:bg-primary/90 shadow-lg px-6 sm:px-8 py-5 sm:py-6 h-auto text-sm sm:text-lg rounded-2xl transition-all active:scale-95"
            >
              {generating ? (
                <>
                  <RefreshCw className="mr-3 h-5 w-5 animate-spin" />
                  Analyzing & Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-3 h-5 w-5" />
                  Generate My 7-Day Plan
                </>
              )}
            </Button>

            {generating && (
              <p className="text-xs text-muted-foreground mt-4 animate-pulse">
                This may take 30-60 seconds...
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-5 animate-fade-in overflow-x-hidden max-w-full">
            {/* ─── Motivational Message + Risk Banner ─── */}
            <Card className="overflow-hidden max-w-full border-0 shadow-lg">
              <div className="bg-primary p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
                      <Badge className="bg-white/20 text-white text-[10px] sm:text-xs border-0 backdrop-blur-sm shrink-0">Week {weekNumber > 1 ? weekNumber - 1 : 1}</Badge>
                      <Badge className={`text-[10px] sm:text-xs border-0 backdrop-blur-sm ${
                        plan?.assessment?.risk_level === "high" ? "bg-red-500/30 text-white" :
                        plan?.assessment?.risk_level === "low" ? "bg-green-500/30 text-white" :
                        "bg-yellow-500/30 text-white"
                      }`}>
                        {plan?.assessment?.risk_level === "high" ? "⚠ High Risk" : plan?.assessment?.risk_level === "low" ? "✓ Low Risk" : "◉ Moderate Risk"}
                      </Badge>
                    </div>
                    <p className="text-white/95 text-sm sm:text-base font-medium leading-relaxed break-words text-wrap-anywhere">
                      &ldquo;{plan?.motivational_message}&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* ─── Week Complete Banner ─── */}
            {planExpired && (
              <Card className="overflow-hidden border-0 shadow-lg border-l-4 border-l-secondary animate-fade-in">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base mb-1">Week Complete! 🎉</h3>
                      <p className="text-sm text-muted-foreground mb-1">
                        You finished your 7-day plan. Target went from{" "}
                        <strong>{days[0]?.cigarette_target}</strong> → <strong>{days[days.length - 1]?.cigarette_target}</strong> cigs/day.
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Generate your next week's plan to keep progressing. The AI will use your history to create a continuation plan.
                      </p>
                      <Button 
                        onClick={generateNewPlan} 
                        disabled={generating}
                        className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white rounded-xl h-10 sm:h-9 px-4 text-sm"
                      >
                        {generating ? (
                          <><RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> Generating Week {weekNumber}...</>
                        ) : (
                          <><Sparkles className="mr-2 h-3.5 w-3.5" /> Generate Week {weekNumber} Plan</>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ─── Cigarette Reduction Strip (compact) ─── */}
            {/* <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Cigs/day</span>
              <div className="flex gap-1 flex-1">
                {days.map((day, idx) => {
                  const isActive = idx === activeDayIdx;
                  const isPast = idx < activeDayIdx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setActiveDayIdx(idx)}
                      className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                        isActive
                          ? 'bg-primary text-white shadow-md scale-105'
                          : isPast
                            ? 'bg-primary/15 text-primary'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      <span className={`block text-xs sm:text-sm font-extrabold leading-none ${isActive ? 'text-white' : ''}`}>
                        {day.cigarette_target}
                      </span>
                      <span className={`block text-[8px] sm:text-[9px] mt-0.5 font-semibold ${isActive ? 'text-white/70' : 'text-muted-foreground'}`}>
                        D{day.day}
                      </span>
                    </button>
                  );
                })}
              </div>
              {totalReduction > 0 && (
                <Badge className="bg-secondary/10 text-secondary border-0 text-[9px] font-bold whitespace-nowrap">
                  ↓{totalReduction}
                </Badge>
              )}
            </div> */}

            {/* ─── Day Selector (horizontal scroll on mobile) ─── */}
            <div className="space-y-2">
              <h3 className="font-bold flex items-center gap-2 text-sm px-1">
                <Calendar className="w-4 h-4 text-primary" />
                7-Day Schedule
              </h3>
              <div className="overflow-x-hidden max-w-full">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory touch-pan-x">
                {days.map((day, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveDayIdx(idx)}
                    className={`snap-center flex-shrink-0 min-w-[5rem] w-[5rem] sm:min-w-0 sm:w-auto sm:flex-1 p-2.5 sm:p-3 rounded-xl text-center border transition-all duration-200 touch-manipulation ${
                      activeDayIdx === idx 
                        ? "bg-primary border-transparent text-white shadow-md sm:scale-[1.02]" 
                        : "bg-white border-border hover:border-primary/40"
                    }`}
                  >
                    <div className={`text-[10px] uppercase tracking-wider font-bold mb-0.5 ${
                      activeDayIdx === idx ? "text-white/70" : "text-muted-foreground"
                    }`}>Day</div>
                    <div className="text-lg sm:text-xl font-black">{day.day}</div>
                    <div className={`text-[10px] mt-0.5 font-semibold ${
                      activeDayIdx === idx ? "text-white/80" : "text-muted-foreground"
                    }`}>{day.cigarette_target} cigs</div>
                    {idx < activeDayIdx && (
                      <CheckCircle2 className={`w-3.5 h-3.5 mx-auto mt-1 ${activeDayIdx === idx ? "text-white" : "text-primary"}`} />
                    )}
                    {idx === activeDayIdx && (
                      <Zap className={`w-3.5 h-3.5 mx-auto mt-1 animate-pulse ${activeDayIdx === idx ? "text-white" : "text-secondary"}`} />
                    )}
                  </button>
                ))}
                </div>
              </div>
            </div>

            {/* ─── Active Day Detail Card ─── */}
            {activeDay && (
              <Card className="overflow-hidden border-0 shadow-xl">
                {/* Day Header */}
                <CardHeader className="bg-slate-900 text-white p-4 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-bold mb-1">Current Focus</p>
                      <CardTitle className="text-xl sm:text-3xl font-black">Day {activeDay.day}</CardTitle>
                    </div>
                    <div className="flex sm:block justify-start sm:text-right">
                      <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-sm flex flex-col items-center justify-center">
                        <Target className="w-4 h-4 text-primary mb-0.5" />
                        <span className="text-2xl sm:text-3xl font-black">{activeDay.cigarette_target}</span>
                        <span className="text-[9px] text-white/60 uppercase">target</span>
                      </div>
                    </div>
                  </div>

                  {/* Mobile nav */}
                  <div className="flex justify-between items-center mt-4 sm:hidden">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      disabled={activeDayIdx === 0}
                      onClick={() => setActiveDayIdx(prev => prev - 1)}
                      className="text-white/70 hover:text-white hover:bg-white/10 h-8 px-2"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                    </Button>
                    <span className="text-xs text-white/40">{activeDayIdx + 1} of 7</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      disabled={activeDayIdx === 6}
                      onClick={() => setActiveDayIdx(prev => prev + 1)}
                      className="text-white/70 hover:text-white hover:bg-white/10 h-8 px-2"
                    >
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-5 bg-white">
                  {/* Craving Window + NRT Row */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    {activeDay.craving_window && (
                      <div className="flex-1 p-3 rounded-xl bg-red-50 border border-red-100">
                        <h4 className="text-[10px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                          <Clock className="w-3 h-3" /> Peak Craving
                        </h4>
                        <p className="text-sm font-semibold text-red-700 break-words">{activeDay.craving_window}</p>
                      </div>
                    )}
                    {activeDay.nrt_guidance && (
                      <div className="flex-1 p-3 rounded-xl bg-blue-50 border border-blue-100">
                        <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                          <Pill className="w-3 h-3" /> NRT Guidance
                        </h4>
                        <p className="text-sm font-semibold text-blue-700 break-words">{activeDay.nrt_guidance}</p>
                      </div>
                    )}
                  </div>

                  {/* Interventions — structured */}
                  <div>
                    <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" /> Interventions
                    </h4>
                    <div className="space-y-3">
                      {(activeDay?.interventions ?? []).map((item, i) => (
                        <div key={i} className="p-3.5 bg-muted/40 rounded-xl overflow-hidden hover:bg-primary/5 transition-colors border border-transparent hover:border-primary/10">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-primary flex-shrink-0 flex items-center justify-center mt-0.5">
                              <span className="text-[10px] font-bold text-white">{i + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-auto min-h-4 max-w-full border-primary/30 text-primary font-bold whitespace-normal text-left">
                                  {item.trigger}
                                </Badge>
                              </div>
                              <p className="text-sm font-semibold leading-snug break-words text-wrap-anywhere">{item.strategy}</p>
                              {item.rationale && (
                                <p className="text-xs text-muted-foreground mt-1 italic break-words text-wrap-anywhere">{item.rationale}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ─── Stats Grid ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Financial */}
              <Card className="bg-success text-white border-0 shadow-lg min-w-0">
                <CardContent className="p-2.5 sm:p-4 text-center min-w-0">
                  <Banknote className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 opacity-80" />
                  <p className="text-base sm:text-xl font-black break-words">PKR {plan?.financial_milestone?.savings_pkr?.toFixed(0) ?? "—"}</p>
                  <p className="text-[9px] uppercase tracking-wider text-white/70 font-bold">Saved</p>
                  {plan?.financial_milestone?.equivalent_to && (
                    <p className="text-[9px] text-white/60 mt-0.5 line-clamp-2 break-words">≈ {plan.financial_milestone.equivalent_to}</p>
                  )}
                </CardContent>
              </Card>

              {/* Reduction */}
              <Card className="bg-secondary text-white border-0 shadow-lg min-w-0">
                <CardContent className="p-2.5 sm:p-4 text-center min-w-0">
                  <ArrowDown className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 opacity-80" />
                  <p className="text-base sm:text-xl font-black">{totalReduction > 0 ? `-${totalReduction}` : "0"}</p>
                  <p className="text-[9px] uppercase tracking-wider text-white/70 font-bold">Cigs Reduced</p>
                </CardContent>
              </Card>

              {/* Baseline → Target */}
              <Card className="bg-white border shadow-md min-w-0">
                <CardContent className="p-2.5 sm:p-4 text-center min-w-0">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-primary opacity-80" />
                  <p className="text-sm sm:text-xl font-black text-foreground leading-tight break-words">
                    {plan?.week_summary?.baseline_daily_avg ?? "—"} → {plan?.week_summary?.target_by_day_7 ?? "—"}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Daily Target</p>
                </CardContent>
              </Card>

              {/* Projected Quit */}
              <Card className="bg-white border shadow-md min-w-0">
                <CardContent className="p-2.5 sm:p-4 text-center min-w-0">
                  <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-primary opacity-80" />
                  <p className="text-xs sm:text-base font-black text-foreground leading-tight">
                    {plan?.week_summary?.projected_quit_date
                      ? new Date(plan.week_summary.projected_quit_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                      : "—"}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Projected Quit</p>
                </CardContent>
              </Card>
            </div>

            {/* ─── Assessment Factors ─── */}
            {(plan?.assessment?.struggle_factors?.length > 0 || plan?.assessment?.success_factors?.length > 0) && (
              <Card className="border shadow-md">
                <CardContent className="p-4 sm:p-5 space-y-3">
                  <h4 className="text-xs font-bold flex items-center gap-2 text-foreground">
                    <Activity className="w-4 h-4 text-primary" /> Assessment
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {plan.assessment.struggle_factors.length > 0 && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                        <h5 className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Challenges
                        </h5>
                        <ul className="space-y-1">
                          {plan.assessment.struggle_factors.map((s, i) => (
                            <li key={i} className="text-xs text-red-700 flex gap-1.5"><span className="shrink-0">•</span><span className="break-words">{s}</span></li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {plan.assessment.success_factors.length > 0 && (
                      <div className="p-3 rounded-xl bg-green-50 border border-green-100">
                        <h5 className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> What's Working
                        </h5>
                        <ul className="space-y-1">
                          {plan.assessment.success_factors.map((s, i) => (
                            <li key={i} className="text-xs text-green-700 flex gap-1.5"><span className="shrink-0">•</span><span className="break-words">{s}</span></li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ─── Clinical Reasoning ─── */}
            {plan?.clinical_reasoning && (
              <Card className="glass border-l-4 border-l-accent shadow-md">
                <CardContent className="p-4 sm:p-5 space-y-2">
                  <h4 className="text-xs font-bold flex items-center gap-2 text-accent">
                    <Brain className="w-4 h-4" /> Why This Strategy?
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed break-words text-wrap-anywhere">
                    {plan.clinical_reasoning}
                  </p>
                </CardContent>
              </Card>
            )}
            
            {/* Regenerate */}
            <div className="flex justify-center pt-2 pb-2 sm:pb-4 px-1">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full sm:w-auto max-w-sm text-muted-foreground hover:text-primary transition-colors rounded-xl"
                onClick={generateNewPlan}
                disabled={generating}
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${generating ? 'animate-spin' : ''}`} />
                {generating ? 'Regenerating...' : 'Regenerate Plan'}
              </Button>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default QuitPlan;
