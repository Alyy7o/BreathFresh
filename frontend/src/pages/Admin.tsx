import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Users, FileText, TrendingUp, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageLoader from "@/components/PageLoader";

const Admin = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalResources: 0,
    totalCravings: 0,
  });
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [usersRes, resourcesRes, cravingsRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('resources').select('*', { count: 'exact', head: true }),
        supabase.from('cravings').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        totalUsers: usersRes.count || 0,
        activeUsers: usersRes.count || 0,
        totalResources: resourcesRes.count || 0,
        totalCravings: cravingsRes.count || 0,
      });
      setPageLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero pb-20">
      {pageLoading ? (
        <PageLoader message="Loading admin dashboard..." />
      ) : (
        <>
      <DashboardHeader dayNumber={1} />

      <div className="p-4 space-y-4 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground">Manage your smoking cessation platform</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="p-6">
              <div className="text-center space-y-2">
                <Users className="w-8 h-8 mx-auto text-primary" />
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <div className="text-xs text-muted-foreground">Total Users</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="p-6">
              <div className="text-center space-y-2">
                <TrendingUp className="w-8 h-8 mx-auto text-success" />
                <div className="text-2xl font-bold">{stats.activeUsers}</div>
                <div className="text-xs text-muted-foreground">Active Users</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="p-6">
              <div className="text-center space-y-2">
                <FileText className="w-8 h-8 mx-auto text-accent" />
                <div className="text-2xl font-bold">{stats.totalResources}</div>
                <div className="text-xs text-muted-foreground">Resources</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="p-6">
              <div className="text-center space-y-2">
                <TrendingUp className="w-8 h-8 mx-auto text-warning" />
                <div className="text-2xl font-bold">{stats.totalCravings}</div>
                <div className="text-xs text-muted-foreground">Total Cravings</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                User Management
              </CardTitle>
              <CardDescription>View and manage all registered users</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Monitor user progress, view statistics, and track smoking cessation journeys.
              </p>
              <Button onClick={() => navigate('/admin/users')} className="w-full">
                Manage Users
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent" />
                Content Management
              </CardTitle>
              <CardDescription>Create and publish resources</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Write articles, add videos, and share success stories to help users quit smoking.
              </p>
              <Button onClick={() => navigate('/admin/content')} className="w-full">
                Manage Content
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <BottomNav />
      </>
      )}
    </div>
  );
};

export default Admin;
