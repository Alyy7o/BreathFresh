import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DashboardHeader } from "@/components/DashboardHeader";
import { BottomNav } from "@/components/BottomNav";
import { toast } from "sonner";
import { User, Mail, Calendar, Cigarette, DollarSign, LogOut, Trophy, Heart, Activity, MapPin, Settings, Trash2, Wind, Droplets } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import appLogo from "@/assets/app-logo.png";
import PageLoader from "@/components/PageLoader";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import {
  computeHealthRecovery,
  getDaysSinceQuit,
  type HealthMetricKey,
} from "@/lib/healthRecovery";

const Profile = () => {
  const navigate = useNavigate();
  const { isSupported, isSubscribed, subscribeToPush, unsubscribeFromPush } = usePushNotifications();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [daysSinceQuit, setDaysSinceQuit] = useState(0);
  const [moneySaved, setMoneySaved] = useState(0);
  const [cigarettesAvoided, setCigarettesAvoided] = useState(0);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    quitReason: "",
    quitDate: "",
    yearsSmoked: "",
    cigarettesPerDay: "",
    cigarettesPerPack: "",
    packCost: "",
    enableNotifications: false,
  });
  const [originalProfile, setOriginalProfile] = useState({
    name: "",
    email: "",
    quitReason: "",
    quitDate: "",
    yearsSmoked: "",
    cigarettesPerDay: "",
    cigarettesPerPack: "",
    packCost: "",
    enableNotifications: false,
  });
  const [pageLoading, setPageLoading] = useState(true);

  const quitReasonOptions = [
    "My health",
    "My family",
    "Better fitness",
    "To save money",
    "Having a child",
    "My freedom"
  ];

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
        setPageLoading(false);
        return;
      }

      const profileData = profiles?.[0];
      if (profileData) {
        const profileInfo = {
          name: profileData.full_name || user.email?.split("@")[0] || "",
          email: user.email || "",
          quitReason: profileData.quit_reason || "",
          quitDate: profileData.quit_date ? new Date(profileData.quit_date).toLocaleDateString() : "",
          yearsSmoked: profileData.years_smoked?.toString() || "",
          cigarettesPerDay: profileData.cigarettes_per_day?.toString() || "",
          cigarettesPerPack: profileData.cigarettes_per_pack?.toString() || "",
          packCost: profileData.pack_cost?.toString() || "",
          enableNotifications: profileData.enable_notifications || false,
        };

        setProfile(profileInfo);
        setOriginalProfile(profileInfo);

        // Calculate stats
        if (profileData.quit_date) {
          const quitDate = new Date(profileData.quit_date);
          const diffDays = getDaysSinceQuit(quitDate);
          setDaysSinceQuit(diffDays);

          // Calculate money saved
          const cigarettesPerDay = profileData.cigarettes_per_day || 0;
          const packCost = profileData.pack_cost || 0;
          const cigarettesPerPack = profileData.cigarettes_per_pack || 20;
          const dailyCost = (cigarettesPerDay / cigarettesPerPack) * packCost;
          setMoneySaved(Math.round(dailyCost * diffDays));

          // Calculate cigarettes avoided
          setCigarettesAvoided(cigarettesPerDay * diffDays);
        }
      }
      setPageLoading(false);
    };

    fetchProfile();
  }, [navigate]);

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    // Create update object with only changed fields
    const updates: any = {};

    if (profile.quitReason !== originalProfile.quitReason) {
      updates.quit_reason = profile.quitReason;
    }
    if (profile.yearsSmoked !== originalProfile.yearsSmoked) {
      updates.years_smoked = parseInt(profile.yearsSmoked) || null;
    }
    if (profile.cigarettesPerDay !== originalProfile.cigarettesPerDay) {
      updates.cigarettes_per_day = parseInt(profile.cigarettesPerDay) || null;
    }
    if (profile.cigarettesPerPack !== originalProfile.cigarettesPerPack) {
      updates.cigarettes_per_pack = parseInt(profile.cigarettesPerPack) || null;
    }
    if (profile.packCost !== originalProfile.packCost) {
      updates.pack_cost = parseFloat(profile.packCost) || null;
    }

    // Only update if there are changes
    if (Object.keys(updates).length === 0) {
      toast.info("No changes to save");
      setIsEditing(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      toast.error("Failed to update profile");
      return;
    }

    // Update original profile with new values
    setOriginalProfile({ ...profile });

    toast.success("Profile updated successfully!");
    setIsEditing(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const [isDeleting, setIsDeleting] = useState(false);
  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("No user authenticated");
        return;
      }
      const { error: profileErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);
      if (profileErr) {
        toast.error("Failed to delete profile data");
        return;
      }
      await supabase.auth.signOut();
      toast.success("Account data deleted and signed out");
      navigate("/login");
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  const healthSnapshot = useMemo(
    () =>
      computeHealthRecovery(
        {
          cigarettesPerDay: Number(profile.cigarettesPerDay) || 20,
          yearsSmoked: Number(profile.yearsSmoked) || 5,
        },
        daysSinceQuit,
      ),
    [profile.cigarettesPerDay, profile.yearsSmoked, daysSinceQuit, pageLoading],
  );

  const profileMetricIcons: Record<HealthMetricKey, ReactNode> = {
    oxygen: <Droplets className="h-4 w-4 text-accent" />,
    lung: <Wind className="h-4 w-4 text-primary" />,
    circulation: <Heart className="h-4 w-4 text-destructive" />,
    heart: <Activity className="h-4 w-4 text-accent" />,
  };

  return (
    <div className="min-h-screen bg-gradient-hero pb-20">
      {pageLoading ? (
        <PageLoader message="Loading profile..." />
      ) : (
        <>
          <DashboardHeader dayNumber={daysSinceQuit} />

          <div className="container mx-auto px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-4xl">
            {/* Profile Header */}
            <Card className="p-4 sm:p-6">
              <div className="relative">
                {/* Settings Button - Positioned absolutely on mobile, inline on desktop */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setActiveTab("settings")}
                  className="absolute top-0 right-0 sm:relative sm:ml-auto"
                >
                  <Settings className="h-4 w-4" />
                </Button>

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pt-8 sm:pt-0">
                  <div className="relative mx-auto sm:mx-0">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-primary flex items-center justify-center">
                      <img src={appLogo} alt="Profile" className="w-12 h-12 sm:w-16 sm:h-16 object-contain" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-background border-2 border-primary rounded-full px-2 py-0.5">
                      <span className="text-xs font-bold text-primary">{daysSinceQuit} days</span>
                    </div>
                  </div>

                  <div className="flex-1 text-center sm:text-left">
                    <h1 className="text-xl sm:text-2xl font-bold">{profile.name || "User"}</h1>
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        <span className="truncate max-w-[200px] sm:max-w-none">{profile.email}</span>
                      </div>
                      {profile.quitDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>Started {profile.quitDate}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-6">
                <div className="text-center p-2 sm:p-0">
                  <p className="text-2xl sm:text-3xl font-bold text-primary">{daysSinceQuit}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Days Smoke-Free</p>
                </div>
                <div className="text-center p-2 sm:p-0">
                  <p className="text-2xl sm:text-3xl font-bold text-success">Rs.{moneySaved}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Money Saved</p>
                </div>
                <div className="text-center p-2 sm:p-0">
                  <p className="text-2xl sm:text-3xl font-bold text-accent">{cigarettesAvoided}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Cigarettes Avoided</p>
                </div>
              </div>
            </Card>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
                <TabsTrigger value="achievements" className="text-xs sm:text-sm">Achievements</TabsTrigger>
                <TabsTrigger value="health" className="text-xs sm:text-sm">Health</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4 sm:mt-6">
                <Card className="p-4 sm:p-6 space-y-4">
                  <h3 className="text-lg sm:text-xl font-bold">Journey Overview</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-xs sm:text-sm font-medium">Recovery Progress</span>
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          {healthSnapshot.overallRecoveryPct}%
                        </span>
                      </div>
                      <Progress value={healthSnapshot.overallRecoveryPct} className="h-3" />
                      <p className="text-xs text-muted-foreground mt-1">
                        Target: Day {healthSnapshot.fullRecoveryDays} for full organ recovery
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm text-muted-foreground">Quit Reason</p>
                        <p className="text-sm sm:font-medium">{profile.quitReason || "Not specified"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm text-muted-foreground">Years Smoked</p>
                        <p className="text-sm sm:font-medium">{profile.yearsSmoked || "0"} years</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm text-muted-foreground">Cigarettes/Day</p>
                        <p className="text-sm sm:font-medium">{profile.cigarettesPerDay || "0"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm text-muted-foreground">Daily Cost</p>
                        <p className="text-sm sm:font-medium">
                          Rs.                       {Math.round(
                            ((Number(profile.cigarettesPerDay) || 0) /
                              (Number(profile.cigarettesPerPack) || 20)) *
                            (Number(profile.packCost) || 0)
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="achievements" className="space-y-4 mt-4 sm:mt-6">
                <Card className="p-4 sm:p-6 space-y-4">
                  <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Achievements Unlocked
                  </h3>
                  <div className="grid gap-4">
                    {daysSinceQuit >= 1 && (
                      <div className="flex flex-col sm:flex-row items-start gap-3 p-4 rounded-lg bg-gradient-primary/10 border border-primary/20">
                        <Trophy className="h-6 w-6 text-yellow-500 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-bold">First Day Champion</h4>
                          <p className="text-sm text-muted-foreground">
                            Completed your first 24 hours smoke-free
                          </p>
                        </div>
                        <Badge className="ml-auto bg-gradient-primary">Day 1</Badge>
                      </div>
                    )}
                    {daysSinceQuit >= 7 && (
                      <div className="flex flex-col sm:flex-row items-start gap-3 p-4 rounded-lg bg-gradient-primary/10 border border-primary/20">
                        <Trophy className="h-6 w-6 text-yellow-500 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-bold">Week Warrior</h4>
                          <p className="text-sm text-muted-foreground">
                            One full week without cigarettes!
                          </p>
                        </div>
                        <Badge className="ml-auto bg-gradient-primary">Week 1</Badge>
                      </div>
                    )}
                    {daysSinceQuit >= 30 && (
                      <div className="flex flex-col sm:flex-row items-start gap-3 p-4 rounded-lg bg-gradient-primary/10 border border-primary/20">
                        <Trophy className="h-6 w-6 text-yellow-500 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-bold">Monthly Milestone</h4>
                          <p className="text-sm text-muted-foreground">
                            30 days of freedom from smoking
                          </p>
                        </div>
                        <Badge className="ml-auto bg-gradient-primary">Month 1</Badge>
                      </div>
                    )}
                    {daysSinceQuit >= 90 && (
                      <div className="flex flex-col sm:flex-row items-start gap-3 p-4 rounded-lg bg-gradient-primary/10 border border-primary/20">
                        <Trophy className="h-6 w-6 text-yellow-500 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-bold">3-Month Hero</h4>
                          <p className="text-sm text-muted-foreground">
                            Major recovery milestone reached
                          </p>
                        </div>
                        <Badge className="ml-auto bg-gradient-primary">3 Months</Badge>
                      </div>
                    )}
                    {daysSinceQuit < 1 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Trophy className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Keep going! Your first achievement is just around the corner.</p>
                      </div>
                    )}
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="health" className="space-y-4 mt-4 sm:mt-6">
                <Card className="p-4 sm:p-6 space-y-4">
                  <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                    <Heart className="h-5 w-5 text-destructive" />
                    Health Improvements
                  </h3>
                  <div className="space-y-6">
                    {healthSnapshot.metrics.map((metric) => (
                      <div key={metric.key}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-1">
                          <div className="flex items-center gap-2 min-w-0">
                            {profileMetricIcons[metric.key]}
                            <span className="text-sm sm:font-medium">{metric.label}</span>
                          </div>
                          <span className="text-xs sm:text-sm font-bold text-success shrink-0">
                            {metric.value}%
                          </span>
                        </div>
                        <Progress value={metric.value} className="h-3 bg-muted" />
                        <p className="text-xs text-muted-foreground mt-1">
                          Started at {metric.base}% · +{metric.value - metric.base}% improvement
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Settings Section */}
            {activeTab === "settings" && (
              <Card className="p-4 sm:p-6 space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h2 className="text-xl font-bold">Settings</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("overview")}
                  >
                    Back to Profile
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="email"
                        value={profile.email}
                        disabled
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quitReason">Main Reason for Quitting</Label>
                    <Select
                      value={profile.quitReason}
                      onValueChange={(value) => setProfile({ ...profile, quitReason: value })}
                      disabled={!isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {quitReasonOptions.map((reason) => (
                          <SelectItem key={reason} value={reason}>
                            {reason}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cigarettesPerDay">Cigarettes per Day</Label>
                    <div className="relative">
                      <Cigarette className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="cigarettesPerDay"
                        type="number"
                        value={profile.cigarettesPerDay}
                        onChange={(e) => setProfile({ ...profile, cigarettesPerDay: e.target.value })}
                        disabled={!isEditing}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="packCost">Pack Cost (Rs.)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="packCost"
                          type="number"
                          step="0.01"
                          value={profile.packCost}
                          onChange={(e) => setProfile({ ...profile, packCost: e.target.value })}
                          disabled={!isEditing}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cigarettesPerPack">Cigarettes per Pack</Label>
                      <div className="relative">
                        <Cigarette className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="cigarettesPerPack"
                          type="number"
                          value={profile.cigarettesPerPack}
                          onChange={(e) => setProfile({ ...profile, cigarettesPerPack: e.target.value })}
                          disabled={!isEditing}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="yearsSmoked">Years Smoked</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="yearsSmoked"
                        type="number"
                        value={profile.yearsSmoked}
                        onChange={(e) => setProfile({ ...profile, yearsSmoked: e.target.value })}
                        disabled={!isEditing}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Push Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive achievement and reminder notifications.
                        </p>
                      </div>
                      <Button
                        variant={isSubscribed ? "outline" : "default"}
                        onClick={isSubscribed ? unsubscribeFromPush : subscribeToPush}
                        disabled={!isSupported}
                      >
                        {isSubscribed ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant={isEditing ? "default" : "outline"}
                      className={isEditing ? "bg-gradient-primary flex-1" : "flex-1"}
                      onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
                    >
                      {isEditing ? "Save Changes" : "Edit Profile"}
                    </Button>
                    {isEditing && (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setProfile({ ...originalProfile });
                          setIsEditing(false);
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t space-y-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete account?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove your profile data and sign you out.
                          Deleting the authentication account requires server-side access and is not performed here.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAccount} disabled={isDeleting}>
                          {isDeleting ? "Deleting..." : "Confirm delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Card>
            )}
          </div>

          <BottomNav />
        </>
      )}
    </div>
  );
};

export default Profile;