import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BottomNav } from "@/components/BottomNav";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Clock, Check } from "lucide-react";

interface Milestone {
  title: string;
  timeframe: string;
  progress: number;
  achieved: boolean;
  daysLeft?: string;
}

const HealthMilestones = () => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [dayNumber, setDayNumber] = useState(1);

  useEffect(() => {
    const quitDate = new Date(localStorage.getItem("quit_date") || new Date());
    const now = new Date();
    const diffMs = now.getTime() - quitDate.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    setDayNumber(Math.floor(diffDays) + 1);

    const calculateProgress = (targetMinutes: number) => {
      const progress = (diffMinutes / targetMinutes) * 100;
      return Math.min(Math.max(progress, 0), 100);
    };

    const calculateDaysLeft = (targetMinutes: number) => {
      const remainingMinutes = Math.max(targetMinutes - diffMinutes, 0);
      const days = Math.floor(remainingMinutes / (60 * 24));
      const hours = Math.floor((remainingMinutes % (60 * 24)) / 60);
      if (days > 0) return `In ${days} days`;
      if (hours > 0) return `In ${hours} hr.`;
      return "Almost there!";
    };

    const milestonesData: Milestone[] = [
      {
        title: "After 20 minutes: Your blood pressure and heart rate decrease.",
        timeframe: "20 minutes",
        progress: calculateProgress(20),
        achieved: diffMinutes >= 20,
      },
      {
        title: "After 8 hours: The carbon monoxide level in your blood returns to normal.",
        timeframe: "8 hours",
        progress: calculateProgress(8 * 60),
        achieved: diffHours >= 8,
        daysLeft: diffHours < 8 ? calculateDaysLeft(8 * 60) : undefined,
      },
      {
        title: "After 24 hours: Your chance of heart attack decreases.",
        timeframe: "24 hours",
        progress: calculateProgress(24 * 60),
        achieved: diffHours >= 24,
        daysLeft: diffHours < 24 ? calculateDaysLeft(24 * 60) : undefined,
      },
      {
        title: "After 48 hours: Your ability to taste and smell starts to return.",
        timeframe: "48 hours",
        progress: calculateProgress(48 * 60),
        achieved: diffHours >= 48,
        daysLeft: diffHours < 48 ? calculateDaysLeft(48 * 60) : undefined,
      },
      {
        title: "After 72 hours: Your airways start to relax.",
        timeframe: "72 hours",
        progress: calculateProgress(72 * 60),
        achieved: diffHours >= 72,
        daysLeft: diffHours < 72 ? calculateDaysLeft(72 * 60) : undefined,
      },
      {
        title: "After 5 to 8 days: The average number of cravings is reduced to 3 per day.",
        timeframe: "5-8 days",
        progress: calculateProgress(7 * 24 * 60),
        achieved: diffDays >= 7,
        daysLeft: diffDays < 7 ? calculateDaysLeft(7 * 24 * 60) : undefined,
      },
      {
        title: "After 10 to 14 days: Blood circulation in your gums and teeth returns to normal. Cravings are reduced to 2 per day (average).",
        timeframe: "10-14 days",
        progress: calculateProgress(12 * 24 * 60),
        achieved: diffDays >= 12,
        daysLeft: diffDays < 12 ? calculateDaysLeft(12 * 24 * 60) : undefined,
      },
      {
        title: "After 2 to 12 weeks: Your circulation improves and your lung function increases.",
        timeframe: "2-12 weeks",
        progress: calculateProgress(49 * 24 * 60),
        achieved: diffDays >= 49,
        daysLeft: diffDays < 49 ? calculateDaysLeft(49 * 24 * 60) : undefined,
      },
      {
        title: "After 3 to 4 weeks: Cessation related anger, anxiety, restlessness and depression have ended.",
        timeframe: "3-4 weeks",
        progress: calculateProgress(25 * 24 * 60),
        achieved: diffDays >= 25,
        daysLeft: diffDays < 25 ? calculateDaysLeft(25 * 24 * 60) : undefined,
      },
      {
        title: "After 2 months: Insulin resistance has normalized despite average weight gain of 5.95 lb (2.7kg)",
        timeframe: "2 months",
        progress: calculateProgress(60 * 24 * 60),
        achieved: diffDays >= 60,
        daysLeft: diffDays < 60 ? calculateDaysLeft(60 * 24 * 60) : undefined,
      },
    ];

    setMilestones(milestonesData);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-hero pb-20">
      <DashboardHeader dayNumber={dayNumber} />

      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Health Recovery Timeline</h2>

        {milestones.map((milestone, index) => (
          <Card
            key={index}
            className={`shadow-md transition-all duration-300 hover:shadow-lg animate-fade-in ${
              milestone.achieved ? "border-success" : ""
            }`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardContent className="p-4">
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{milestone.title}</p>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{milestone.progress.toFixed(0)}%</span>
                    {milestone.achieved ? (
                      <div className="flex items-center gap-1 text-success font-semibold">
                        <Check className="w-4 h-4" />
                        Achieved
                      </div>
                    ) : milestone.daysLeft ? (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {milestone.daysLeft}
                      </div>
                    ) : null}
                  </div>
                  
                  <Progress
                    value={milestone.progress}
                    className={`h-2 ${
                      milestone.achieved
                        ? "[&>div]:bg-gradient-success"
                        : "[&>div]:bg-gradient-primary"
                    }`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <BottomNav />
    </div>
  );
};

export default HealthMilestones;
