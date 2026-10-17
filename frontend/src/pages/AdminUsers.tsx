import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import PageLoader from "@/components/PageLoader";

interface User {
  id: string;
  email: string;
  full_name: string;
  quit_date: string;
  years_smoked: number;
  cigarettes_per_day: number;
  pack_cost: number;
  created_at: string;
  days_smoke_free: number;
  total_cravings: number;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate days smoke free and get cravings count
      const usersWithStats = await Promise.all(
        (data || []).map(async (user) => {
          const daysSmokeeFree = user.quit_date 
            ? Math.floor((new Date().getTime() - new Date(user.quit_date).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          const { count } = await supabase
            .from('cravings')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

          return {
            ...user,
            days_smoke_free: daysSmokeeFree,
            total_cravings: count || 0,
          };
        })
      );

      setUsers(usersWithStats as User[]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero pb-20">
      {pageLoading ? (
        <PageLoader message="Loading users..." />
      ) : (
        <>
      <DashboardHeader dayNumber={1} />

      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">View and monitor all registered users</p>
        </div>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>Total users: {users.length}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Quit Date</TableHead>
                      <TableHead>Days Free</TableHead>
                      <TableHead>Cravings</TableHead>
                      <TableHead>Cigarettes/Day</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.full_name || 'N/A'}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {user.quit_date ? format(new Date(user.quit_date), 'MMM dd, yyyy') : 'N/A'}
                        </TableCell>
                        <TableCell className="text-success font-semibold">{user.days_smoke_free}</TableCell>
                        <TableCell>{user.total_cravings}</TableCell>
                        <TableCell>{user.cigarettes_per_day || 'N/A'}</TableCell>
                        <TableCell>{format(new Date(user.created_at), 'MMM dd, yyyy')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <BottomNav />
      </>
      )}
    </div>
  );
};

export default AdminUsers;
