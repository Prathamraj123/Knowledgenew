import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import { AuthProvider } from "@/context/auth-context";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <AppRoutes />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

// Separate component for routes to ensure context is available
function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/auth" component={LoginPage} />
      <Route path="/" component={DashboardPage} />
      <Route path="/filter/:topic?/:date?/:employee?" component={DashboardPage} />
      {/* Custom named routes */}
      <Route path="/view/:name/:topic?/:date?/:employee?" component={DashboardPage} />
      <Route path="/not-found" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default App;
