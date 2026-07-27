import { useMemo } from "react";
import { useRoute } from "wouter";
import { useGetRace, useGetRaceResults } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { formatNumber, formatDate, formatSecondsToTime } from "@/lib/format";
import { MapPin, Calendar, Mountain, Activity, Users, ChevronRight, AlertTriangle, Wind, ThermometerSun, Gauge, Flag, Medal, Trophy } from "lucide-react";

export default function RaceDetail() {
  const [, params] = useRoute("/races/:id");
  const id = parseInt(params?.id || "0", 10);

  const { data: race, isLoading: isLoadingRace } = useGetRace(id, { 
    query: { enabled: !!id, queryKey: ['race', id] } 
  });
  
  const { data: results, isLoading: isLoadingResults } = useGetRaceResults(id, {
    query: { enabled: !!id, queryKey: ['raceResults', id] }
  });

  const resultsItems = Array.isArray(results) ? results : [];
  const insights = useMemo(() => buildRaceInsights(resultsItems), [resultsItems]);

  if (!id) return <div>Invalid race ID</div>;

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'results_pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'completed': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatStatus = (status?: string) => {
    return status ? status.replace('_', ' ') : '';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="overflow-hidden rounded-3xl border border-neutral-800 bg-[linear-gradient(180deg,rgba(24,24,27,0.98),rgba(9,9,11,0.95))] shadow-[0_24px_90px_rgba(0,0,0,0.32)]">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <div className="relative border-b border-neutral-800 lg:border-b-0 lg:border-r">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.14),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.03),transparent_28%)]" />
            <div className="relative p-6 sm:p-8">
              {isLoadingRace ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-3/4 max-w-xl" />
                  <Skeleton className="h-5 w-1/2" />
                  <div className="flex gap-2 mt-6">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${getStatusColor(race?.status)}`}>
                      {formatStatus(race?.status)}
                    </span>
                    <Badge variant="outline" className="rounded-full border-neutral-800 bg-neutral-800/80 font-mono uppercase text-zinc-200">{race?.category}</Badge>
                    <Badge variant="secondary" className="rounded-full border border-neutral-800 bg-neutral-900 text-zinc-200">{race?.surface}</Badge>
                  </div>

                  <h1 className="mt-4 text-4xl font-black tracking-tight uppercase text-white sm:text-5xl">{race?.name}</h1>

                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium text-zinc-400">
                    <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-[#FF5500]" />{formatDate(race?.date)}</span>
                    <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-[#FF5500]" />{race?.location}, {race?.country}</span>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard icon={Activity} label="Distance" value={`${race?.distanceKm ?? 0} km`} accent />
                    <MetricCard icon={Mountain} label="Elevation" value={`+${formatNumber(race?.totalElevationM ?? 0)} m`} />
                    <MetricCard icon={Gauge} label="Technicality" value={race?.technicalityRating ? `${race.technicalityRating}/10` : "-"} />
                    <MetricCard icon={Users} label="Finishers" value={String(race?.finishersCount ?? 0)} />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-2">
              <MetricCard icon={Wind} label="Weather" value={race?.weatherConditions ?? "Not listed"} />
              <MetricCard icon={Trophy} label="Difficulty" value={race?.difficultyScore ? race.difficultyScore.toFixed(3) : "-"} accent />
              <MetricCard icon={Flag} label="Field strength" value={`${insights.averageRating}`} />
              <MetricCard icon={Medal} label="Top finisher" value={insights.winnerName} />
            </div>

            <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Race characteristics</div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <RowStat label="Terrain" value={race?.surface ?? "-"} />
                <RowStat label="Elevation profile" value={race?.totalElevationM ? `+${formatNumber(race.totalElevationM)}m` : "-"} />
                <RowStat label="Weather" value={race?.weatherConditions ?? "-"} />
                <RowStat label="Technical difficulty" value={race?.technicalityRating ? `${race.technicalityRating}/10` : "-"} />
              </div>
            </div>
          </div>
        </div>

        {race?.description && (
          <div className="border-t border-neutral-800 px-6 py-5 text-sm leading-relaxed text-zinc-400 sm:px-8">
            {race.description}
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight uppercase flex items-center gap-2 text-white">
            <Activity className="h-5 w-5 text-[#FF5500]" /> Race summary
          </h2>
          <Card className="border border-neutral-800 bg-neutral-900 shadow-sm shadow-black/20">
            <CardContent className="grid gap-3 p-5">
              {isLoadingRace ? (
                <>
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </>
              ) : (
                <>
                  <RowStat label="Participants" value={String(resultsItems.length)} />
                  <RowStat label="Average finish" value={insights.averageFinish} />
                  <RowStat label="Podium countries" value={insights.podiumCountries} />
                  <RowStat label="Result spread" value={insights.resultSpread} />
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border border-neutral-800 bg-neutral-900 shadow-sm shadow-black/20 overflow-hidden">
            <CardContent className="p-0">
              {race?.status === "upcoming" ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-400">
                  <Calendar className="mb-4 h-10 w-10 text-[#FF5500]/60" />
                  <p>This race has not happened yet.</p>
                  <p className="mt-1 text-xs">Results will appear after the event.</p>
                </div>
              ) : race?.status === "results_pending" ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-400">
                  <AlertTriangle className="mb-4 h-10 w-10 text-amber-400/70" />
                  <p className="font-medium text-white">Results are pending validation.</p>
                  <p className="mt-1 text-xs">Check back soon for official rankings.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="sticky top-0 z-10 bg-neutral-950 text-xs uppercase tracking-[0.18em] text-zinc-400 border-b border-neutral-800">
                      <tr>
                        <th className="px-6 py-4 font-medium">Pos</th>
                        <th className="px-6 py-4 font-medium">Runner</th>
                        <th className="px-6 py-4 font-medium text-right">Time</th>
                        <th className="px-6 py-4 font-medium text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingResults ? (
                        Array.from({ length: 10 }).map((_, i) => (
                          <tr key={i} className="border-b border-neutral-800 last:border-b-0">
                            <td className="px-6 py-4"><Skeleton className="h-4 w-8" /></td>
                            <td className="px-6 py-4"><Skeleton className="h-4 w-40" /></td>
                            <td className="px-6 py-4"><Skeleton className="h-4 w-20 ml-auto" /></td>
                            <td className="px-6 py-4"><Skeleton className="h-4 w-12 ml-auto" /></td>
                          </tr>
                        ))
                      ) : resultsItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-zinc-400">No results recorded for this race.</td>
                        </tr>
                      ) : (
                        resultsItems.map((result) => (
                          <tr key={result.id} className="group border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/50 transition-colors">
                            <td className="px-6 py-4 font-mono font-medium">
                              {result.dnf ? (
                                <span className="inline-flex items-center rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[10px] font-bold uppercase text-rose-300">DNF</span>
                              ) : (
                                <span className={`inline-flex w-8 items-center justify-center rounded-full px-2 py-1 text-xs font-bold ${result.position === 1 ? "bg-orange-500/10 text-orange-200 ring-1 ring-orange-500/20" : "bg-neutral-800 text-zinc-200"}`}>
                                  {result.position}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <Link href={`/runners/${result.runnerId}`} className="flex items-center gap-2 font-semibold text-white transition-colors group-hover:text-[#FF5500]">
                                {result.runner.name}
                                <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                              </Link>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                                <span>{result.runner.country}</span>
                                {result.runner.countryCode && <span className="rounded-full border border-neutral-800 bg-neutral-800 px-2 py-0.5 text-zinc-200">{result.runner.countryCode}</span>}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {result.dnf ? (
                                <span className="font-mono text-zinc-500">-</span>
                              ) : (
                                <span className="font-mono font-semibold text-white">{formatSecondsToTime(result.finishTimeSeconds)}</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-medium text-white">
                              <span className={`inline-flex items-center rounded-full px-3 py-1 ${result.position === 1 ? "bg-orange-500/10 text-orange-200 ring-1 ring-orange-500/20" : "bg-neutral-800 text-zinc-100"}`}>
                                {formatNumber(result.points)}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight uppercase flex items-center gap-2 text-white">
            <Users className="h-5 w-5 text-[#FF5500]" /> Participants
          </h2>
          <Card className="overflow-hidden border border-neutral-800 bg-neutral-900 shadow-sm shadow-black/20">
            <CardContent className="p-0">
              <div className="divide-y divide-neutral-800">
                {isLoadingResults ? (
                  <div className="space-y-3 p-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : resultsItems.length === 0 ? (
                  <div className="p-6 text-center text-sm text-zinc-400">No participant data available.</div>
                ) : (
                  resultsItems.slice(0, 12).map((result) => (
                    <div key={result.id} className="flex items-center justify-between gap-4 px-4 py-4">
                      <div>
                        <Link href={`/runners/${result.runnerId}`} className="font-semibold text-white hover:text-[#FF5500] transition-colors">
                          {result.runner.name}
                        </Link>
                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
                          {result.runner.country} • {result.runner.gender}
                        </div>
                      </div>
                      <Badge variant="secondary" className="rounded-full border border-neutral-800 bg-neutral-800 text-zinc-200">
                        {result.position ? `P${result.position}` : "DNF"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function buildRaceInsights(results: Array<{
  position?: number | null;
  dnf?: boolean;
  points: number;
  runner: { name: string; country: string; countryCode?: string | null; rating: number; gender: string };
}> ) {
  const finishers = results.filter((result) => !result.dnf && result.position);
  const averageRating = finishers.length
    ? Math.round(finishers.reduce((sum, result) => sum + Number(result.runner.rating || 0), 0) / finishers.length)
    : 0;
  const winner = results.find((result) => result.position === 1 && !result.dnf) ?? results.find((result) => !result.dnf);
  const podiumCountries = Array.from(new Set(results.filter((result) => !result.dnf && result.position && result.position <= 3).map((result) => result.runner.country)));
  const spread = finishers.length > 1
    ? Math.max(...finishers.map((result) => Number(result.points))) - Math.min(...finishers.map((result) => Number(result.points)))
    : 0;

  return {
    averageRating: averageRating ? formatNumber(averageRating) : "-",
    winnerName: winner?.runner.name ?? "-",
    averageFinish: finishers.length
      ? `P${(finishers.reduce((sum, result) => sum + (result.position ?? 0), 0) / finishers.length).toFixed(1)}`
      : "-",
    podiumCountries: podiumCountries.length ? podiumCountries.join(" · ") : "-",
    resultSpread: `${formatNumber(spread)} pts`,
  };
}

function MetricCard({ icon: Icon, label, value, accent = false }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${accent ? "border-orange-500/20 bg-orange-500/10" : "border-neutral-800 bg-neutral-950/70"}`}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
        <Icon className="h-3.5 w-3.5 text-[#FF5500]" />
        {label}
      </div>
      <div className={`mt-2 text-sm font-semibold ${accent ? "text-orange-100" : "text-white"}`}>{value}</div>
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
