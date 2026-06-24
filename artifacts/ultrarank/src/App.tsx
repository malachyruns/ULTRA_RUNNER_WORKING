import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Rankings from "@/pages/rankings";
import Runners from "@/pages/runners";
import RunnerDetail from "@/pages/runner-detail";
import Races from "@/pages/races";
import RaceDetail from "@/pages/race-detail";
import PortalLogin from "@/pages/portal/login";
import PortalRegister from "@/pages/portal/register";
import PortalDashboard from "@/pages/portal/dashboard";
import PortalRaceNew from "@/pages/portal/races-new";
import PortalRaceResults from "@/pages/portal/races-results";
import { PortalAuthProvider, RequirePortalAuth } from "@/pages/portal/PortalAuthContext";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/rankings" component={Rankings} />
        <Route path="/runners" component={Runners} />
        <Route path="/runners/:id" component={RunnerDetail} />
        <Route path="/races" component={Races} />
        <Route path="/races/:id" component={RaceDetail} />
        
        {/* Organiser Portal Routes */}
        <Route path="/portal/login" component={PortalLogin} />
        <Route path="/portal/register" component={PortalRegister} />
        <Route path="/portal">
          <RequirePortalAuth>
            <PortalDashboard />
          </RequirePortalAuth>
        </Route>
        <Route path="/portal/dashboard">
          <RequirePortalAuth>
            <PortalDashboard />
          </RequirePortalAuth>
        </Route>
        <Route path="/portal/races/new">
          <RequirePortalAuth>
            <PortalRaceNew />
          </RequirePortalAuth>
        </Route>
        <Route path="/portal/races/:id/results">
          <RequirePortalAuth>
            <PortalRaceResults />
          </RequirePortalAuth>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PortalAuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </PortalAuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
