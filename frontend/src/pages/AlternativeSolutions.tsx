import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { BottomNav } from "@/components/BottomNav";
import { PageLoader } from "@/components/PageLoader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";
import {
  Pill, Leaf, Brain, Activity, Wind, Heart, Zap, Coffee,
  Star, Clock, Shield, TrendingUp, CheckCircle, AlertCircle, Sparkles
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type Category = "nrt" | "holistic" | "behavioral" | "herbal";
type Trigger = "all" | "stress" | "boredom" | "after-meals" | "morning" | "social";

interface Alternative {
  id: string;
  title: string;
  subtitle: string;
  category: Category;
  triggers: Trigger[];
  effectiveness: number;          // 0–100
  effort: "low" | "medium" | "high";
  timeToEffect: string;
  description: string;
  instructions: string[];
  suitableFor: { minCigs?: number; maxCigs?: number; minDays?: number; maxDays?: number; minIntensity?: number; maxIntensity?: number };
  warning?: string;
  price?: string;
}

// ── Full library of alternatives ─────────────────────────────────────────────
const LIBRARY: Alternative[] = [
  // ── NRT ──────────────────────────────────────────────────────────────────
  {
    id: "patch-21",
    title: "Nicotine Patch 21mg",
    subtitle: "NicoStep / NicodermCQ · Step 1",
    category: "nrt",
    triggers: ["morning", "stress"],
    effectiveness: 88,
    effort: "low",
    timeToEffect: "~1 hour",
    description: "Continuous 24-hour nicotine delivery. Best for heavy smokers in the first 6 weeks of quitting.",
    instructions: [
      "Apply to clean, dry, hairless skin on upper arm, chest, or back",
      "Rotate sites daily to avoid skin irritation",
      "Wear for 24 hours, then replace with a fresh patch",
      "After 6 weeks, step down to 14mg patch",
    ],
    suitableFor: { minCigs: 20, minIntensity: 0.5 },
    price: "Rs. 55–70 / patch",
    warning: "Do not smoke while wearing the patch — risk of nicotine overdose.",
  },
  {
    id: "patch-14",
    title: "Nicotine Patch 14mg",
    subtitle: "NicoStep / NicodermCQ · Step 2",
    category: "nrt",
    triggers: ["morning", "stress"],
    effectiveness: 84,
    effort: "low",
    timeToEffect: "~1 hour",
    description: "Step-down patch for weeks 7–12 after quitting. Gradual reduction prevents relapse.",
    instructions: [
      "Apply after completing the 21mg step (or as starting point for moderate smokers)",
      "Same application instructions as 21mg patch",
      "After 6 weeks on 14mg, switch to 7mg for final step-down",
    ],
    suitableFor: { minCigs: 10, maxCigs: 20, minDays: 42 },
    price: "Rs. 45–60 / patch",
  },
  {
    id: "patch-7",
    title: "Nicotine Patch 7mg",
    subtitle: "NicoStep / NicodermCQ · Step 3",
    category: "nrt",
    triggers: ["morning"],
    effectiveness: 79,
    effort: "low",
    timeToEffect: "~1 hour",
    description: "Final step-down for light smokers or those finishing a 12-week patch programme.",
    instructions: [
      "Use for final 2–6 weeks of patch therapy",
      "Apply as usual — overnight removal optional at this stage",
    ],
    suitableFor: { maxCigs: 10, minDays: 84 },
    price: "Rs. 35–50 / patch",
  },
  {
    id: "gum-4",
    title: "Nicotine Gum 4mg",
    subtitle: "Nicorette · Fast Action",
    category: "nrt",
    triggers: ["stress", "after-meals", "social", "boredom"],
    effectiveness: 82,
    effort: "medium",
    timeToEffect: "3–5 min",
    description: "On-demand relief for acute cravings. Best for heavy smokers needing fast top-up.",
    instructions: [
      "Chew slowly until you taste or feel a tingle",
      "Park the gum between your cheek and gum",
      "Chew again when the tingle fades — repeat for 30 minutes",
      "Don't eat or drink 15 minutes before or during use",
      "Max 24 pieces per day",
    ],
    suitableFor: { minCigs: 20 },
    price: "Rs. 40–55 / piece",
  },
  {
    id: "gum-2",
    title: "Nicotine Gum 2mg",
    subtitle: "Nicorette · Regular",
    category: "nrt",
    triggers: ["stress", "after-meals", "boredom"],
    effectiveness: 77,
    effort: "medium",
    timeToEffect: "3–5 min",
    description: "Milder gum for light-to-moderate smokers. Good as a patch complement.",
    instructions: [
      "Use the 'chew-and-park' method (same as 4mg)",
      "Use 1 piece every 1–2 hours for the first 6 weeks",
      "Max 24 pieces per day",
    ],
    suitableFor: { maxCigs: 20 },
    price: "Rs. 30–45 / piece",
  },
  {
    id: "lozenge",
    title: "Nicotine Lozenge",
    subtitle: "Nicorette · 2mg & 4mg",
    category: "nrt",
    triggers: ["stress", "social", "after-meals"],
    effectiveness: 80,
    effort: "low",
    timeToEffect: "5–10 min",
    description: "Discreet oral nicotine dissolving tablet. Ideal in social situations where gum feels obvious.",
    instructions: [
      "Place lozenge in mouth and let it dissolve slowly (20–30 min)",
      "Move it around occasionally — do not chew or swallow",
      "Do not eat or drink while using",
      "Max 20 lozenges/day",
    ],
    suitableFor: { minDays: 0 },
    price: "Rs. 35–50 / lozenge",
  },
  {
    id: "inhaler",
    title: "Nicotine Inhaler",
    subtitle: "Nicotrol Inhaler",
    category: "nrt",
    triggers: ["stress", "boredom", "social"],
    effectiveness: 76,
    effort: "medium",
    timeToEffect: "2–3 min",
    description: "Mimics the hand-to-mouth ritual of smoking — ideal if the physical habit is a strong trigger.",
    instructions: [
      "Puff on the inhaler (do not inhale deeply — nicotine absorbs in mouth/throat)",
      "Use 6–16 cartridges per day for the first 12 weeks",
      "Each cartridge lasts ~20 minutes of continuous puffing",
      "Taper down after 12 weeks",
    ],
    suitableFor: { minDays: 0 },
    price: "Rs. 200–300 / cartridge",
    warning: "Avoid in asthma or chronic lung conditions.",
  },

  // ── Holistic ─────────────────────────────────────────────────────────────
  {
    id: "478-breathing",
    title: "4-7-8 Breathing",
    subtitle: "Dr. Andrew Weil's technique",
    category: "holistic",
    triggers: ["stress", "boredom", "morning"],
    effectiveness: 72,
    effort: "low",
    timeToEffect: "< 1 min",
    description: "Activates the parasympathetic nervous system in under 60 seconds, cutting craving intensity by up to 45%.",
    instructions: [
      "Exhale completely through your mouth",
      "Inhale quietly through your nose for 4 counts",
      "Hold your breath for 7 counts",
      "Exhale completely through your mouth for 8 counts",
      "Repeat 3–4 cycles. Do this any time a craving hits.",
    ],
    suitableFor: { minDays: 0 },
  },
  {
    id: "box-breathing",
    title: "Box Breathing",
    subtitle: "Used by Navy SEALs for acute stress",
    category: "holistic",
    triggers: ["stress", "social"],
    effectiveness: 70,
    effort: "low",
    timeToEffect: "< 2 min",
    description: "4-count equal breathing pattern that rapidly lowers cortisol — the hormone that worsens cravings.",
    instructions: [
      "Inhale for 4 counts",
      "Hold for 4 counts",
      "Exhale for 4 counts",
      "Hold empty for 4 counts",
      "Repeat 4–6 cycles",
    ],
    suitableFor: { minDays: 0 },
  },
  {
    id: "cold-water",
    title: "Cold Water Technique",
    subtitle: "Immediate craving interrupt",
    category: "holistic",
    triggers: ["boredom", "after-meals", "morning"],
    effectiveness: 68,
    effort: "low",
    timeToEffect: "< 30 sec",
    description: "Drinking a large glass of cold water slowly interrupts the craving circuit and mimics the oral fixation of smoking.",
    instructions: [
      "Drink a full glass of cold water very slowly",
      "Hold each sip in your mouth briefly",
      "Most cravings pass within 3–5 minutes — keep drinking until it passes",
    ],
    suitableFor: { minDays: 0 },
  },
  {
    id: "exercise-burst",
    title: "5-Minute Exercise Burst",
    subtitle: "Craving buster via endorphin spike",
    category: "holistic",
    triggers: ["stress", "boredom", "morning"],
    effectiveness: 78,
    effort: "medium",
    timeToEffect: "5 min",
    description: "Even a 5-minute walk or 20 jumping jacks releases dopamine — directly countering the brain's nicotine signal.",
    instructions: [
      "When a craving hits: stand up immediately",
      "Do 2 minutes of jumping jacks, brisk walking, or stair climbing",
      "Follow with 1 minute of deep breathing",
      "Craving should reduce by 50–70% by then",
    ],
    suitableFor: { minDays: 0 },
  },
  {
    id: "acupressure",
    title: "Acupressure Point (Tim Mee)",
    subtitle: "Traditional stop-smoking pressure point",
    category: "holistic",
    triggers: ["stress", "after-meals"],
    effectiveness: 60,
    effort: "low",
    timeToEffect: "2–3 min",
    description: "The Tim Mee pressure point on your wrist is traditionally used to calm tobacco cravings. Low-effort and can be done anywhere.",
    instructions: [
      "Find the Tim Mee point: one thumb-width above your wrist crease on the inside of your arm",
      "Apply firm pressure with your thumb for 2 minutes",
      "Breathe slowly during this time",
      "Switch to the other wrist and repeat",
    ],
    suitableFor: { minDays: 0 },
  },

  // ── Behavioral ───────────────────────────────────────────────────────────
  {
    id: "delay-technique",
    title: "The 5-Minute Delay Rule",
    subtitle: "CBT-based urge management",
    category: "behavioral",
    triggers: ["stress", "boredom", "social", "after-meals"],
    effectiveness: 74,
    effort: "low",
    timeToEffect: "5 min",
    description: "Delay acting on a craving for just 5 minutes — most cravings peak and pass within this window. Works by breaking the automatic response chain.",
    instructions: [
      "When a craving hits, set a 5-minute timer",
      "Focus purely on the seconds counting down",
      "After 5 minutes, if the craving is still strong, delay another 5 minutes",
      "After 2–3 delays, most cravings dissolve completely",
    ],
    suitableFor: { minDays: 0 },
  },
  {
    id: "urge-surfing",
    title: "Urge Surfing",
    subtitle: "Mindfulness-based craving response",
    category: "behavioral",
    triggers: ["stress", "social", "morning"],
    effectiveness: 76,
    effort: "medium",
    timeToEffect: "5–10 min",
    description: "Instead of fighting a craving, observe it like a wave — let it rise and fall without acting. Proven to reduce relapse by 35%.",
    instructions: [
      "When a craving comes, sit comfortably and close your eyes",
      "Observe the sensation without judging — where in your body? How strong?",
      "Picture the craving as a wave — watch it grow, peak, and then naturally subside",
      "Don't surf the wave — just observe it passing",
    ],
    suitableFor: { minDays: 14 },
  },
  {
    id: "habit-replacement",
    title: "Habit Replacement Stack",
    subtitle: "Trigger → Routine swap",
    category: "behavioral",
    triggers: ["after-meals", "morning", "boredom", "social"],
    effectiveness: 71,
    effort: "medium",
    timeToEffect: "Ongoing",
    description: "Replace the smoking ritual with a pre-planned healthier routine using the same trigger. Brain rewires within 21 days.",
    instructions: [
      "Identify your top 3 personal smoking triggers",
      "For each trigger, choose a replacement routine (examples below)",
      "After meals → 2-minute walk + cold water",
      "Morning → herbal tea + 5 deep breaths on the balcony",
      "Stress → squeeze a stress ball for 60 seconds, then stretch",
    ],
    suitableFor: { minDays: 0 },
  },
  {
    id: "cbt-thought-record",
    title: "Craving Thought Record",
    subtitle: "Cognitive Behavioural Therapy tool",
    category: "behavioral",
    triggers: ["stress", "social"],
    effectiveness: 69,
    effort: "high",
    timeToEffect: "10–15 min",
    description: "Write down the thought chain behind a craving to interrupt automatic smoking urges. Requires a few minutes but highly effective for habitual thinkers.",
    instructions: [
      "When a craving hits, write: 'I feel like smoking because...'",
      "Then write: 'If I smoke, I expect to feel... but I will actually feel...'",
      "Counter: 'A healthier way to meet this need is...'",
      "Repeat daily — patterns emerge within 2 weeks",
    ],
    suitableFor: { minDays: 7 },
  },
  {
    id: "five-s-rule",
    title: "The 5-S Rule",
    subtitle: "Emergency craving protocol",
    category: "behavioral",
    triggers: ["stress", "boredom", "after-meals"],
    effectiveness: 73,
    effort: "low",
    timeToEffect: "< 5 min",
    description: "A rapid 5-step emergency checklist to run through when a sudden craving hits. Interrupt, redirect, then re-engage.",
    instructions: [
      "S1 — Stop: pause what you are doing",
      "S2 — Sip: drink water or herbal tea slowly",
      "S3 — Stretch: 30 seconds of arm or neck stretch",
      "S4 — Slow breath: one 4-7-8 breath cycle",
      "S5 — Smile: say 'I don't smoke. I'm free.' out loud",
    ],
    suitableFor: { minDays: 0 },
  },

  // ── Herbal ───────────────────────────────────────────────────────────────
  {
    id: "st-johns-wort",
    title: "St. John's Wort",
    subtitle: "Hypericum perforatum · Mood stabiliser",
    category: "herbal",
    triggers: ["stress", "morning"],
    effectiveness: 62,
    effort: "low",
    timeToEffect: "2–4 weeks",
    description: "Herb used for centuries to ease anxiety and mild depression. Clinically shown to reduce withdrawal-related mood swings.",
    instructions: [
      "Take 300mg standardised extract (0.3% hypericin) 3 times daily",
      "Take with food to reduce GI upset",
      "Effects build over 2–4 weeks — do not expect immediate results",
      "Use for 8–12 weeks then reassess",
    ],
    suitableFor: { minDays: 0 },
    warning: "Significant interactions with antidepressants, blood thinners, and contraceptives. Always consult a doctor.",
  },
  {
    id: "valerian-root",
    title: "Valerian Root",
    subtitle: "Natural sleep + anxiety aid",
    category: "herbal",
    triggers: ["stress", "morning"],
    effectiveness: 58,
    effort: "low",
    timeToEffect: "1–2 hours",
    description: "Reduces anxiety and improves sleep quality disrupted by nicotine withdrawal. Most useful in the first 2–4 weeks.",
    instructions: [
      "Take 300–600mg 30–60 minutes before sleep",
      "Or 150–300mg during the day for anxiety",
      "Available as capsules or tea",
    ],
    suitableFor: { maxDays: 90 },
    warning: "May cause drowsiness — do not drive after taking. Avoid with alcohol.",
  },
  {
    id: "green-tea",
    title: "Green Tea & L-Theanine",
    subtitle: "Natural focus + calm combination",
    category: "herbal",
    triggers: ["morning", "after-meals", "boredom"],
    effectiveness: 65,
    effort: "low",
    timeToEffect: "30–60 min",
    description: "L-theanine in green tea produces calm focus without sedation. Replaces the morning cigarette with a ritual that calms cravings and sharpens the mind.",
    instructions: [
      "Brew 1–2 cups green tea in the morning (replace the morning cigarette ritual)",
      "Or take 200mg L-theanine supplement for a caffeine-free option",
      "Pair with 5 minutes of quiet sitting — rebuild the morning ritual differently",
    ],
    suitableFor: { minDays: 0 },
  },
  {
    id: "lobelia",
    title: "Lobelia",
    subtitle: "Lobelia inflata · Traditional smoking cessation herb",
    category: "herbal",
    triggers: ["stress", "boredom"],
    effectiveness: 55,
    effort: "medium",
    timeToEffect: "30–60 min",
    description: "Contains lobeline, which binds to nicotine receptors and may help reduce cravings. Traditional remedy — evidence is mixed.",
    instructions: [
      "Use only as directed by an herbalist or naturopathic doctor",
      "Available as tincture (0.6mL 3x daily) or tea",
      "Do not self-medicate at high doses",
    ],
    suitableFor: { minDays: 0 },
    warning: "High doses are toxic. Must be used under professional guidance. Not recommended in pregnancy.",
  },
];

// ── Scoring function — higher = better fit for this user ──────────────────
function scoreForUser(
  alt: Alternative,
  cigs: number,
  intensity: number,
  recoveryDays: number
): number {
  const s = alt.suitableFor;
  let score = 50;
  if (s.minCigs !== undefined && cigs < s.minCigs) score -= 30;
  if (s.maxCigs !== undefined && cigs > s.maxCigs) score -= 30;
  if (s.minDays !== undefined && recoveryDays < s.minDays) score -= 20;
  if (s.maxDays !== undefined && recoveryDays > s.maxDays) score -= 20;
  if (s.minIntensity !== undefined && intensity < s.minIntensity) score -= 20;
  if (s.maxIntensity !== undefined && intensity > s.maxIntensity) score -= 20;
  // Bonus for high effectiveness
  score += alt.effectiveness * 0.3;
  return score;
}

// ── Effort badge colour ───────────────────────────────────────────────────
const EFFORT_COLOR = {
  low: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-rose-100 text-rose-700",
};

// ── Category config ───────────────────────────────────────────────────────
const CATEGORIES: { value: Category | "all"; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All", icon: <Sparkles className="w-3.5 h-3.5" /> },
  { value: "nrt", label: "NRT", icon: <Pill className="w-3.5 h-3.5" /> },
  { value: "holistic", label: "Holistic", icon: <Wind className="w-3.5 h-3.5" /> },
  { value: "behavioral", label: "Behavioral", icon: <Brain className="w-3.5 h-3.5" /> },
  { value: "herbal", label: "Herbal", icon: <Leaf className="w-3.5 h-3.5" /> },
];

const TRIGGERS: { value: Trigger; label: string }[] = [
  { value: "all", label: "Any Trigger" },
  { value: "stress", label: "😤 Stress" },
  { value: "boredom", label: "😴 Boredom" },
  { value: "after-meals", label: "🍽 After Meals" },
  { value: "morning", label: "🌅 Morning" },
  { value: "social", label: "👥 Social" },
];

const CAT_ICON: Record<Category, React.ReactNode> = {
  nrt: <Pill className="w-4 h-4" />,
  holistic: <Wind className="w-4 h-4" />,
  behavioral: <Brain className="w-4 h-4" />,
  herbal: <Leaf className="w-4 h-4" />,
};

const CAT_COLOR: Record<Category, string> = {
  nrt: "bg-blue-50 text-blue-700 border-blue-200",
  holistic: "bg-teal-50 text-teal-700 border-teal-200",
  behavioral: "bg-purple-50 text-purple-700 border-purple-200",
  herbal: "bg-green-50 text-green-700 border-green-200",
};

// ── Component ─────────────────────────────────────────────────────────────
const AlternativeSolutions = () => {
  const [pageLoading, setPageLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [activeTrigger, setActiveTrigger] = useState<Trigger>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dayNumber, setDayNumber] = useState(1);

  // User data
  const [cigs, setCigs] = useState(20);
  const [intensity, setIntensity] = useState(0.5);
  const [recoveryDays, setRecoveryDays] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPageLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("quit_date, cigarettes_per_day, years_smoked")
        .eq("id", user.id)
        .single();

      if (profile) {
        const c = Number(profile.cigarettes_per_day ?? 20);
        const y = Number(profile.years_smoked ?? 5);
        const packYears = (c / 20) * y;
        const rd = profile.quit_date
          ? Math.max(0, differenceInDays(new Date(), new Date(profile.quit_date)))
          : 0;
        setCigs(c);
        setIntensity(Math.min(packYears / 40, 1));
        setRecoveryDays(rd);
        setDayNumber(rd + 1);
      }
      setPageLoading(false);
    };
    load();
  }, []);

  if (pageLoading) return <PageLoader message="Loading your recommendations..." />;

  // Smart recommendations: top 4 by score across all categories
  const recommended = [...LIBRARY]
    .map(a => ({ ...a, score: scoreForUser(a, cigs, intensity, recoveryDays) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  // Filtered library
  const filtered = LIBRARY.filter(a => {
    const catOk = activeCategory === "all" || a.category === activeCategory;
    const triggerOk = activeTrigger === "all" || a.triggers.includes(activeTrigger);
    return catOk && triggerOk;
  });

  // Context banner text
  const contextMsg =
    recoveryDays < 7
      ? `You're in the hardest phase (first week). NRT is strongly recommended right now.`
      : recoveryDays < 30
        ? `You're past the first week — cravings are easing. Keep using NRT + breathwork.`
        : recoveryDays < 90
          ? `Month 1+ done — great work! Behavioral strategies are now key for long-term success.`
          : `You've passed 3 months! Holistic and behavioral tools will carry you the rest of the way.`;

  return (
    <div className="min-h-screen bg-gradient-hero pb-32">
      <DashboardHeader dayNumber={dayNumber} />

      <div className="p-4 max-w-5xl mx-auto space-y-5">

        {/* Hero */}
        <div>
          <h1 className="text-2xl font-bold mb-1">Alternative Solutions</h1>
          <p className="text-muted-foreground text-sm">
            Personalised NRT, holistic, and behavioral recommendations based on your smoking history.
          </p>
        </div>

        {/* Context banner */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex gap-3 items-start">
          <Zap className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-0.5">
              Day {recoveryDays} · {cigs} cigs/day profile
            </p>
            <p className="text-sm text-foreground">{contextMsg}</p>
          </div>
        </div>

        {/* ── Recommended For You ────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-amber-500" />
            <h2 className="text-base font-bold">Recommended For You</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {recommended.map((alt, idx) => (
              <Card
                key={alt.id}
                className={`border-2 ${idx === 0 ? "border-primary/40 bg-primary/5" : "border-border"} cursor-pointer transition-all`}
                onClick={() => setExpanded(expanded === alt.id ? null : alt.id)}
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {idx === 0 && (
                        <span className="text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">
                          #1 Best Fit
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${CAT_COLOR[alt.category]}`}>
                        {alt.category.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingUp className="w-3 h-3" />
                      {alt.effectiveness}% effective
                    </div>
                  </div>
                  <CardTitle className="text-base mt-2">{alt.title}</CardTitle>
                  <CardDescription>{alt.subtitle}</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-sm text-muted-foreground mb-3">{alt.description}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${EFFORT_COLOR[alt.effort]}`}>
                      {alt.effort} effort
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" /> {alt.timeToEffect}
                    </span>
                    {alt.price && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        💰 {alt.price}
                      </span>
                    )}
                  </div>
                  {/* Effectiveness bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Effectiveness</span>
                      <span>{alt.effectiveness}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-primary rounded-full" style={{ width: `${alt.effectiveness}%` }} />
                    </div>
                  </div>
                  {/* Instructions (expanded) */}
                  {expanded === alt.id && (
                    <div className="mt-3 border-t pt-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground">How to use:</p>
                      {alt.instructions.map((step, i) => (
                        <div key={i} className="flex gap-2 text-sm">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                            {i + 1}
                          </span>
                          <span className="text-muted-foreground">{step}</span>
                        </div>
                      ))}
                      {alt.warning && (
                        <div className="flex gap-2 mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700">{alt.warning}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <button className="mt-2 text-xs text-primary font-medium">
                    {expanded === alt.id ? "▲ Show less" : "▼ How to use"}
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Browse by category</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setActiveCategory(c.value as Category | "all")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${activeCategory === c.value
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-background border-border text-muted-foreground hover:border-primary/40"
                  }`}
              >
                {c.icon}{c.label}
              </button>
            ))}
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Filter by craving trigger</p>
          <div className="flex flex-wrap gap-2">
            {TRIGGERS.map(t => (
              <button
                key={t.value}
                onClick={() => setActiveTrigger(t.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${activeTrigger === t.value
                  ? "bg-secondary text-white border-secondary shadow-sm"
                  : "bg-background border-border text-muted-foreground hover:border-secondary/40"
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Full Library ───────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Full Library</h2>
            <span className="text-xs text-muted-foreground">{filtered.length} options</span>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No results for this combination. Try a different filter.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map(alt => (
                <Card
                  key={alt.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setExpanded(expanded === alt.id + "_lib" ? null : alt.id + "_lib")}
                >
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`p-1 rounded-md border ${CAT_COLOR[alt.category]}`}>
                          {CAT_ICON[alt.category]}
                        </span>
                        <CardTitle className="text-sm font-semibold">{alt.title}</CardTitle>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${EFFORT_COLOR[alt.effort]}`}>
                          {alt.effort}
                        </span>
                        <span className="text-xs font-bold text-primary">{alt.effectiveness}%</span>
                      </div>
                    </div>
                    <CardDescription className="mt-1">{alt.subtitle}</CardDescription>
                  </CardHeader>

                  {expanded === alt.id + "_lib" && (
                    <CardContent className="px-4 pb-4">
                      <p className="text-sm text-muted-foreground mb-3">{alt.description}</p>

                      {/* Trigger chips */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {alt.triggers.filter(t => t !== "all").map(t => (
                          <span key={t} className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                            {TRIGGERS.find(x => x.value === t)?.label ?? t}
                          </span>
                        ))}
                      </div>

                      <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {alt.timeToEffect}</span>
                        {alt.price && <span>💰 {alt.price}</span>}
                      </div>

                      {/* Effectiveness bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Effectiveness</span><span>{alt.effectiveness}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-primary rounded-full" style={{ width: `${alt.effectiveness}%` }} />
                        </div>
                      </div>

                      {/* Instructions */}
                      <p className="text-xs font-semibold text-foreground mb-2">How to use:</p>
                      <div className="space-y-2">
                        {alt.instructions.map((step, i) => (
                          <div key={i} className="flex gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">{step}</span>
                          </div>
                        ))}
                      </div>

                      {alt.warning && (
                        <div className="flex gap-2 mt-3 p-2 rounded-lg bg-amber-50 border border-amber-200">
                          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700">{alt.warning}</p>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <Card className="bg-muted/40 border-border">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Shield className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                All suggestions are evidence-based but should be discussed with your healthcare provider,
                especially if you have existing medical conditions or take medications.
              </p>
            </div>
          </CardContent>
        </Card>

      </div>
      <BottomNav />
    </div>
  );
};

export default AlternativeSolutions;
