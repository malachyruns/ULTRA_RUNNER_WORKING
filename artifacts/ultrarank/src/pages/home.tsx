import { useGetSiteSummary, useGetLeaderboard, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { formatNumber, formatDate, formatSecondsToTime } from "@/lib/format";
import { Activity, ArrowDownRight, ArrowUpRight, ChevronRight, Trophy, Users, Flag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { data: summary, isLoading: isLoadingSummary } = useGetSiteSummary();
  const { data: leaderboard, isLoading: isLoadingLeaderboard } = useGetLeaderboard({ limit: 10 });
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity({ limit: 5 });

  const leaderboardItems = Array.isArray(leaderboard) ? leaderboard : [];
  const activityItems = Array.isArray(activity) ? activity : [];

  return (
    <main className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <section className="space-y-6">
          <div className="max-w-3xl">
            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight uppercase text-foreground">GLOBAL INTELLIGENCE</h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">The definitive performance tracker for the ultrarunning community. Real-time global rankings, race results, and runner analytics.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard title="Tracked Runners" value={summary?.totalRunners} icon={Users} isLoading={isLoadingSummary} />
            <StatCard title="Races Logged" value={summary?.totalRaces} icon={Flag} isLoading={isLoadingSummary} />
            <StatCard title="Race Results" value={summary?.totalResults} icon={Activity} isLoading={isLoadingSummary} />
            <StatCard title="Countries" value={summary?.totalCountries} icon={Trophy} isLoading={isLoadingSummary} />
          </div>
        </section>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,2fr)_420px]">
          <section className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-3xl font-semibold tracking-tight uppercase">Top 10 Global</h2>
                <p className="text-sm text-muted-foreground">Live global rankings from the ultrarunning community.</p>
              </div>
              <Link href="/rankings" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80">
                Full Rankings <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <Card className="overflow-hidden border border-slate-200 bg-white/80 shadow-sm backdrop-blur-md">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Rank</th>
                      <th className="px-4 py-3 font-medium">Runner</th>
                      <th className="px-4 py-3 font-medium text-right">Rating</th>
                      <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Races</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {isLoadingLeaderboard ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-4 py-4"><Skeleton className="h-4 w-8" /></td>
                          <td className="px-4 py-4"><Skeleton className="h-4 w-32" /></td>
                          <td className="px-4 py-4 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                          <td className="px-4 py-4 hidden sm:table-cell text-right"><Skeleton className="h-4 w-8 ml-auto" /></td>
                        </tr>
                      ))
                    ) : leaderboardItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No runners ranked yet.</td>
                      </tr>
                    ) : (
                      leaderboardItems.map((entry) => (
                        <tr key={entry.id} className="group hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-4 font-mono font-semibold text-slate-900">
                            <div className="inline-flex items-center gap-2">
                              <span className="w-6">{entry.rank}</span>
                              {entry.ratingChange > 0 ? (
                                <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                              ) : entry.ratingChange < 0 ? (
                                <ArrowDownRight className="h-3 w-3 text-rose-500" />
                              ) : (
                                <span className="w-3" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <Link href={`/runners/${entry.id}`} className="font-semibold text-slate-900 hover:text-primary transition-colors">
                              {entry.name}
                            </Link>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              {entry.countryCode && <span className="rounded-full bg-slate-100 px-2 py-0.5 uppercase">{entry.countryCode}</span>}
                              <span>{entry.gender}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right font-mono font-bold text-primary">
                            {formatNumber(Math.round(entry.rating))}
                          </td>
                          <td className="px-4 py-4 hidden sm:table-cell text-right text-slate-500">
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

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold tracking-tight uppercase flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> Recent Activity
              </h2>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Live feed</span>
            </div>
            <Card className="overflow-hidden border border-slate-200 bg-white/80 shadow-sm backdrop-blur-md">
              <div className="divide-y divide-slate-200">
                {isLoadingActivity ? (
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : activityItems.length === 0 ? (
                  <div className="p-6 text-sm text-center text-slate-500">No recent activity.</div>
                ) : (
                  activityItems.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <Link href={`/runners/${item.runnerId}`} className="text-sm font-semibold text-slate-900 hover:text-primary transition-colors">
                          {item.runnerName}
                        </Link>
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                          {item.position ? `P${item.position}` : item.dnf ? 'DNF' : '-'}
                        </span>
                      </div>
                      <Link href={`/races/${item.raceId}`} className="mt-2 block text-sm text-slate-500 hover:text-slate-900 transition-colors line-clamp-1">
                        {item.raceName}
                      </Link>
                      <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.15em] text-slate-500">
                        <span>{formatDate(item.raceDate)}</span>
                        <span>{formatSecondsToTime(item.finishTimeSeconds)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}

function StatCard({ title, value, icon: Icon, isLoading }: { title: string; value?: number; icon: any; isLoading: boolean }) {
  return (
    <Card className="relative overflow-hidden border border-slate-200 bg-white/90 shadow-sm">
      <CardContent className="relative flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">{title}</div>
          <div className="mt-4 text-4xl font-black tracking-tight font-mono text-slate-900">
            {isLoading ? <Skeleton className="h-10 w-24" /> : formatNumber(value || 0)}
          </div>
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          <Icon className="h-8 w-8" />
        </div>
      </CardContent>
    </Card>
  );
}
