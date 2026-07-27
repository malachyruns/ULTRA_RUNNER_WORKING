import { useMemo } from "react";
import { useRoute } from "wouter";
import { useGetRunner, useGetRunnerStats, useGetRunnerResults } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { formatNumber, formatDate, formatSecondsToTime } from "@/lib/format";
import { Activity, Trophy, MapPin, Calendar, Clock, ChevronRight, Award, Flame, Mountain, Medal } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

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

  const resultsItems = Array.isArray(results) ? results : [];
  const derived = useMemo(() => buildRunnerInsights(resultsItems), [resultsItems]);

  if (!id) return <div>Invalid runner ID</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="overflow-hidden rounded-3xl border border-neutral-800 bg-[linear-gradient(180deg,rgba(24,24,27,0.98),rgba(9,9,11,0.95))] shadow-[0_24px_90px_rgba(0,0,0,0.32)]">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="relative border-b border-neutral-800 lg:border-b-0 lg:border-r">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.14),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.03),transparent_28%)]" />
            <div className="relative p-6 sm:p-8">
              {isLoadingRunner ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-3/4 max-w-lg" />
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
                    <Badge variant="secondary" className="rounded-full border border-neutral-800 bg-neutral-800 text-zinc-200">#{runner?.rank}</Badge>
                    <span>{runner?.country}</span>
                    <span>•</span>
                    <span>{runner?.gender === "M" ? "Male" : runner?.gender === "F" ? "Female" : "Non-Binary"}</span>
                    {runner?.age ? <><span>•</span><span>{runner.age} years old</span></> : null}
                  </div>

                  <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h1 className="text-4xl font-black tracking-tight uppercase text-white sm:text-5xl">{runner?.name}</h1>
                      {runner?.bio && <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">{runner.bio}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:min-w-72">
                      <MetricCard label="Rating" value={formatNumber(Math.round(runner?.rating || 0))} accent />
                      <MetricCard label="Total races" value={String(stats?.totalRaces ?? runner?.totalRaces ?? 0)} />
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <MiniStat icon={Medal} label="Best finish" value={stats?.bestPosition ? `P${stats.bestPosition}` : "-"} />
                    <MiniStat icon={Flame} label="Podiums" value={String(derived.podiums)} />
                    <MiniStat icon={Mountain} label="Strongest terrain" value={derived.strongestTerrain} />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-2">
              <MetricCard label="Finishes" value={String(stats?.totalFinishes ?? 0)} />
              <MetricCard label="DNFs" value={String(stats?.totalDnfs ?? 0)} />
              <MetricCard label="Distance" value={`${formatNumber(stats?.totalDistanceKm)} km`} />
              <MetricCard label="Total points" value={formatNumber(stats?.totalPoints)} />
            </div>
            <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-zinc-500">
                <span>Rating trend</span>
                <span>{derived.trendData.length > 1 ? `${derived.trendData.length} races` : "Insufficient history"}</span>
              </div>
              <div className="mt-4 h-44">
                {derived.trendData.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={derived.trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="race" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={{ stroke: "#27272a" }} tickLine={false} />
                      <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={{ stroke: "#27272a" }} tickLine={false} width={36} />
                      <Tooltip
                        contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 12, color: "#fff" }}
                        labelStyle={{ color: "#a1a1aa" }}
                      />
                      <Line type="monotone" dataKey="rating" stroke="#FF5500" strokeWidth={2.5} dot={{ r: 3, fill: "#FF5500" }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-neutral-800 text-sm text-zinc-500">
                    Not enough results to chart a meaningful trend.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-8">
          <Card className="border border-neutral-800 bg-neutral-900 shadow-sm shadow-black/20">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-[0.22em] text-zinc-400 flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#FF5500]" /> Career statistics
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
                    <StatTile label="Avg finish" value={stats?.avgPosition ? `P${Math.round(stats.avgPosition * 10) / 10}` : "-"} />
                    <StatTile label="Best finish" value={stats?.bestPosition ? `P${stats.bestPosition}` : "-"} accent />
                    <StatTile label="Wins" value={String(derived.wins)} />
                    <StatTile label="Podiums" value={String(derived.podiums)} />
                  </div>

                  <div className="pt-4 border-t border-neutral-800 space-y-3">
                    <RowStat label="Favourite terrain" value={derived.strongestTerrain} />
                    <RowStat label="Recent form" value={derived.recentFormLabel} />
                    <RowStat label="Win rate" value={`${derived.winRate}%`} />
                    <RowStat label="Top-5 rate" value={`${derived.topFiveRate}%`} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {stats?.byCategory && stats.byCategory.length > 0 && (
            <Card className="border border-neutral-800 bg-neutral-900 shadow-sm shadow-black/20">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-bold uppercase tracking-[0.22em] text-zinc-400">
                  Strongest race types
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-neutral-800">
                  {stats.byCategory.map((cat) => (
                    <div key={cat.category} className="flex items-center justify-between px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="rounded-full border border-neutral-800 bg-neutral-800 font-mono uppercase text-zinc-200">{cat.category}</Badge>
                        <span className="text-xs font-medium text-zinc-500">{cat.races} races</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-semibold tracking-[0.22em] text-zinc-500">Avg pos</div>
                        <div className="font-mono text-sm font-semibold text-white">{cat.avgPosition ? `P${Math.round(cat.avgPosition * 10) / 10}` : "-"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight uppercase flex items-center gap-2 text-white">
              <Calendar className="h-5 w-5 text-[#FF5500]" /> Race history
            </h2>
            <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">Recent performances</span>
          </div>

          <Card className="overflow-hidden border border-neutral-800 bg-neutral-900 shadow-sm shadow-black/20">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0 z-10 bg-neutral-950 text-xs uppercase tracking-[0.18em] text-zinc-400 border-b border-neutral-800">
                  <tr>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Race</th>
                    <th className="px-5 py-3 font-medium">Distance</th>
                    <th className="px-5 py-3 font-medium text-right">Result</th>
                    <th className="px-5 py-3 font-medium text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingResults ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-neutral-800 last:border-b-0">
                        <td className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-40" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-16" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-20 ml-auto" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-12 ml-auto" /></td>
                      </tr>
                    ))
                  ) : resultsItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-zinc-400">
                        No race results found.
                      </td>
                    </tr>
                  ) : (
                    resultsItems.map((result) => (
                      <tr key={result.id} className="group border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/50 transition-colors">
                        <td className="px-5 py-4 text-xs font-mono text-zinc-400 whitespace-nowrap">
                          {formatDate(result.race.date)}
                        </td>
                        <td className="px-5 py-4">
                          <Link href={`/races/${result.raceId}`} className="font-semibold text-white group-hover:text-[#FF5500] transition-colors flex items-center gap-1.5">
                            {result.race.name}
                            <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                          <div className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                            <MapPin className="h-3 w-3" /> {result.race.country}
                            <span>•</span>
                            <span>{result.race.surface}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant="outline" className="rounded-full border-neutral-800 bg-neutral-800/80 font-mono text-[10px] uppercase text-zinc-200">
                            {result.race.category}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {result.dnf ? (
                            <span className="inline-flex items-center rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-xs font-bold uppercase text-rose-300">
                              DNF
                            </span>
                          ) : (
                            <div className="flex flex-col items-end">
                              <span className="font-mono font-bold text-white">
                                {result.position ? `P${result.position}` : "-"}
                              </span>
                              <span className="mt-0.5 font-mono text-xs text-zinc-500">
                                {formatSecondsToTime(result.finishTimeSeconds)}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right font-mono font-medium text-white">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 ${Number(result.points) >= 0 ? "bg-orange-500/10 text-orange-200 ring-1 ring-orange-500/20" : "bg-neutral-800 text-zinc-200"}`}>
                            {formatNumber(result.points)}
                          </span>
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

function buildRunnerInsights(results: Array<{
  position?: number | null;
  dnf?: boolean;
  points: number;
  race: { category: string; surface: string; name: string; date: string };
}> ) {
  const ordered = results.slice().sort((left, right) => left.race.date.localeCompare(right.race.date));
  const trendData: Array<{ race: string; rating: number }> = [];
  let rating = 1500;
  let wins = 0;
  let podiums = 0;
  let topFive = 0;
  const terrainScores: Record<string, number> = { trail: 0, road: 0, mountain: 0, mixed: 0 };
  const terrainCounts: Record<string, number> = { trail: 0, road: 0, mountain: 0, mixed: 0 };

  for (const result of ordered) {
    rating += Number(result.points || 0);
    trendData.push({ race: result.race.name, rating: Math.round(rating) });

    if (!result.dnf && result.position) {
      if (result.position === 1) wins++;
      if (result.position <= 3) podiums++;
      if (result.position <= 5) topFive++;
    }

    const terrain = result.race.surface || "mixed";
    terrainScores[terrain] = (terrainScores[terrain] ?? 0) + Math.max(0, 6 - (result.position ?? 6));
    terrainCounts[terrain] = (terrainCounts[terrain] ?? 0) + 1;
  }

  const strongestTerrain = Object.entries(terrainScores)
    .map(([terrain, score]) => ({ terrain, score, count: terrainCounts[terrain] ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.score - left.score)[0]?.terrain ?? "mixed";

  const recent = ordered.slice(-5);
  const recentFormLabel = recent.length
    ? recent
        .map((result) => (result.dnf ? "DNF" : result.position ? `P${result.position}` : "-"))
        .join(" · ")
    : "No results";

  const finishCount = ordered.filter((result) => !result.dnf).length || 1;

  return {
    trendData,
    wins,
    podiums,
    strongestTerrain,
    recentFormLabel,
    winRate: Math.round((wins / finishCount) * 100),
    topFiveRate: Math.round((topFive / finishCount) * 100),
  };
}

function MetricCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${accent ? "border-orange-500/20 bg-orange-500/10" : "border-neutral-800 bg-neutral-950/70"}`}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{label}</div>
      <div className={`mt-2 text-base font-semibold ${accent ? "text-orange-100" : "text-white"}`}>{value}</div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 px-4 py-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
        <Icon className="h-3.5 w-3.5 text-[#FF5500]" />
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function StatTile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-4 ${accent ? "border-orange-500/20 bg-orange-500/10" : "border-neutral-800 bg-neutral-950/70"}`}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{label}</div>
      <div className={`mt-2 font-mono text-lg font-bold ${accent ? "text-orange-100" : "text-white"}`}>{value}</div>
    </div>
  );
}

function RowStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-zinc-400">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}
