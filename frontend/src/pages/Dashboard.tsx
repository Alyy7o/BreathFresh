import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BottomNav } from "@/components/BottomNav";
import { DashboardHeader } from "@/components/DashboardHeader";
import { StatsCard } from "@/components/StatsCard";
import { Clock, DollarSign, Heart, Cigarette, TrendingUp, MoreVertical, RotateCcw, Calendar, Sparkles, Bell, Banknote, Trophy } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { toast as sonnerToast } from "sonner";
import PageLoader from "@/components/PageLoader";
import { Badge } from "@/components/ui/badge";

const motivationalQuotes = [
  "Every cigarette you don't smoke is a victory!",
  "Your body is healing with every smoke-free hour.",
  "Stay strong, the cravings will pass!",
  "You're not giving up anything, you're gaining everything!",
  "The best time to quit was yesterday. The second best time is now.",
  "Freedom feels better than any cigarette ever did.",
];

type TimeframeType = "1week" | "1month" | "3months" | "6months" | "1year";

interface GoalProgression {
  current: TimeframeType;
  next: TimeframeType | null;
  order: number;
}

const goalProgression: GoalProgression[] = [
  { current: "1week", next: "1month", order: 1 },
  { current: "1month", next: "3months", order: 2 },
  { current: "3months", next: "6months", order: 3 },
  { current: "6months", next: "1year", order: 4 },
  { current: "1year", next: null, order: 5 },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pageLoading, setPageLoading] = useState(true);
  const [stats, setStats] = useState({
    smokeFreeTime: { hours: 0, minutes: 0, seconds: 0 },
    moneySaved: 0,
    lifeRegained: 0,
    cigarettesNotSmoked: 0,
    dayNumber: 1,
    progressPercentage: 6.5,
  });
  const [timeframe, setTimeframe] = useState<TimeframeType>("1week");
  const [currentQuote, setCurrentQuote] = useState(0);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [goalUpdateBanner, setGoalUpdateBanner] = useState<{
    visible: boolean;
    message: string;
  }>({ visible: false, message: "" });
  const [isUpdatingGoal, setIsUpdatingGoal] = useState(false);

  useEffect(() => {
    // Fetch profile data and calculate stats
    const fetchProfileAndCalculate = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/login");
        setPageLoading(false);
        return;
      }

      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id);

      if (error) {
        console.error('Error fetching profile:', error);
        navigate("/onboarding");
        setPageLoading(false);
        return;
      }

      const profile = profiles?.[0];
      if (!profile?.quit_date) {
        navigate("/onboarding");
        setPageLoading(false);
        return;
      }

      // Get user's current goal timeframe from profile or default to 1week
      let currentTimeframe: TimeframeType = "1week";
      try {
        currentTimeframe = (profile as any).current_goal || "1week";
      } catch (error) {
        console.log("current_goal column doesn't exist yet, using default");
      }
      setTimeframe(currentTimeframe);

      const quitDate = new Date(profile.quit_date);
      const cigarettesPerDay = profile.cigarettes_per_day || 20;
      const packCost = profile.pack_cost || 10;
      const cigarettesPerPack = profile.cigarettes_per_pack || 20;
      const pricePerCigarette = packCost / cigarettesPerPack;

    const updateStats = () => {
      const now = new Date();
      const diffMs = now.getTime() - quitDate.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const cigarettesAvoided = Math.floor((diffMs / (1000 * 60 * 60 * 24)) * cigarettesPerDay);
      const moneySaved = cigarettesAvoided * pricePerCigarette;
      const lifeRegainedMinutes = cigarettesAvoided * 11; // avg 11 minutes per cigarette

      // Calculate target duration based on user-selected timeframe
      let targetDuration = 7; // Default to 1 week
      if (currentTimeframe === "1week") targetDuration = 7;
      if (currentTimeframe === "1month") targetDuration = 30;
      if (currentTimeframe === "3months") targetDuration = 90;
      if (currentTimeframe === "6months") targetDuration = 180;
      if (currentTimeframe === "1year") targetDuration = 365;
      
      const progressPercentage = Math.min((diffDays / targetDuration) * 100, 100);

      setStats({
        smokeFreeTime: {
          hours: diffHours,
          minutes: diffMinutes,
          seconds: diffSeconds,
        },
        moneySaved: parseFloat(moneySaved.toFixed(2)),
        lifeRegained: lifeRegainedMinutes,
        cigarettesNotSmoked: cigarettesAvoided,
        dayNumber: diffDays,
        progressPercentage,
      });

      // Check if goal is completed and needs to be updated
      if (progressPercentage >= 100 && !isUpdatingGoal) {
        checkAndUpdateGoal(user.id, currentTimeframe, diffDays);
      }
    };

      updateStats();
      // Initial stats calculated, page can render
      setPageLoading(false);
      const interval = setInterval(updateStats, 1000);
      return () => clearInterval(interval);
    };

    fetchProfileAndCalculate();
  }, [timeframe, navigate]);

  // Quote carousel
  useEffect(() => {
    const quoteInterval = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % motivationalQuotes.length);
    }, 5000);
    return () => clearInterval(quoteInterval);
  }, []);

  const checkAndUpdateGoal = async (userId: string, currentTimeframe: TimeframeType, daysSoFar: number) => {
    setIsUpdatingGoal(true);
    
    try {
      // Find the current goal in the progression
      const currentGoal = goalProgression.find(goal => goal.current === currentTimeframe);
      
      if (currentGoal && currentGoal.next) {
        // Update the user's goal to the next timeframe
        const { error } = await supabase
          .from('profiles')
          .update({ current_goal: currentGoal.next } as any)
          .eq('id', userId);
          
        if (error) {
          console.error('Error updating goal:', error);
          return;
        }
        
        // Show goal update banner
        const nextGoalLabel = currentGoal.next === "1month" ? "1 Month" :
                              currentGoal.next === "3months" ? "3 Months" :
                              currentGoal.next === "6months" ? "6 Months" : "1 Year";
        
        setGoalUpdateBanner({
          visible: true,
          message: `Goal updated to ${nextGoalLabel}!`
        });
        
        // Update the timeframe state
        setTimeframe(currentGoal.next);
        
        // Hide the banner after 5 seconds
        setTimeout(() => {
          setGoalUpdateBanner({ visible: false, message: "" });
        }, 5000);
      }
    } catch (error) {
      console.error('Error in goal progression:', error);
    } finally {
      setIsUpdatingGoal(false);
    }
  };

  if (pageLoading) {
    return <PageLoader message="Loading dashboard..." />;
  }

  const handleReset = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    // Reset to 1 week goal and update quit date
    const { error } = await supabase
      .from('profiles')
      .update({
        quit_date: new Date().toISOString(),
        current_goal: "1week"
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error resetting journey:', error);
      sonnerToast.error("Failed to reset journey");
      return;
    }

    sonnerToast.success("Your journey has been reset! Keep going strong!");
    setShowResetDialog(false);
    
    // Force a refresh of stats by triggering the useEffect
    window.location.reload();
  };

  const getTimeframeLabel = () => {
    if (timeframe === "1week") return "1 Week";
    if (timeframe === "1month") return "1 Month";
    if (timeframe === "3months") return "3 Months";
    if (timeframe === "6months") return "6 Months";
    return "1 Year";
  };

  const getTargetDuration = () => {
    if (timeframe === "1week") return 7;
    if (timeframe === "1month") return 30;
    if (timeframe === "3months") return 90;
    if (timeframe === "6months") return 180;
    if (timeframe === "1year") return 365;
    return 7;
  };

  const getProjections = () => {
    const dailyRate = stats.moneySaved / (stats.dayNumber || 1);
    const dailyLife = stats.lifeRegained / (stats.dayNumber || 1);
    
    return [
      { 
        period: "1 Week", 
        money: dailyRate * 7, 
        life: Math.round(dailyLife * 7)
      },
      { 
        period: "1 Month", 
        money: dailyRate * 30, 
        life: Math.round(dailyLife * 30)
      },
      { 
        period: "6 Months", 
        money: dailyRate * 180, 
        life: Math.round(dailyLife * 180)
      },
      { 
        period: "1 Year", 
        money: dailyRate * 365, 
        life: Math.round(dailyLife * 365)
      },
    ];
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="min-h-screen bg-gradient-hero pb-20">
      <DashboardHeader dayNumber={stats.dayNumber} />

      {/* Goal Update Banner */}
      {goalUpdateBanner.visible && (
        <div className="fixed top-16 left-0 right-0 z-50 bg-green-500 text-white py-2 px-4 text-center animate-fade-in">
          <div className="flex items-center justify-center gap-2">
            <Trophy className="w-5 h-5" />
            <span className="font-medium">{goalUpdateBanner.message}</span>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
        {/* Main Progress Circle */}
        <Card className="animate-scale-in border-border/60 shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="space-y-4 text-center sm:space-y-6">
              <div className="relative inline-flex items-center justify-center">
                <svg className="h-40 w-40 -rotate-90 transform sm:h-48 sm:w-48 lg:h-56 lg:w-56" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke={stats.progressPercentage >= 100 ? "hsl(var(--success))" : "hsl(var(--primary))"}
                    strokeWidth="3.5"
                    fill="none"
                    strokeDasharray={`${(stats.progressPercentage * 282.74) / 100} 282.74`}
                    className="transition-all duration-1000"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <div className="mb-1 flex items-center justify-center gap-1 sm:gap-2">
                    <Calendar className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
                    <span className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">{stats.dayNumber}</span>
                  </div>
                  <div className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                    {stats.progressPercentage.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {getTimeframeLabel()} Goal
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats.dayNumber} / {getTargetDuration()} days
                  </div>
                  {stats.progressPercentage >= 100 && (
                    <div className="text-xs text-success font-bold mt-1 flex items-center justify-center gap-1">
                      <Trophy className="w-3 h-3" />
                      Goal Completed!
                    </div>
                  )}
                </div>
              </div>
              <div className="min-h-[50px] sm:min-h-[60px] flex items-center justify-center px-4">
                <h2 className="flex animate-fade-in items-center justify-center gap-2 text-center text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  <Sparkles className="h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5" />
                  <span className="leading-tight">{motivationalQuotes[currentQuote]}</span>
                </h2>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reset Button */}
        <Button 
          variant="outline" 
          className="w-full flex items-center gap-2"
          onClick={() => setShowResetDialog(true)}
        >
          <RotateCcw className="w-4 h-4" />
          Reset Journey
        </Button>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatsCard
            icon={Clock}
            value={`${stats.smokeFreeTime.hours}h ${stats.smokeFreeTime.minutes}m ${stats.smokeFreeTime.seconds}s`}
            label="Smoke Free Time"
            iconColor="text-primary"
          />
          <StatsCard
            icon={Banknote}
            value={`Rs. ${stats.moneySaved.toFixed(2)}`}
            label="Money Saved"
            iconColor="text-success"
          />
          <StatsCard
            icon={Heart}
            value={formatTime(stats.lifeRegained)}
            label="Life Regained"
            iconColor="text-secondary"
          />
          <StatsCard
            icon={Cigarette}
            value={stats.cigarettesNotSmoked.toString()}
            label="Not Smoked"
            iconColor="text-warning"
          />
        </div>

        {/* Long-term Projections */}
        <Card className="overflow-hidden border-border/60 shadow-sm">
          <CardContent className="p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-extrabold tracking-tight">
              <TrendingUp className="h-5 w-5 text-primary" />
              What will you get in return?
            </h3>
            <div className="text-sm text-muted-foreground mb-2">Money and Life Expectancy</div>
            <div className="space-y-3">
              {getProjections().map((item) => (
                <div key={item.period} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="font-medium">{item.period}</span>
                  <div className="text-right">
                    <div className="font-semibold text-success">Rs. {item.money.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">{formatTime(item.life)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Ready for a Fresh Start?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <div className="font-semibold text-foreground">
                  "The greatest glory in living lies not in never falling, but in rising every time we fall."
                </div>
                <div>
                  Resetting will clear all your current progress and restart from 1 week goal. Are you sure you want to start over?
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>
              Yes, Reset My Journey
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
};

export default Dashboard;