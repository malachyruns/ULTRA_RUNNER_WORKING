import { useGetSiteSummary, useGetLeaderboard, useGetRecentActivity, useListUpcomingRaces } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { formatNumber, formatDate, formatSecondsToTime } from "@/lib/format";
import { Activity, ArrowDownRight, ArrowUpRight, ChevronRight, Trophy, Users, Flag, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { data: summary, isLoading: isLoadingSummary } = useGetSiteSummary();
  const { data: leaderboard, isLoading: isLoadingLeaderboard } = useGetLeaderboard({ limit: 10 });
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity({ limit: 5 });
  const { data: upcomingRaces, isLoading: isLoadingUpcoming } = useListUpcomingRaces({ limit: 5 });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero / Summary Stats */}
      <section>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-foreground uppercase font-sans">Global Intelligence</h1>
        <p className="text-muted-foreground mb-6 max-w-2xl text-lg">The definitive performance tracker for the ultrarunning community. Real-time global rankings, race results, and runner analytics.</p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Tracked Runners" value={summary?.totalRunners} icon={Users} isLoading={isLoadingSummary} />
          <StatCard title="Races Logged" value={summary?.totalRaces} icon={Flag} isLoading={isLoadingSummary} />
          <StatCard title="Race Results" value={summary?.totalResults} icon={Activity} isLoading={isLoadingSummary} />
          <StatCard title="Countries" value={summary?.totalCountries} icon={Trophy} isLoading={isLoadingSummary} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Global Leaderboard Preview */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight uppercase">Top 10 Global</h2>
            <Link href="/rankings" className="text-sm font-medium text-primary hover:text-primary/80 flex items-center">
              Full Rankings <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          
          <Card className="overflow-hidden border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Rank</th>
                    <th className="px-4 py-3 font-medium">Runner</th>
                    <th className="px-4 py-3 font-medium text-right">Rating</th>
                    <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Races</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoadingLeaderboard ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-4 py-4"><Skeleton className="h-4 w-8" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-4 w-16 ml-auto" /></td>
                        <td className="px-4 py-4 hidden sm:table-cell"><Skeleton className="h-4 w-8 ml-auto" /></td>
                      </tr>
                    ))
                  ) : leaderboard?.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No runners ranked yet.</td>
                    </tr>
                  ) : (
                    leaderboard?.map((entry) => (
                      <tr key={entry.id} className="hover:bg-muted/50 transition-colors group">
                        <td className="px-4 py-3 font-mono font-medium">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground w-6">{entry.rank}</span>
                            {entry.ratingChange > 0 ? (
                              <ArrowUpRight className="h-3 w-3 text-green-500" />
                            ) : entry.ratingChange < 0 ? (
                              <ArrowDownRight className="h-3 w-3 text-destructive" />
                            ) : (
                              <span className="w-3" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/runners/${entry.id}`} className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {entry.name}
                          </Link>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            {entry.countryCode && <span className="uppercase text-[10px] bg-muted px-1 rounded">{entry.countryCode}</span>}
                            <span>{entry.gender}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                          {formatNumber(Math.round(entry.rating))}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">
                          {entry.totalRaces}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* Sidebar: Activity & Upcoming */}
        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight uppercase flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Recent Activity
            </h2>
            <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
              <div className="divide-y divide-border/50">
                {isLoadingActivity ? (
                  <div className="p-4 space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : activity?.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">No recent activity.</div>
                ) : (
                  activity?.map((item) => (
                    <div key={item.id} className="p-4 flex flex-col gap-1.5 hover:bg-muted/30 transition-colors">
                      <div className="flex justify-between items-start">
                        <Link href={`/runners/${item.runnerId}`} className="font-semibold text-sm hover:text-primary transition-colors">
                          {item.runnerName}
                        </Link>
                        <span className="font-mono text-xs font-medium text-primary">
                          {item.position ? `P${item.position}` : (item.dnf ? 'DNF' : '-')}
                        </span>
                      </div>
                      <Link href={`/races/${item.raceId}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors line-clamp-1">
                        {item.raceName}
                      </Link>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-mono mt-1">
                        <span>{formatDate(item.raceDate)}</span>
                        <span>{formatSecondsToTime(item.finishTimeSeconds)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight uppercase flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Upcoming Races
            </h2>
            <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
              <div className="divide-y divide-border/50">
                {isLoadingUpcoming ? (
                  <div className="p-4 space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : upcomingRaces?.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">No upcoming races found.</div>
                ) : (
                  upcomingRaces?.map((race) => (
                    <Link key={race.id} href={`/races/${race.id}`} className="block p-4 hover:bg-muted/30 transition-colors">
                      <div className="font-semibold text-sm text-foreground line-clamp-1 mb-1">{race.name}</div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-mono">{race.category}</span>
                        <span className="flex items-center gap-1"><Flag className="h-3 w-3" /> {race.countryCode || race.country}</span>
                        <span>{formatDate(race.date)}</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
              <div className="p-3 border-t border-border/50 text-center">
                <Link href="/races" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider">
                  View Calendar
                </Link>
              </div>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, isLoading }: { title: string, value?: number, icon: any, isLoading: boolean }) {
  return (
    <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm overflow-hidden relative group">
      <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon className="h-16 w-16" />
      </div>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-3xl font-bold font-mono text-foreground">{formatNumber(value || 0)}</div>
        )}
      </CardContent>
    </Card>
  );
}
