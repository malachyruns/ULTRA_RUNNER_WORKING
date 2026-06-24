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
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
