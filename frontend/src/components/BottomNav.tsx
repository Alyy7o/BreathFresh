import { useNavigate, useLocation } from "react-router-dom";
import { Home, Heart, User, TrendingUp, MessageCircle, Calendar } from "lucide-react";

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: "Home", path: "/dashboard" },
    { icon: TrendingUp, label: "Progress", path: "/progress" },
    { icon: Heart, label: "Health", path: "/health" },
    { icon: Calendar, label: "Plan", path: "/quit-plan" },
    { icon: MessageCircle, label: "Chat", path: "/chat" },
    { icon: User, label: "Profile", path: "/profile" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border shadow-lg z-50 sm:hidden">
      <div className="max-w-7xl mx-auto flex justify-around items-center h-16 px-2 sm:px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon
                className={`w-5 h-5 sm:w-6 sm:h-6 transition-all ${
                  isActive ? "scale-110" : "scale-100"
                }`}
              />
              <span className="text-xs mt-1 font-medium hidden sm:block">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};