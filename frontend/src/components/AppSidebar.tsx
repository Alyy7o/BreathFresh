import { Home, TrendingUp, Heart, User, MessageCircle, Leaf, Stethoscope, Activity, ClipboardList, BookOpen, Users, FileText, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";
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

export function AppSidebar() {
  const { open } = useSidebar();
  const { isAdmin } = useUserRole();
  const isAdminRoute = window.location.pathname.includes('/admin');

  return (
    <Sidebar
      collapsible="icon"
      className="bg-slate-50 border-r border-slate-200"
    >
      {/* Logo Header */}
      <div className="p-3 border-b border-slate-200">
        <div className="flex items-center gap-1">
          <img
            src={appLogo}
            alt="Quit-Guard Logo"
            className="w-16 h-16 object-contain"
          />
          {open && (
            <div>
              <h2 className="font-bold text-lg text-primary">Quit-Guard</h2>
              {isAdmin && <p className="text-xs text-muted-foreground">{isAdminRoute ? 'Admin Panel' : 'User View'}</p>}
            </div>
          )}
        </div>
      </div>

      <SidebarContent className="p-1">
        {/* Show admin navigation when in admin routes */}
        {isAdmin && isAdminRoute ? (
          <SidebarGroup>
            <SidebarGroupLabel className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={({ isActive }) =>
                          isActive
                            ? "bg-blue-50 text-primary font-medium rounded-lg"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors"
                        }
                      >
                        <item.icon className="w-5 h-5" />
                        {open && <span className="ml-3">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <>
            {/* User navigation */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {userMainItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className={({ isActive }) =>
                            isActive
                              ? "bg-blue-50 text-primary font-medium rounded-lg"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors"
                          }
                        >
                          <item.icon className="w-5 h-5" />
                          {open && <span className="ml-3">{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-6">
              <SidebarGroupLabel className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                Resources
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {userResourceItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className={({ isActive }) =>
                            isActive
                              ? "bg-blue-50 text-primary font-medium rounded-lg"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors"
                          }
                        >
                          <item.icon className="w-5 h-5" />
                          {open && <span className="ml-3">{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}