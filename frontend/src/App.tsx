import React, { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import Onboarding from "./pages/Onboarding";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import HealthMilestones from "./pages/HealthMilestones";
import Profile from "./pages/Profile";
import ChatBot from "./pages/ChatBot";
import Admin from "./pages/Admin";
import AdminUsers from "./pages/AdminUsers";
import AdminContent from "./pages/AdminContent";
import AdminSpecialists from "./pages/AdminSpecialists";
import NotFound from "./pages/NotFound";
import { ProtectedAdminRoute } from "@/components/ProtectedAdminRoute";
import ProgressTracking from "./pages/ProgressTracking";
import AlternativeSolutions from "./pages/AlternativeSolutions";
import ProfessionalConsultations from "./pages/ProfessionalConsultations";
import CravingLog from "./pages/CravingLog";
import HealthVisualization from "./pages/HealthVisualization";
import Resources from "./pages/Resources";
import ArticleView from "./pages/ArticleView";
import BookmarkedResources from "./pages/BookmarkedResources";
import QuitPlan from "./pages/QuitPlan";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

const queryClient = new QueryClient();

const App = () => {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Check authentication and onboarding status
    const checkAuthStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!isMounted) return;

        setIsAuthenticated(!!session);

        if (session?.user) {
          // Check if user has completed onboarding
          const { data, error } = await supabase
            .from('profiles')
            .select('quit_date')
            .eq('id', session.user.id);

          if (!isMounted) return;

          if (error) {
            console.error('Error fetching profile:', error);
            setIsOnboarded(false);
          } else {
            setIsOnboarded(!!data?.[0]?.quit_date);
          }
        } else {
          setIsOnboarded(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (isMounted) {
          setIsAuthenticated(false);
          setIsOnboarded(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkAuthStatus();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      setIsAuthenticated(!!session);

      if (session?.user) {
        supabase
          .from('profiles')
          .select('quit_date')
          .eq('id', session.user.id)
          .then(({ data, error }) => {
            if (!isMounted) return;

            if (error) {
              console.error('Error fetching profile:', error);
              setIsOnboarded(false);
            } else {
              setIsOnboarded(!!data?.[0]?.quit_date);
            }
          });
      } else {
        setIsOnboarded(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Sonner />
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          {isAuthenticated && isOnboarded && <AppSidebar />}
          <main className="flex-1 min-w-0 overflow-x-hidden">
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Onboarding route */}
              <Route
                path="/onboarding"
                element={
                  isAuthenticated && !isOnboarded ? <Onboarding onComplete={() => setIsOnboarded(true)} /> :
                    isAuthenticated && isOnboarded ? <Navigate to="/dashboard" /> :
                      <Navigate to="/login" />
                }
              />

              {/* Protected routes */}
              <Route
                path="/dashboard"
                element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />}
              />
              <Route
                path="/progress"
                element={isAuthenticated ? <ProgressTracking /> : <Navigate to="/login" />}
              />
              <Route
                path="/health"
                element={isAuthenticated ? <HealthMilestones /> : <Navigate to="/login" />}
              />
              <Route
                path="/profile"
                element={isAuthenticated ? <Profile /> : <Navigate to="/login" />}
              />
              <Route
                path="/chat"
                element={isAuthenticated ? <ChatBot /> : <Navigate to="/login" />}
              />
              <Route
                path="/quit-plan"
                element={isAuthenticated ? <QuitPlan /> : <Navigate to="/login" />}
              />
              <Route
                path="/admin"
                element={isAuthenticated ? <ProtectedAdminRoute><Admin /></ProtectedAdminRoute> : <Navigate to="/login" />}
              />
              <Route
                path="/admin/users"
                element={isAuthenticated ? <ProtectedAdminRoute><AdminUsers /></ProtectedAdminRoute> : <Navigate to="/login" />}
              />
              <Route
                path="/admin/content"
                element={isAuthenticated ? <ProtectedAdminRoute><AdminContent /></ProtectedAdminRoute> : <Navigate to="/login" />}
              />
              <Route
                path="/admin/specialists"
                element={isAuthenticated ? <ProtectedAdminRoute><AdminSpecialists /></ProtectedAdminRoute> : <Navigate to="/login" />}
              />
              <Route
                path="/alternatives"
                element={isAuthenticated ? <AlternativeSolutions /> : <Navigate to="/login" />}
              />
              <Route
                path="/consultations"
                element={isAuthenticated ? <ProfessionalConsultations /> : <Navigate to="/login" />}
              />
              <Route
                path="/craving-log"
                element={isAuthenticated ? <CravingLog /> : <Navigate to="/login" />}
              />
              <Route
                path="/health-visualization"
                element={isAuthenticated ? <HealthVisualization /> : <Navigate to="/login" />}
              />
              <Route
                path="/resources"
                element={isAuthenticated ? <Resources /> : <Navigate to="/login" />}
              />
              <Route
                path="/resources/bookmarks"
                element={isAuthenticated ? <BookmarkedResources /> : <Navigate to="/login" />}
              />
              <Route
                path="/resources/:id"
                element={isAuthenticated ? <ArticleView /> : <Navigate to="/login" />}
              />

              {/* Root redirect */}
              <Route
                path="/"
                element={
                  !isAuthenticated ? <Navigate to="/login" /> :
                    !isOnboarded ? <Navigate to="/onboarding" /> :
                      <Navigate to="/dashboard" />
                }
              />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </SidebarProvider>
    </QueryClientProvider>
  );
};

export default App;