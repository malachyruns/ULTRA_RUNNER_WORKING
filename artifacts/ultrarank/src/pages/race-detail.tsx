import { useRoute } from "wouter";
import { useGetRace, useGetRaceResults } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { formatNumber, formatDate, formatSecondsToTime } from "@/lib/format";
import { MapPin, Calendar, Mountain, Activity, Users, ChevronRight, AlertTriangle } from "lucide-react";

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
      {/* Race Header */}
      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        <div className="p-6 sm:p-8 md:p-10 border-b border-border/50 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-primary/5 to-transparent pointer-events-none"></div>
          
          <div className="relative z-10">
            {isLoadingRace ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-3/4 max-w-lg" />
                <Skeleton className="h-5 w-1/2" />
                <div className="flex gap-2 mt-6">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded border ${getStatusColor(race?.status)}`}>
                    {formatStatus(race?.status)}
                  </span>
                  <Badge variant="outline" className="font-mono uppercase border-border/50 bg-background">{race?.category}</Badge>
                </div>
                
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight uppercase text-foreground mb-3 leading-none">
                  {race?.name}
                </h1>
                
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground font-medium">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {formatDate(race?.date)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {race?.location}, {race?.country}
                  </span>
                </div>

                <div className="flex flex-wrap gap-4 mt-8">
                  <div className="bg-background border border-border/50 rounded-lg p-3 sm:px-5 sm:py-3 min-w-24">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Activity className="h-3 w-3" /> Distance
                    </div>
                    <div className="text-xl font-mono font-bold text-foreground">{race?.distanceKm}<span className="text-sm font-normal text-muted-foreground ml-1">km</span></div>
                  </div>
                  
                  {race?.totalElevationM && (
                    <div className="bg-background border border-border/50 rounded-lg p-3 sm:px-5 sm:py-3 min-w-24">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Mountain className="h-3 w-3" /> Elevation
                      </div>
                      <div className="text-xl font-mono font-bold text-foreground">+{formatNumber(race.totalElevationM)}<span className="text-sm font-normal text-muted-foreground ml-1">m</span></div>
                    </div>
                  )}
                  
                  <div className="bg-background border border-border/50 rounded-lg p-3 sm:px-5 sm:py-3 min-w-24">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Users className="h-3 w-3" /> Finishers
                    </div>
                    <div className="text-xl font-mono font-bold text-foreground">{race?.finishersCount || '-'}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        
        {race?.description && (
          <div className="p-6 sm:px-8 sm:py-6 bg-muted/10 text-sm text-muted-foreground leading-relaxed max-w-4xl">
            {race.description}
          </div>
        )}
      </div>

      {/* Results Table */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight uppercase flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" /> Official Results
        </h2>
        
        <Card className="border-border/50 bg-card/50 overflow-hidden">
          {race?.status === 'upcoming' ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center">
              <Calendar className="h-10 w-10 mb-4 opacity-20" />
              <p>This race has not happened yet.</p>
              <p className="text-xs mt-1">Results will be posted after the event.</p>
            </div>
          ) : race?.status === 'results_pending' ? (
            <div className="py-16 text-center text-yellow-600/70 flex flex-col items-center justify-center">
              <AlertTriangle className="h-10 w-10 mb-4 opacity-50" />
              <p className="font-medium">Results are pending validation.</p>
              <p className="text-xs mt-1 text-muted-foreground">Check back soon for official rankings.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4 font-medium">Pos</th>
                    <th className="px-6 py-4 font-medium">Runner</th>
                    <th className="px-6 py-4 font-medium text-right">Time</th>
                    <th className="px-6 py-4 font-medium text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoadingResults ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-8" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-40" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-20 ml-auto" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-12 ml-auto" /></td>
                      </tr>
                    ))
                  ) : resultsItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                        No results recorded for this race.
                      </td>
                    </tr>
                  ) : (
                    resultsItems.map((result) => (
                      <tr key={result.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-6 py-4 font-mono font-medium">
                          {result.dnf ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-destructive/10 text-destructive uppercase">
                              DNF
                            </span>
                          ) : (
                            <span className="text-foreground text-base">{result.position}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/runners/${result.runnerId}`} className="font-semibold text-base text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                            {result.runner.name}
                            <span className="text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/50">{result.runner.gender}</span>
                            {result.runner.countryCode && (
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">{result.runner.countryCode}</span>
                            )}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {result.dnf ? (
                            <span className="text-muted-foreground font-mono">-</span>
                          ) : (
                            <span className="font-mono font-medium text-foreground">
                              {formatSecondsToTime(result.finishTimeSeconds)}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-primary">
                          {formatNumber(result.points)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
