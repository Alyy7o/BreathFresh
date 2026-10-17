import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/DashboardHeader";
import { BottomNav } from "@/components/BottomNav";
import { Clock, Coffee, Car, Home, Users, Briefcase, CheckCircle2, ChevronLeft, ChevronRight, CalendarDays, X, Trash2 } from "lucide-react";
import PageLoader from "@/components/PageLoader";

const triggers = [
  { id: "stress", label: "Stress", icon: Clock },
  { id: "coffee", label: "Coffee/Drinks", icon: Coffee },
  { id: "driving", label: "Driving", icon: Car },
  { id: "home", label: "At Home", icon: Home },
  { id: "social", label: "Social Situations", icon: Users },
  { id: "work", label: "Work Break", icon: Briefcase },
];

const copingStrategies = [
  "Take 5 deep breaths",
  "Drink a glass of water",
  "Go for a short walk",
  "Call a supportive friend",
  "Practice mindfulness",
  "Chew gum or toothpick",
];

interface Craving {
  id: string;
  intensity: number;
  trigger: string;
  notes: string;
  created_at: string;
}

const PAGE_SIZE = 8;

const INTENSITY_COLORS = [
  { max: 3, text: "text-accent", bg: "bg-accent/10", label: "Mild" },
  { max: 6, text: "text-amber-500", bg: "bg-amber-50", label: "Moderate" },
  { max: 10, text: "text-rose-500", bg: "bg-rose-50", label: "Intense" },
];

