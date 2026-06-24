import { usePortalListRaces, usePortalLogout, getPortalMeQueryKey } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { usePortalAuth } from "./PortalAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, Plus, Flag, Settings } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";

export default function PortalDashboard() {
  const { organizer } = usePortalAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const logout = usePortalLogout();
  const { data: races, isLoading } = usePortalListRaces();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getPortalMeQueryKey() });
        setLocation("/");
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'results_pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'completed': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight uppercase">Welcome back, {organizer?.name}</h1>
          <p className="text-muted-foreground mt-1">{organizer?.organizationName} Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/portal/races/new">
            <Button className="font-bold uppercase tracking-wider">
              <Plus className="mr-2 h-4 w-4" /> Create New Race
            </Button>
          </Link>
          <Button variant="outline" onClick={handleLogout} disabled={logout.isPending}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </div>

      <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/50 px-6 py-4">
          <CardTitle className="text-lg font-bold uppercase tracking-wider flex items-center gap-2">
            <Flag className="h-5 w-5 text-primary" /> Your Races
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">Race Name</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Difficulty</th>
                <th className="px-6 py-4 font-medium text-right">Finishers</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-40" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-24" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-16" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-24 rounded-full" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-12 ml-auto" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-10 ml-auto" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-8 w-28 ml-auto" /></td>
                  </tr>
                ))
              ) : races?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Flag className="h-8 w-8 text-muted-foreground/50" />
                      <p>You haven't created any races yet.</p>
                      <Link href="/portal/races/new">
                        <Button variant="link" className="text-primary mt-2">Create your first race</Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                races?.map((race) => (
                  <tr key={race.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-foreground">
                      <Link href={`/races/${race.id}`} className="hover:text-primary transition-colors">
                        {race.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-mono text-muted-foreground">{formatDate(race.date)}</td>
                    <td className="px-6 py-4">
                      <span className="bg-primary/10 text-primary px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider font-mono">
                        {race.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(race.status)}`}>
                        {race.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium">
                      ×{race.difficultyScore?.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                      {race.finishersCount ?? 0}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/portal/races/${race.id}/results`}>
                        <Button size="sm" variant="secondary" className="font-semibold text-xs h-8">
                          <Settings className="mr-1.5 h-3.5 w-3.5" /> Manage Results
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
