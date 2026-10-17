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
        .from('profiles')
        .select('*')
        .eq('id', user.id);

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      const profileData = profiles?.[0];
      if (profileData) {
        // Calculate stats
        if (profileData.quit_date) {
          const quitDate = new Date(profileData.quit_date);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - quitDate.getTime());
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          setDaysSinceQuit(diffDays);
        }
      }
    };

    fetchProfile();
  }, [navigate]);

  return (
    <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo and Day Number - Responsive Layout */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {/* Logo + name: mobile/tablet only (hidden on PC where sidebar has brand) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 lg:hidden">
            <img
              src={appLogo}
              alt="BreathFresh Logo"
              className="h-10 w-10 object-contain"
            />
            <h1 className="hidden sm:block text-lg sm:text-xl font-bold text-primary">BreathFresh</h1>
          </div>

          {/* Day Number - More prominent on mobile */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-primary/10 rounded-full px-2.5 py-1.5 sm:p-3 min-w-0">
              <span className="text-sm sm:text-xl font-bold text-primary truncate block">Day {daysSinceQuit}</span>
            </div>
          </div>
        </div>

        {/* Right side: Admin Button, SidebarTrigger and Notifications */}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 hidden sm:flex"
              onClick={() => {
                const targetPath = window.location.pathname.includes('/admin') ? '/dashboard' : '/admin';
                const targetUrl = new URL(targetPath, window.location.origin).toString();
                // Use absolute URL to avoid scope issues in installed PWA
                window.location.assign(targetUrl);
              }}
            >
              <LayoutDashboard className="w-4 h-4" />
              {window.location.pathname.includes('/admin') ? 'User Dashboard' : 'Admin Dashboard'}
            </Button>
          )}
          <SidebarTrigger className="sm:flex" />
          <NotificationBell />
        </div>
      </div>
    </div>
  );
};