function intensityMeta(value: number) {
  return INTENSITY_COLORS.find(c => value <= c.max) ?? INTENSITY_COLORS[2];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit",
  });
}
function toDateKey(iso: string) {
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

export default function CravingLog() {
  const navigate = useNavigate();
  const [intensity, setIntensity] = useState([5]);
  const [selectedTrigger, setSelectedTrigger] = useState("");
  const [notes, setNotes] = useState("");
  const [allCravings, setAllCravings] = useState<Craving[]>([]);
  const [loading, setLoading] = useState(false);
  const [dayNumber, setDayNumber] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);

  // Filter state
  const [filterDate, setFilterDate] = useState("");   // "YYYY-MM-DD" or ""
  const [currentPage, setCurrentPage] = useState(1);

  // ── Auth + initial load ────────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }

      const quitDate = localStorage.getItem("quit_date");
      if (quitDate) {
        const diff = Math.floor((Date.now() - new Date(quitDate).getTime()) / 86_400_000);
        setDayNumber(diff);
      }

      await fetchAllCravings();
      setPageLoading(false);
    };
    checkAuth();
  }, [navigate]);

  const fetchAllCravings = async () => {
    const { data, error } = await supabase
      .from("cravings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) { console.error("Error fetching cravings:", error); return; }
    setAllCravings(data || []);
  };

  // ── Log craving ────────────────────────────────────────────────────────────
  const handleDeleteCraving = async (id: string) => {
    // Optimistic update
    setAllCravings(prev => prev.filter(c => c.id !== id));
    const { error } = await supabase.from("cravings").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete craving");
      await fetchAllCravings(); // re-sync on failure
    } else {
      toast.success("Craving deleted");
    }
  };

  const handleLogCraving = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please log in to log cravings"); navigate("/login"); return; }

    const { error } = await supabase.from("cravings").insert({
      user_id: user.id,
      intensity: intensity[0],
      trigger: selectedTrigger,
      notes,
    });

    if (error) {
      toast.error("Failed to log craving");
    } else {
      toast.success("Craving logged successfully!");
      setIntensity([5]);
      setSelectedTrigger("");
      setNotes("");
      setCurrentPage(1);
      await fetchAllCravings();
    }
    setLoading(false);
  };

  // ── Filtered + paginated cravings ─────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!filterDate) return allCravings;
    return allCravings.filter(c => toDateKey(c.created_at) === filterDate);
  }, [allCravings, filterDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // When filter changes, reset to page 1
  useEffect(() => { setCurrentPage(1); }, [filterDate]);

  // ── Unique dates in data for the calendar hint ────────────────────────────
  const datesWithData = useMemo(
    () => new Set(allCravings.map(c => toDateKey(c.created_at))),
    [allCravings]
  );

  const getIntensityLabel = (v: number) => intensityMeta(v).label + ` (${v}/10)`;
  const getIntensityColor = (v: number) => intensityMeta(v).text;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (pageLoading) return <PageLoader message="Loading cravings..." />;

  return (
    <div className="min-h-screen bg-gradient-hero pb-20">
      <DashboardHeader dayNumber={dayNumber} />

      <div className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">

        {/* ── Log form ────────────────────────────────────────────────────── */}
        <Card className="p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Log Current Craving</h2>
            <p className="text-muted-foreground">Track your cravings to personalise your quit journey</p>
          </div>

          {/* Intensity */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-lg font-semibold">Intensity Level</Label>
              <span className={`text-2xl font-bold ${getIntensityColor(intensity[0])}`}>{intensity[0]}</span>
              <span className={`text-sm font-medium ${getIntensityColor(intensity[0])}`}>{getIntensityLabel(intensity[0])}</span>
            </div>
            <Slider value={intensity} onValueChange={setIntensity} min={1} max={10} step={1} className="w-full" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Mild (1-3)</span><span>Moderate (4-6)</span><span>Intense (7-10)</span>
            </div>
          </div>

          {/* Triggers */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold">What triggered this craving?</Label>
            <RadioGroup value={selectedTrigger} onValueChange={setSelectedTrigger}>
              <div className="grid grid-cols-2 gap-3">
                {triggers.map(({ id, label, icon: Icon }) => (
                  <div key={id} className="flex items-center space-x-2">
                    <RadioGroupItem value={id} id={id} />
                    <Label htmlFor={id} className="flex items-center gap-2 cursor-pointer">
                      <Icon className="h-4 w-4" />{label}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-lg font-semibold">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="How are you feeling? What's happening around you?"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <Button onClick={handleLogCraving} disabled={loading || !selectedTrigger} className="w-full text-lg py-6" size="lg">
            {loading ? "Logging..." : "Log Craving"}
          </Button>
        </Card>

        {/* ── Coping strategies ───────────────────────────────────────────── */}
        <Card className="p-6 space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />Coping Strategies
          </h3>
          <p className="text-sm text-muted-foreground">Try these techniques to manage your craving:</p>
          <div className="grid grid-cols-2 gap-2">
            {copingStrategies.map((s, i) => (
              <div key={i} className="p-3 bg-success/10 rounded-lg flex items-center gap-3 hover:bg-success/20 transition-colors">
                <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                <span className="text-sm">{s}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Craving History ─────────────────────────────────────────────── */}
        <Card className="p-6 space-y-4">
          {/* Header + filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Clock className="h-5 w-5" />Craving History
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {allCravings.length} total entries
                {filterDate && ` · showing ${filtered.length} for ${fmtDate(filterDate + "T00:00:00")}`}
              </p>
            </div>

            {/* Date filter */}
            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <CalendarDays className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {filterDate && (
                <button
                  onClick={() => setFilterDate("")}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-1.5 transition-colors"
                >
                  <X className="w-3 h-3" />Clear
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              {filterDate ? "No cravings logged on this date." : "No cravings logged yet. Track your first craving above!"}
            </p>
          ) : (
            <>
              {/* Cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {paginated.map(craving => {
                  const meta = intensityMeta(craving.intensity);
                  const trig = triggers.find(t => t.id === craving.trigger);
                  return (
                    <div key={craving.id} className={`p-4 border rounded-xl space-y-2 ${meta.bg} hover:shadow-sm transition-shadow`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold px-2 py-0.5 rounded-full bg-white/60 ${meta.text}`}>
                          {meta.label} · {craving.intensity}/10
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{fmtDate(craving.created_at)}</span>
                          <button
                            onClick={() => handleDeleteCraving(craving.id)}
                            className="p-1 rounded-md hover:bg-red-100 text-muted-foreground hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Intensity bar */}
                      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${meta.text.replace("text-", "bg-")}`}
                          style={{ width: `${craving.intensity * 10}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        {trig && (
                          <span className="flex items-center gap-1">
                            <trig.icon className="w-3 h-3" />{trig.label}
                          </span>
                        )}
                        <span>{fmtTime(craving.created_at)}</span>
                      </div>

                      {craving.notes && (
                        <p className="text-xs text-foreground/70 italic border-t border-white/40 pt-1.5 line-clamp-2">
                          "{craving.notes}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── Pagination ──────────────────────────────────────────────── */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">
                    Page {currentPage} of {totalPages} · {filtered.length} entries
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>

                    {/* Page number chips */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(n => n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1)
                      .reduce<(number | "…")[]>((acc, n, i, arr) => {
                        if (i > 0 && (n as number) - (arr[i - 1] as number) > 1) acc.push("…");
                        acc.push(n);
                        return acc;
                      }, [])
                      .map((item, i) =>
                        item === "…" ? (
                          <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground text-sm">…</span>
                        ) : (
                          <Button
                            key={item}
                            variant={currentPage === item ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(item as number)}
                          >
                            {item}
                          </Button>
                        )
                      )}

                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

      </div>
      <BottomNav />
    </div>
  );
}
