import { useNavigate, useLocation } from "react-router-dom";
import { Home, Heart, User, TrendingUp, MessageCircle, Calendar } from "lucide-react";

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: "Home", path: "/dashboard" },
    { icon: TrendingUp, label: "Progress", path: "/progress" },
    { icon: Heart, label: "Health", path: "/health-visualization" },
    { icon: Calendar, label: "Plan", path: "/quit-plan" },
    { icon: MessageCircle, label: "Chat", path: "/chat" },
    { icon: User, label: "Profile", path: "/profile" },
  ];

  return (
    <div className="fixed bottom-3 left-0 right-0 z-50 px-3 sm:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around rounded-2xl border border-border/70 bg-white/90 px-1 py-2 shadow-lg backdrop-blur-xl">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-1 flex-col items-center justify-center rounded-xl px-1 py-1.5 transition-all ${
                isActive ? "bg-accent text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? "scale-105" : ""}`} />
              <span className="mt-0.5 text-[10px] font-semibold">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
