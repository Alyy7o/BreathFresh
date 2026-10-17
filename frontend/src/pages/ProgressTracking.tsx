import { useEffect, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BottomNav } from "@/components/BottomNav";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { Calendar, DollarSign, Heart, TrendingUp, Award, Download, Activity, Banknote, Wind, Droplets, Clock, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { DashboardHeader } from "@/components/DashboardHeader";
import PageLoader from "@/components/PageLoader";
import {
  computeHealthRecovery,
  getDaysSinceQuit,
  HEALTH_METRIC_COLORS,
  type HealthMetricKey,
} from "@/lib/healthRecovery";

const PROGRESS_HEALTH_ICONS: Record<HealthMetricKey, ReactNode> = {
  oxygen: <Droplets className="w-4 h-4" />,
  lung: <Wind className="w-4 h-4" />,
  circulation: <Activity className="w-4 h-4" />,
  heart: <Heart className="w-4 h-4" />,
};

const ProgressTracking = () => {
  const navigate = useNavigate();
  const [timeframe, setTimeframe] = useState<"week" | "month" | "all">("week");
  const [dailyProgressData, setDailyProgressData] = useState<any[]>([]);
  const [moneySavedData, setMoneySavedData] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalDays: 0,
    totalMoney: 0,
    cigarettesAvoided: 0,
    healthScore: 0
  });
  const [profile, setProfile] = useState<any>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAndCalculateProgress = async () => {
      setLoadError(null);
      try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/login");
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id);

      const userProfile = profiles?.[0];
      if (!userProfile?.quit_date) {
        navigate("/onboarding");
        return;
      }

      setProfile(userProfile);

      const quitDate = new Date(userProfile.quit_date);
      const now = new Date();
      const cigarettesPerDay = userProfile.cigarettes_per_day || 20;
      const packCost = userProfile.pack_cost || 10;
      const cigarettesPerPack = userProfile.cigarettes_per_pack || 20;
      const pricePerCigarette = packCost / cigarettesPerPack;

      const totalDays = getDaysSinceQuit(quitDate);
      const totalCigarettesAvoided = totalDays * cigarettesPerDay;
      const totalMoney = totalCigarettesAvoided * pricePerCigarette;

      const recovery = computeHealthRecovery(
        {
          cigarettesPerDay: userProfile.cigarettes_per_day,
          yearsSmoked: userProfile.years_smoked,
        },
        totalDays,
      );

      setStats({
        totalDays,
        totalMoney,
        cigarettesAvoided: totalCigarettesAvoided,
        healthScore: recovery.overallRecoveryPct,
      });

      // Calculate daily progress data with real dates
      const dailyData = [];
      const moneyData = [];
      let daysToShow = 7;
      
      if (timeframe === "month") daysToShow = 30;
      if (timeframe === "all") {
        daysToShow = Math.min(totalDays, 365);
      }

      for (let i = 0; i < daysToShow; i++) {
        const dayDate = new Date(quitDate);
        dayDate.setDate(dayDate.getDate() + i);
        
        if (dayDate > now) break;

        const dayCigarettesAvoided = (i + 1) * cigarettesPerDay;
        const dayMoneySaved = dayCigarettesAvoided * pricePerCigarette;
        
        const dayName = dayDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
        
        dailyData.push({
          day: dayName,
          progress: i + 1,
          cigarettes: dayCigarettesAvoided,
          money: parseFloat(dayMoneySaved.toFixed(2)),
          date: dayDate,
        });

        // Weekly money data
        if (i % 7 === 6 || i === daysToShow - 1) {
          moneyData.push({
            week: `Week ${Math.floor(i / 7) + 1}`,
            money: parseFloat(dayMoneySaved.toFixed(2)),
            cigarettes: dayCigarettesAvoided,
          });
        }
      }

      setDailyProgressData(dailyData);
      setMoneySavedData(moneyData);

      setHealthData(
        recovery.metrics.map((m) => ({
          key: m.key,
          name: m.label,
          value: m.value,
          color: HEALTH_METRIC_COLORS[m.key],
          description: m.description,
        })),
      );

      // Generate achievements based on milestones
      const achievementsList = [];

      // Day-based achievements
      const dayMilestones = [1, 7, 14, 30, 60, 90, 180, 365];
      dayMilestones.forEach(days => {
        if (totalDays >= days) {
          achievementsList.push({
            title: `${days} Day${days > 1 ? 's' : ''} Smoke-Free`,
            description: `Completed ${days} day${days > 1 ? 's' : ''} without smoking`,
            date: new Date(quitDate.getTime() + days * 24 * 60 * 60 * 1000).toLocaleDateString(),
            earned: true,
            type: "days",
            value: days
          });
        }
      });

      // Money-based achievements
      const moneyMilestones = [50, 100, 250, 500, 1000, 2500];
      moneyMilestones.forEach(amount => {
        if (totalMoney >= amount) {
          achievementsList.push({
            title: `Rs. ${amount} Saved`,
            description: `Saved Rs. ${amount} by not smoking`,
            date: new Date().toLocaleDateString(),
            earned: true,
            type: "money",
            value: amount
          });
        }
      });

      // Health-based achievements
      if (totalDays >= 3) {
        achievementsList.push({
          title: "Carbon Monoxide Normal",
          description: "Blood oxygen levels returned to normal",
          date: new Date(quitDate.getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          earned: true,
          type: "health"
        });
      }

      if (totalDays >= 14) {
        achievementsList.push({
          title: "Circulation Improved",
          description: "Blood circulation significantly improved",
          date: new Date(quitDate.getTime() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          earned: true,
          type: "health"
        });
      }

      // Sort achievements by date
      achievementsList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setAchievements(achievementsList);
      // #region agent log
      fetch('http://127.0.0.1:7385/ingest/92006af7-529a-4e09-b5aa-7bf0f9dc3e2c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c6c25d'},body:JSON.stringify({sessionId:'c6c25d',location:'ProgressTracking.tsx:fetchDone',message:'fetch success',data:{timeframe,totalDays,dailyLen:dailyData.length,healthLen:recovery.metrics.length,achievementsLen:achievementsList.length},hypothesisId:'D',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      } catch (err) {
        console.error("Progress page load failed:", err);
        setLoadError(err instanceof Error ? err.message : "Failed to load progress data");
        // #region agent log
        fetch('http://127.0.0.1:7385/ingest/92006af7-529a-4e09-b5aa-7bf0f9dc3e2c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c6c25d'},body:JSON.stringify({sessionId:'c6c25d',location:'ProgressTracking.tsx:fetchCatch',message:'fetch error',data:{err:String(err)},hypothesisId:'D',timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      } finally {
        setPageLoading(false);
      }
    };

    fetchAndCalculateProgress();
  }, [timeframe, navigate]);

  useEffect(() => {
    if (pageLoading) return;
    // #region agent log
    fetch('http://127.0.0.1:7385/ingest/92006af7-529a-4e09-b5aa-7bf0f9dc3e2c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c6c25d'},body:JSON.stringify({sessionId:'c6c25d',location:'ProgressTracking.tsx:renderReady',message:'post-loader render',data:{timeframe,stats,healthKeys:healthData.map((h: {key:string})=>h.key),dailyLen:dailyProgressData.length,loadError},hypothesisId:'C',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [pageLoading, timeframe, stats, healthData, dailyProgressData.length, loadError]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg backdrop-blur-sm">
          <p className="text-sm font-semibold">{data.day}</p>
          <p className="text-sm text-muted-foreground">
            Day {data.progress}
          </p>
          <p className="text-sm text-success">
            Rs.{data.money.toFixed(2)} saved
          </p>
          <p className="text-xs text-accent">
            {data.cigarettes.toLocaleString()} cigarettes avoided
          </p>
        </div>
      );
    }
    return null;
  };

  const MoneyTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold">{payload[0].payload.week}</p>
          <p className="text-sm text-success font-bold">
            Rs.{payload[0].value.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">
            {payload[0].payload.cigarettes.toLocaleString()} cigarettes avoided
          </p>
        </div>
      );
    }
    return null;
  };

  const HealthTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold">{payload[0].name}</p>
          <p className="text-sm" style={{ color: payload[0].color }}>
            {Math.round(payload[0].value)}%
          </p>
          <p className="text-xs text-muted-foreground">
            {healthData.find(h => h.name === payload[0].name)?.description}
          </p>
        </div>
      );
    }
    return null;
  };

  const exportProgressHtml = () => {
    const exportedAt = new Date();
    const dateStr = exportedAt.toLocaleString();

    const renderAchievements = () => {
      if (!achievements?.length) return '<p class="muted">No achievements yet.</p>';
      return achievements
        .map((a) => `
          <div class="achievement">
            <div class="achievement-title">${a.title}</div>
            <div class="achievement-desc">${a.description}</div>
            <div class="achievement-meta">${a.date}</div>
          </div>
        `)
        .join('');
    };

    const renderDailyTable = () => {
      const rows = dailyProgressData?.map((d: any) => `
        <tr>
          <td>${d.day}</td>
          <td>${d.progress}</td>
          <td>${d.cigarettes.toLocaleString()}</td>
          <td>Rs.${Number(d.money).toFixed(2)}</td>
        </tr>
      `).join('') || '';
      return `
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Day #</th>
              <th>Cigarettes Avoided</th>
              <th>Money Saved</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    };

    const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>BreathFresh Progress Report</title>
      <style>
        :root {
          --bg: #0f172a;
          --card: #0b1220;
          --border: #1f2a44;
          --text: #e5e7eb;
          --muted: #93a4b8;
          --primary: #5b9cf3;
          --accent: #67e8f9;
          --success: #34d399;
          --warning: #f59e0b;
        }
        body { margin: 0; background: linear-gradient(180deg, #061023, #0b1220); color: var(--text); font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
        .container { max-width: 960px; margin: 0 auto; padding: 24px; }
        .header { display:flex; align-items:center; justify-content:space-between; margin-bottom: 16px; }
        .title { font-size: 24px; font-weight: 700; letter-spacing: 0.2px; }
        .sub { font-size: 12px; color: var(--muted); }
        .grid { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
        .metric { display:flex; align-items:center; gap:10px; }
        .metric .label { font-size: 12px; color: var(--muted); }
        .metric .value { font-size: 20px; font-weight: 700; }
        .accent { color: var(--accent); }
        .success { color: var(--success); }
        .warning { color: var(--warning); }
        .section { margin-top: 20px; }
        .section-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
        .table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .table th, .table td { border: 1px solid var(--border); padding: 8px; text-align: left; }
        .table thead { background: rgba(255,255,255,0.04); }
        .achievement { border: 1px solid var(--border); border-radius:8px; padding:10px; margin-bottom:8px; background: rgba(255,255,255,0.02); }
        .achievement-title { font-weight: 700; }
        .achievement-desc { font-size: 12px; color: var(--muted); }
        .achievement-meta { font-size: 11px; color: var(--muted); margin-top: 4px; }
        .footer { margin-top: 16px; font-size: 11px; color: var(--muted); text-align: right; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div>
            <div class="title">BreathFresh Progress Report</div>
            <div class="sub">Exported at ${dateStr}</div>
          </div>
          <div class="sub">User: ${profile?.full_name || profile?.email || 'Anonymous'}</div>
        </div>
        <div class="grid">
          <div class="card">
            <div class="metric">
              <div>
                <div class="label">Days Clean</div>
                <div class="value accent">${stats.totalDays}</div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="metric">
              <div>
                <div class="label">Money Saved</div>
                <div class="value success">Rs.${Number(stats.totalMoney).toFixed(0)}</div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="metric">
              <div>
                <div class="label">Cigarettes Avoided</div>
                <div class="value warning">${Number(stats.cigarettesAvoided).toLocaleString()}</div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="metric">
              <div>
                <div class="label">Health Score</div>
                <div class="value">${stats.healthScore}%</div>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Daily Progress Summary</div>
          ${renderDailyTable()}
        </div>

        <div class="section">
          <div class="section-title">Achievements</div>
          ${renderAchievements()}
        </div>

        <div class="footer">Quit date: ${profile?.quit_date ? new Date(profile.quit_date).toLocaleDateString() : 'N/A'}</div>
      </div>
    </body>
    </html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `breathfresh-progress-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportProgressPdf = () => {
    const exportedAt = new Date();
    const dateStr = exportedAt.toLocaleString();

    const renderAchievements = () => {
      if (!achievements?.length) return '<p class="muted">No achievements yet.</p>';
      return achievements
        .map((a) => `
          <div class="achievement">
            <div class="achievement-title">${a.title}</div>
            <div class="achievement-desc">${a.description}</div>
            <div class="achievement-meta">${a.date}</div>
          </div>
        `)
        .join('');
    };

    const renderDailyTable = () => {
      const rows = dailyProgressData?.map((d: any) => `
        <tr>
          <td>${d.day}</td>
          <td>${d.progress}</td>
          <td>${d.cigarettes.toLocaleString()}</td>
          <td>Rs.${Number(d.money).toFixed(2)}</td>
        </tr>
      `).join('') || '';
      return `
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Day #</th>
              <th>Cigarettes Avoided</th>
              <th>Money Saved</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    };

    const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>BreathFresh Progress Report</title>
      <style>
        :root {
          --text: #111827;
          --muted: #6b7280;
          --border: #e5e7eb;
          --card: #ffffff;
          --accent: #0ea5e9;
          --success: #16a34a;
          --warning: #f59e0b;
        }
        @page { size: A4; margin: 16mm; }
        body { margin: 0; background: #ffffff; color: var(--text); font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
        .container { max-width: 960px; margin: 0 auto; padding: 24px; }
        .header { display:flex; align-items:center; justify-content:space-between; margin-bottom: 20px; }
        .title { font-size: 22px; font-weight: 800; letter-spacing: 0.2px; }
        .sub { font-size: 12px; color: var(--muted); }
        .grid { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 16px; }
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
        .metric { display:flex; align-items:center; gap:10px; }
        .metric .label { font-size: 12px; color: var(--muted); }
        .metric .value { font-size: 20px; font-weight: 700; }
        .accent { color: var(--accent); }
        .success { color: var(--success); }
        .warning { color: var(--warning); }
        .section { margin-top: 22px; break-inside: avoid; }
        .section-title { font-size: 16px; font-weight: 700; margin-bottom: 10px; }
        .table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .table th, .table td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; }
        .table thead { background: #f3f4f6; }
        .table tbody tr:nth-child(odd) { background: #fafafa; }
        .achievement { border: 1px solid var(--border); border-radius:8px; padding:10px; margin-bottom:8px; background: #ffffff; }
        .achievement-title { font-weight: 700; }
        .achievement-desc { font-size: 12px; color: var(--muted); }
        .achievement-meta { font-size: 11px; color: var(--muted); margin-top: 4px; }
        .footer { margin-top: 18px; font-size: 11px; color: var(--muted); text-align: right; }
        .muted { color: var(--muted); }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .container { padding: 8px; }
          .grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .section { break-inside: avoid; }
          .table { page-break-inside: auto; }
          .table tr { page-break-inside: avoid; page-break-after: auto; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div>
            <div class="title">BreathFresh Progress Report</div>
            <div class="sub">Exported at ${dateStr}</div>
          </div>
          <div class="sub">User: ${profile?.full_name || profile?.email || 'Anonymous'}</div>
        </div>
        <div class="grid">
          <div class="card">
            <div class="metric">
              <div>
                <div class="label">Days Clean</div>
                <div class="value accent">${stats.totalDays}</div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="metric">
              <div>
                <div class="label">Money Saved</div>
                <div class="value success">Rs.${Number(stats.totalMoney).toFixed(0)}</div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="metric">
              <div>
                <div class="label">Cigarettes Avoided</div>
                <div class="value warning">${Number(stats.cigarettesAvoided).toLocaleString()}</div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="metric">
              <div>
                <div class="label">Health Score</div>
                <div class="value">${stats.healthScore}%</div>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Daily Progress Summary</div>
          ${renderDailyTable()}
        </div>

        <div class="section">
          <div class="section-title">Achievements</div>
          ${renderAchievements()}
        </div>

        <div class="footer">Quit date: ${profile?.quit_date ? new Date(profile.quit_date).toLocaleDateString() : 'N/A'}</div>
      </div>
      <script>
        window.onload = () => { setTimeout(() => window.print(), 200); };
        window.onafterprint = () => { window.close(); };
      </script>
    </body>
    </html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

  if (pageLoading) {
    return <PageLoader message="Loading progress..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-hero pb-20">
      <DashboardHeader dayNumber={stats.totalDays} />

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {loadError && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="p-4 text-sm text-destructive">
              Could not load progress: {loadError}. Try refreshing the page.
            </CardContent>
          </Card>
        )}
        {/* Export Button */}
        <div className="flex justify-end gap-2">
          {/* <Button 
            onClick={exportProgressHtml}
            variant="outline" 
            className="gap-2 shadow-sm hover:shadow-md transition-shadow"
          >
            <Download className="w-4 h-4" />
            Export Progress
          </Button> */}
          <Button 
            onClick={exportProgressPdf}
            variant="default" 
            className="gap-2 shadow-sm hover:shadow-md transition-shadow"
          >
            <Download className="w-4 h-4" />
            Export as PDF
          </Button>
        </div>
        {/* Statistics Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm animate-scale-in">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Days Clean</p>
                  <p className="text-2xl font-bold text-accent">{stats.totalDays}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm animate-scale-in">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Money Saved</p>
                  <p className="text-2xl font-bold text-success">Rs.{stats.totalMoney.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm animate-scale-in">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Cigarettes Avoided</p>
                  <p className="text-2xl font-bold text-warning">{stats.cigarettesAvoided.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm animate-scale-in">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Health Score</p>
                  <p className="text-2xl font-bold text-secondary">{stats.healthScore}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeframe Tabs */}
        <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-card/50 backdrop-blur-sm shadow-sm">
            <TabsTrigger value="week" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
              This Week
            </TabsTrigger>
            <TabsTrigger value="month" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              This Month
            </TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
              All Time
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Charts: outside TabsContent so Radix never hides the panel (value={timeframe} left charts invisible) */}
        <div className="space-y-6 mt-6">
            {/* Enhanced Daily Progress Chart */}
            <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Calendar className="w-5 h-5" />
                  Smoke-Free Journey
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dailyProgressData}>
                    <defs>
                      <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="day" 
                      stroke="#64748b"
                      tick={{ fill: '#64748b' }}
                    />
                    <YAxis 
                      stroke="#64748b"
                      tick={{ fill: '#64748b' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="progress" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      fill="url(#progressGradient)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="money" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Enhanced Money Saved Chart */}
            <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-success">
                  <Banknote className="w-5 h-5" />
                  Financial Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={moneySavedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="week" 
                      stroke="#64748b"
                      tick={{ fill: '#64748b' }}
                    />
                    <YAxis 
                      stroke="#64748b"
                      tick={{ fill: '#64748b' }}
                    />
                    <Tooltip content={<MoneyTooltip />} />
                    <Bar 
                      dataKey="money" 
                      fill="url(#moneyGradient)"
                      radius={[8, 8, 0, 0]}
                    />
                    <defs>
                      <linearGradient id="moneyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.2}/>
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Enhanced Health Improvements */}
            <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-secondary">
                  <Heart className="w-5 h-5" />
                  Health Recovery Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {healthData.map((item) => (
                      <div key={item.key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: item.color + '20' }}>
                              {PROGRESS_HEALTH_ICONS[item.key as HealthMetricKey]}
                            </div>
                            <span className="font-medium text-sm">{item.name}</span>
                          </div>
                          <span className="font-bold text-lg" style={{ color: item.color }}>
                            {Math.round(item.value)}%
                          </span>
                        </div>
                        <Progress value={item.value} className="h-2" />
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={healthData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                      >
                        {healthData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="#fff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<HealthTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Achievement Gallery */}
            <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Award className="w-5 h-5" />
                  Achievement Gallery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {achievements.length === 0 ? (
                    <div className="col-span-2 text-center py-12 text-muted-foreground">
                      <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">Your journey begins now!</p>
                      <p className="text-sm">Complete your first smoke-free day to unlock achievements.</p>
                    </div>
                  ) : (
                    achievements.map((achievement, index) => (
                      <div 
                        key={index}
                        className="flex items-start gap-4 p-4 rounded-xl bg-card border shadow-sm hover:shadow-md transition-all duration-300"
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-success flex items-center justify-center flex-shrink-0 shadow-lg">
                          <Award className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-foreground">{achievement.title}</h3>
                            <Badge className="bg-success text-success-foreground text-xs">
                              Earned
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {achievement.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            🗓️ {achievement.date}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default ProgressTracking;