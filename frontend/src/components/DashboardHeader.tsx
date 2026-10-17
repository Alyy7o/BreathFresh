import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import appLogo from "@/assets/app-logo.png";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { NotificationBell } from "./NotificationBell";

interface DashboardHeaderProps {
  dayNumber: number;
}

export const DashboardHeader = ({ dayNumber }: DashboardHeaderProps) => {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [daysSinceQuit, setDaysSinceQuit] = useState(0);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login");
        return;
      }

      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id);

      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }

      const profileData = profiles?.[0];
      if (profileData?.quit_date) {
        const quitDate = new Date(profileData.quit_date);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - quitDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        setDaysSinceQuit(diffDays);
      }
    };

    fetchProfile();
  }, [navigate]);

  return (
    <div className="sticky top-0 z-40 border-b border-border/60 bg-[hsl(204_45%_98%/0.82)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-border/60">
              <img src={appLogo} alt="BreathFresh Logo" className="h-7 w-7 object-contain" />
            </div>
            <h1 className="hidden text-base font-extrabold tracking-tight text-foreground sm:block">
              Breath<span className="text-primary">Fresh</span>
            </h1>
          </div>

          <div className="bf-chip">
            Day {daysSinceQuit}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="hidden gap-1 rounded-full border-border/80 sm:flex"
              onClick={() => {
                const targetPath = window.location.pathname.includes("/admin") ? "/dashboard" : "/admin";
                window.location.assign(new URL(targetPath, window.location.origin).toString());
              }}
            >
              <LayoutDashboard className="h-4 w-4" />
              {window.location.pathname.includes("/admin") ? "User Dashboard" : "Admin Dashboard"}
            </Button>
          )}
          <SidebarTrigger className="rounded-full sm:flex" />
          <NotificationBell />
        </div>
      </div>
    </div>
  );
};
