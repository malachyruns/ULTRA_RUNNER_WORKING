import { useState } from "react";
import { useListRunners } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Users, Search, ChevronRight, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";

export default function Runners() {
  const [search, setSearch] = useState("");
  
  const { data: runners, isLoading } = useListRunners({
    search: search || undefined,
    limit: 50
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Athlete Directory
          </h1>
          <p className="text-muted-foreground mt-1">Search and analyze performance profiles for tracked athletes.</p>
        </div>
        
        <div className="w-full md:w-72 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search runners by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="border-border/50 bg-card/50">
              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-full" />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                  <div>
                    <Skeleton className="h-3 w-12 mb-1" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div>
                    <Skeleton className="h-3 w-12 mb-1" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : runners?.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-card/30 rounded-lg border border-dashed border-border">
            No runners found matching your search.
          </div>
        ) : (
          runners?.map((runner) => (
            <Link key={runner.id} href={`/runners/${runner.id}`}>
              <Card className="border-border/50 bg-card/50 hover:bg-muted/30 hover:border-primary/30 transition-all cursor-pointer group h-full">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4 flex-1">
                    <div>
                      <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{runner.name}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {runner.countryCode && <span className="uppercase font-bold">{runner.countryCode}</span>}
                        <span>•</span>
                        <span>{runner.gender}</span>
                        {runner.age && (
                          <>
                            <span>•</span>
                            <span>{runner.age}yo</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="bg-primary/10 text-primary h-10 w-10 rounded-full flex items-center justify-center font-bold font-mono text-sm border border-primary/20 shrink-0">
                      #{runner.rank}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50 mt-auto">
                    <div>
                      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Rating</div>
                      <div className="font-mono font-bold text-foreground">{formatNumber(Math.round(runner.rating))}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Races</div>
                      <div className="font-mono font-medium text-foreground">{runner.totalRaces}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
