import { useGetSiteSummary, useGetLeaderboard, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { formatNumber, formatDate, formatSecondsToTime } from "@/lib/format";
import { Activity, ArrowDownRight, ArrowUpRight, ChevronRight, Trophy, Users, Flag, Flame, Route, Medal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { data: summary, isLoading: isLoadingSummary } = useGetSiteSummary();
  const { data: leaderboard, isLoading: isLoadingLeaderboard } = useGetLeaderboard({ limit: 10 });
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity({ limit: 5 });

  const leaderboardItems = Array.isArray(leaderboard) ? leaderboard : [];
  const activityItems = Array.isArray(activity) ? activity : [];

  return (
    <main className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Subtle background texture to break up the plain black */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(99,102,241,0.08),transparent_40%),radial-gradient(circle_at_85%_60%,rgba(99,102,241,0.05),transparent_35%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <section className="space-y-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:items-stretch">
            <div className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-[linear-gradient(180deg,rgba(24,24,27,0.98),rgba(9,9,11,0.96))] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.35)] sm:p-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.04),transparent_28%)]" />
              <div className="relative max-w-3xl space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-200">
                  <Flame className="h-3.5 w-3.5" />
                  Elite ultrarunning rankings
                </div>
                <div className="space-y-4">
                  <h1 className="max-w-3xl text-5xl font-black tracking-tight text-white uppercase sm:text-6xl lg:text-7xl">
                    GLOBAL RANKINGS
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
                    UltraRank is a professional performance platform for ultrarunning. Ratings update from results, race difficulty, and field strength so the leaderboard stays current, comparable, and useful across the full season.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild className="rounded-full bg-[#6366F1] px-5 text-white hover:bg-[#6366F1]/90 active:scale-95">
                    <Link href="/rankings">View leaderboard</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full border-neutral-700 bg-neutral-900/80 px-5 text-white hover:border-indigo-500 hover:bg-indigo-500/10 active:scale-95">
                    <Link href="/races">Browse races</Link>
                  </Button>
                </div>
              </div>
            </div>

            <Card className="relative overflow-hidden border border-neutral-800 bg-neutral-900 shadow-[0_18px_60px_rgba(0,0,0,0.3)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.1),transparent_45%)]" />
              <CardContent className="relative flex h-full flex-col justify-between gap-5 p-6 sm:p-8">
                <div className="space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">How rankings work</div>
                  <div className="space-y-3 text-sm leading-6 text-zinc-400">
                    <p>Every result updates runner rating, rank, and form based on finish position and event difficulty.</p>
                    <p>Harder fields and tougher courses matter more, so a strong performance in a major race carries more weight.</p>
                  </div>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <MetricPill icon={Medal} label="Top rated" value={summary?.topRatedRunner?.name ?? "Loading"} />
                  <MetricPill icon={Route} label="Latest races" value={formatNumber(summary?.totalRaces ?? 0)} />
                </div>
              </CardContent>
            </Card>
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
                <h2 className="text-3xl font-semibold tracking-tight uppercase text-white">Top 10 Global</h2>
                <p className="text-sm text-neutral-400">Live global rankings from the ultrarunning community.</p>
              </div>
              <Link href="/rankings" className="inline-flex items-center gap-1 text-sm font-semibold text-[#6366F1] hover:text-[#6366F1]/80">
                Full Rankings <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <Card className="overflow-hidden border border-neutral-800 bg-neutral-900 shadow-sm shadow-black/20 backdrop-blur-md">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="sticky top-0 z-10 bg-neutral-950 text-xs uppercase tracking-[0.2em] text-neutral-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Rank</th>
                      <th className="px-4 py-3 font-medium">Runner</th>
                      <th className="px-4 py-3 font-medium text-right">Rating</th>
                      <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Races</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingLeaderboard ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-neutral-800 last:border-b-0">
                          <td className="px-4 py-4"><Skeleton className="h-4 w-8" /></td>
                          <td className="px-4 py-4"><Skeleton className="h-4 w-32" /></td>
                          <td className="px-4 py-4 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                          <td className="px-4 py-4 hidden sm:table-cell text-right"><Skeleton className="h-4 w-8 ml-auto" /></td>
                        </tr>
                      ))
                    ) : leaderboardItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">No runners ranked yet.</td>
                      </tr>
                    ) : (
                      leaderboardItems.map((entry) => (
                        <tr
                          key={entry.id}
                          className={`group border-b last:border-b-0 transition-colors ${
                            entry.rank === 1 ? "bg-[#FFD700]/[0.06] border-neutral-800 hover:bg-[#FFD700]/[0.1]" :
                            entry.rank === 2 ? "bg-[#C0C0C0]/[0.06] border-neutral-800 hover:bg-[#C0C0C0]/[0.1]" :
                            entry.rank === 3 ? "bg-[#CD7F32]/[0.06] border-neutral-800 hover:bg-[#CD7F32]/[0.1]" :
                            "border-neutral-800 hover:bg-neutral-800/50"
                          }`}
                        >
                          <td className="px-4 py-4 font-mono font-semibold text-white">
                            <div className="inline-flex items-center gap-2">
                              <span className={`inline-flex w-7 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                                entry.rank === 1 ? "bg-[#FFD700] text-neutral-950 ring-1 ring-[#FFD700]/60" :
                                entry.rank === 2 ? "bg-[#C0C0C0] text-neutral-950 ring-1 ring-[#C0C0C0]/60" :
                                entry.rank === 3 ? "bg-[#CD7F32] text-neutral-950 ring-1 ring-[#CD7F32]/60" :
                                "bg-neutral-800 text-neutral-200"
                              }`}>
                                {entry.rank}
                              </span>
                              {entry.ratingChange > 0 ? (
                                <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                              ) : entry.ratingChange < 0 ? (
                                <ArrowDownRight className="h-3 w-3 text-rose-400" />
                              ) : (
                                <span className="w-3" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <Link href={`/runners/${entry.id}`} className="font-semibold text-white hover:text-[#6366F1] transition-colors">
                              {entry.name}
                            </Link>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                              {entry.countryCode && <span className="rounded-full bg-neutral-800 px-2 py-0.5 uppercase text-neutral-200">{entry.countryCode}</span>}
                              <span className="rounded-full bg-neutral-800 px-2 py-0.5 uppercase text-neutral-200">{entry.gender}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right font-mono font-bold text-white">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 ${
                              entry.rank === 1 ? "bg-[#FFD700]/15 text-[#FFD700] ring-1 ring-[#FFD700]/40" :
                              entry.rank === 2 ? "bg-[#C0C0C0]/15 text-[#C0C0C0] ring-1 ring-[#C0C0C0]/40" :
                              entry.rank === 3 ? "bg-[#CD7F32]/15 text-[#CD7F32] ring-1 ring-[#CD7F32]/40" :
                              "bg-neutral-800 text-neutral-100"
                            }`}>
                              {formatNumber(Math.round(entry.rating))}
                            </span>
                          </td>
                          <td className="px-4 py-4 hidden sm:table-cell text-right text-neutral-400">
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
              <h2 className="text-xl font-semibold tracking-tight uppercase flex items-center gap-2 text-white">
                <Activity className="h-5 w-5 text-[#6366F1]" /> Recent Activity
              </h2>
              <span className="text-xs uppercase tracking-[0.2em] text-neutral-400">Live feed</span>
            </div>
            <Card className="overflow-hidden border border-neutral-800 bg-neutral-900 shadow-sm shadow-black/20 backdrop-blur-md">
              <div className="divide-y divide-neutral-800">
                {isLoadingActivity ? (
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : activityItems.length === 0 ? (
                  <div className="p-6 text-sm text-center text-neutral-400">No recent activity.</div>
                ) : (
                  activityItems.map((item) => (
                    <div key={item.id} className="px-4 py-5 hover:bg-neutral-800/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <Link href={`/runners/${item.runnerId}`} className="text-sm font-semibold text-white hover:text-[#6366F1] transition-colors">
                          {item.runnerName}
                        </Link>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${activityRankClass(item.position, item.dnf)}`}>
                          {item.position ? `P${item.position}` : item.dnf ? 'DNF' : '-'}
                        </span>
                      </div>
                      <Link href={`/races/${item.raceId}`} className="mt-2 block text-sm text-neutral-400 hover:text-white transition-colors line-clamp-1">
                        {item.raceName}
                      </Link>
                      <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.15em] text-neutral-400">
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
    <Card className="relative overflow-hidden border border-neutral-800 bg-neutral-900 shadow-sm shadow-black/20">
      <CardContent className="relative flex items-center justify-between gap-4 !p-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-400">{title}</div>
          <div className="mt-2 text-4xl font-black tracking-tight font-mono text-white">
            {isLoading ? <Skeleton className="h-10 w-24" /> : formatNumber(value || 0)}
          </div>
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#6366F1]/20 text-[#6366F1] ring-1 ring-[#6366F1]/30 shadow-inner shadow-black/20">
          <Icon className="h-8 w-8" strokeWidth={2.25} />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricPill({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
        <Icon className="h-3.5 w-3.5 text-[#6366F1]" />
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function activityRankClass(position?: number | null, dnf?: boolean) {
  if (dnf) return "bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30";
  if (position === 1) return "bg-[#FFD700]/15 text-[#FFD700] ring-1 ring-[#FFD700]/30";
  if (position === 2) return "bg-[#C0C0C0]/15 text-[#C0C0C0] ring-1 ring-[#C0C0C0]/30";
  if (position === 3) return "bg-[#CD7F32]/15 text-[#CD7F32] ring-1 ring-[#CD7F32]/30";
  return "bg-neutral-800 text-neutral-300 ring-1 ring-neutral-700";
}