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
                ? "!rounded-xl !bg-white !font-semibold !text-primary shadow-sm ring-1 ring-border/60 hover:!bg-white"
                : "!rounded-xl !text-slate-600 hover:!bg-white/70 hover:!text-foreground"
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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border/80 px-3 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-border/60">
            <img src={appLogo} alt="BreathFresh Logo" className="h-9 w-9 object-contain" />
          </div>
          {open && (
            <div className="min-w-0">
              <h2 className="truncate text-base font-extrabold tracking-tight text-foreground">
                Breath<span className="text-primary">Fresh</span>
              </h2>
              <p className="text-[11px] font-medium text-muted-foreground">
                {isAdmin && isAdminRoute ? "Admin panel" : "Fresh air, every day"}
              </p>
            </div>
          )}
        </div>
      </div>

      <SidebarContent className="px-2 py-3">
        {isAdmin && isAdminRoute ? (
          <SidebarGroup>
            <SidebarGroupLabel className="mb-1 px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">{renderItems(adminItems)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="mb-1 px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Navigate
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">{renderItems(userMainItems)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-5">
              <SidebarGroupLabel className="mb-1 px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Support
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">{renderItems(userResourceItems)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
