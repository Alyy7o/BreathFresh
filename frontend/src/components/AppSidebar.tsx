import { Home, TrendingUp, Heart, User, MessageCircle, Leaf, Stethoscope, ClipboardList, BookOpen, Users, FileText, Sparkles } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import appLogo from "@/assets/app-logo.png";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";

const userMainItems = [
  { title: "Home", url: "/dashboard", icon: Home },
  { title: "Progress", url: "/progress", icon: TrendingUp },
  { title: "Organ Health", url: "/health-visualization", icon: Heart },
  { title: "Craving Log", url: "/craving-log", icon: ClipboardList },
  { title: "Quit Plan", url: "/quit-plan", icon: Sparkles },
  { title: "Chat", url: "/chat", icon: MessageCircle },
  { title: "Profile", url: "/profile", icon: User },
];

const userResourceItems = [
  { title: "Alternative Solutions", url: "/alternatives", icon: Leaf },
  { title: "Professional Consultations", url: "/consultations", icon: Stethoscope },
  { title: "Resources", url: "/resources", icon: BookOpen },
];

const adminItems = [
  { title: "Dashboard", url: "/admin", icon: Home },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Content", url: "/admin/content", icon: FileText },
  { title: "Specialists", url: "/admin/specialists", icon: Stethoscope },
];

function pathIsActive(pathname: string, url: string) {
  if (url === "/dashboard" || url === "/admin") {
    return pathname === url;
  }
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function AppSidebar() {
  const { open } = useSidebar();
  const { isAdmin } = useUserRole();
  const location = useLocation();
  const isAdminRoute = location.pathname.includes("/admin");

  const renderItems = (items: typeof userMainItems) =>
    items.map((item) => {
      const active = pathIsActive(location.pathname, item.url);
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            asChild
            isActive={active}
            className={
              active
                ? "!bg-primary !text-white hover:!bg-primary hover:!text-white"
                : "!text-slate-700 hover:!bg-primary/10 hover:!text-primary"
            }
          >
            <NavLink to={item.url} end={item.url === "/dashboard" || item.url === "/admin"}>
              <item.icon className="w-5 h-5" />
              {open && <span className="ml-3">{item.title}</span>}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <Sidebar collapsible="icon" className="bg-slate-50 border-r border-slate-200 text-slate-700">
      <div className="p-3 border-b border-slate-200">
        <div className="flex items-center gap-1">
          <img src={appLogo} alt="BreathFresh Logo" className="w-16 h-16 object-contain" />
          {open && (
            <div>
              <h2 className="font-bold text-lg text-primary">BreathFresh</h2>
              {isAdmin && (
                <p className="text-xs text-muted-foreground">
                  {isAdminRoute ? "Admin Panel" : "User View"}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <SidebarContent className="p-1">
        {isAdmin && isAdminRoute ? (
          <SidebarGroup>
            <SidebarGroupLabel className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(adminItems)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{renderItems(userMainItems)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-6">
              <SidebarGroupLabel className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                Resources
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{renderItems(userResourceItems)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
