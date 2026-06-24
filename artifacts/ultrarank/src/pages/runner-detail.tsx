import { useRoute } from "wouter";
import { useGetRunner, useGetRunnerStats, useGetRunnerResults } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { formatNumber, formatDate, formatSecondsToTime } from "@/lib/format";
import { Activity, Trophy, MapPin, Calendar, Clock, ChevronRight, Award } from "lucide-react";

export default function RunnerDetail() {
  const [, params] = useRoute("/runners/:id");
  const id = parseInt(params?.id || "0", 10);

  const { data: runner, isLoading: isLoadingRunner } = useGetRunner(id, { 
    query: { enabled: !!id, queryKey: ['runner', id] } 
  });
  
  const { data: stats, isLoading: isLoadingStats } = useGetRunnerStats(id, {
    query: { enabled: !!id, queryKey: ['runnerStats', id] }
  });

  const { data: results, isLoading: isLoadingResults } = useGetRunnerResults(id, {
    query: { enabled: !!id, queryKey: ['runnerResults', id] }
  });

  if (!id) return <div>Invalid runner ID</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Profile Header */}
      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden relative">
        <div className="h-32 bg-gradient-to-r from-background via-muted to-background border-b border-border/50 relative">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/40 to-transparent"></div>
        </div>
        <div className="px-6 sm:px-8 pb-8 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 -mt-12">
            <div className="flex items-end gap-5">
              <div className="h-24 w-24 rounded-xl bg-background border-4 border-card shadow-md flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/10"></div>
                <Trophy className="h-10 w-10 text-primary opacity-80" />
              </div>
              <div className="pb-1">
                {isLoadingRunner ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ) : (
                  <>
                    <h1 className="text-3xl font-extrabold tracking-tight uppercase text-foreground">{runner?.name}</h1>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 font-medium">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {runner?.country}
                      </span>
                      <span>•</span>
                      <span>{runner?.gender === 'M' ? 'Male' : runner?.gender === 'F' ? 'Female' : 'Non-Binary'}</span>
                      {runner?.age && (
                        <>
                          <span>•</span>
                          <span>{runner.age} Years Old</span>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-4 pb-1">
              <div className="bg-background border border-border rounded-lg p-3 text-center min-w-24 shadow-sm">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Global Rank</div>
                {isLoadingRunner ? <Skeleton className="h-6 w-12 mx-auto" /> : <div className="text-xl font-mono font-bold text-foreground">#{runner?.rank}</div>}
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center min-w-24 shadow-sm">
                <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Rating</div>
                {isLoadingRunner ? <Skeleton className="h-6 w-12 mx-auto" /> : <div className="text-xl font-mono font-bold text-primary">{formatNumber(Math.round(runner?.rating || 0))}</div>}
              </div>
            </div>
          </div>

          {runner?.bio && (
            <div className="mt-6 pt-6 border-t border-border/50 text-sm text-muted-foreground max-w-3xl leading-relaxed">
              {runner.bio}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats */}
        <div className="space-y-8">
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" /> Career Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase text-muted-foreground font-semibold">Total Races</div>
                      <div className="text-2xl font-mono font-medium">{stats?.totalRaces}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase text-muted-foreground font-semibold">Finishes</div>
                      <div className="text-2xl font-mono font-medium text-green-500">{stats?.totalFinishes}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase text-muted-foreground font-semibold">DNFs</div>
                      <div className="text-2xl font-mono font-medium text-destructive">{stats?.totalDnfs}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase text-muted-foreground font-semibold">Distance</div>
                      <div className="text-2xl font-mono font-medium">{formatNumber(stats?.totalDistanceKm)}<span className="text-xs text-muted-foreground ml-1">km</span></div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-border/50 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground font-medium">Best Finish</span>
                      <span className="font-mono font-bold text-primary">{stats?.bestPosition ? `P${stats?.bestPosition}` : '-'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground font-medium">Avg Finish</span>
                      <span className="font-mono font-medium">{stats?.avgPosition ? `P${Math.round(stats.avgPosition * 10) / 10}` : '-'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground font-medium">Total Points</span>
                      <span className="font-mono font-medium">{formatNumber(stats?.totalPoints)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {stats?.byCategory && stats.byCategory.length > 0 && (
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  By Category
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {stats.byCategory.map((cat) => (
                    <div key={cat.category} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="font-mono uppercase">{cat.category}</Badge>
                        <span className="text-xs text-muted-foreground font-medium">{cat.races} races</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase text-muted-foreground font-semibold mb-0.5">Avg Pos</div>
                        <div className="font-mono text-sm font-medium">{cat.avgPosition ? `P${Math.round(cat.avgPosition * 10) / 10}` : '-'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Race History */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold tracking-tight uppercase flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Race History
          </h2>
          
          <Card className="border-border/50 bg-card/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border/50">
                  <tr>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Race</th>
                    <th className="px-5 py-3 font-medium">Distance</th>
                    <th className="px-5 py-3 font-medium text-right">Result</th>
                    <th className="px-5 py-3 font-medium text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoadingResults ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-40" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-16" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-20 ml-auto" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-12 ml-auto" /></td>
                      </tr>
                    ))
                  ) : results?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                        No race results found.
                      </td>
                    </tr>
                  ) : (
                    results?.map((result) => (
                      <tr key={result.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-5 py-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                          {formatDate(result.race.date)}
                        </td>
                        <td className="px-5 py-4">
                          <Link href={`/races/${result.raceId}`} className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                            {result.race.name}
                            <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {result.race.country}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant="outline" className="font-mono text-[10px] uppercase bg-background">{result.race.category}</Badge>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {result.dnf ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-destructive/10 text-destructive uppercase">
                              DNF
                            </span>
                          ) : (
                            <div className="flex flex-col items-end">
                              <span className="font-mono font-bold text-foreground">
                                {result.position ? `P${result.position}` : '-'}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono mt-0.5">
                                {formatSecondsToTime(result.finishTimeSeconds)}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right font-mono font-medium text-primary">
                          {formatNumber(result.points)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
