import { useState } from "react";
import { useListRaces } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { Calendar, Search, MapPin, Flag, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export default function Races() {
  const [status, setStatus] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: races, isLoading } = useListRaces({
    status: status !== "all" ? status : undefined,
    category: category !== "all" ? category : undefined,
    search: search || undefined,
    limit: 100
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'results_pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'completed': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
            <Calendar className="h-8 w-8 text-primary" />
            Race Calendar
          </h1>
          <p className="text-muted-foreground mt-1">Discover upcoming events and explore historical race results.</p>
        </div>
      </div>

      <Card className="p-4 border-border/50 bg-card/50">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 space-y-1.5 w-full">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Search Race</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background/50"
              />
            </div>
          </div>
          <div className="w-full md:w-48 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="results_pending">Results Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-48 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Distance</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="All Distances" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Distances</SelectItem>
                <SelectItem value="50k">50K</SelectItem>
                <SelectItem value="50mi">50 Mile</SelectItem>
                <SelectItem value="100k">100K</SelectItem>
                <SelectItem value="100mi">100 Mile</SelectItem>
                <SelectItem value="200mi">200 Mile</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border/50 bg-card/50">
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row">
                  <div className="p-6 flex-1">
                    <Skeleton className="h-6 w-1/3 mb-2" />
                    <Skeleton className="h-4 w-1/4 mb-4" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </div>
                  <div className="p-6 bg-muted/30 sm:w-64 flex flex-col justify-center items-start sm:items-end border-t sm:border-t-0 sm:border-l border-border/50">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : races?.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground bg-card/30 rounded-lg border border-dashed border-border">
            No races found matching your filters.
          </div>
        ) : (
          races?.map((race) => (
            <Link key={race.id} href={`/races/${race.id}`}>
              <Card className="border-border/50 bg-card/50 hover:bg-muted/30 hover:border-primary/30 transition-all cursor-pointer overflow-hidden group">
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row">
                    <div className="p-5 sm:p-6 flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-lg sm:text-xl leading-tight group-hover:text-primary transition-colors">{race.name}</h3>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {race.location}, {race.country}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(race.date)}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Badge variant="secondary" className="font-mono uppercase bg-background">{race.category}</Badge>
                        <Badge variant="outline" className="font-mono uppercase border-border/50">{race.surface}</Badge>
                        {race.distanceKm && (
                          <span className="text-xs font-mono font-medium text-foreground bg-muted px-2 py-0.5 rounded flex items-center">
                            {race.distanceKm}KM
                          </span>
                        )}
                        {race.totalElevationM && (
                          <span className="text-xs font-mono font-medium text-muted-foreground px-2 py-0.5 border border-border/50 rounded flex items-center">
                            +{race.totalElevationM}M
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-5 sm:p-6 bg-background/30 sm:w-56 flex flex-col justify-center items-start sm:items-end border-t sm:border-t-0 sm:border-l border-border/50">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border mb-3 ${getStatusColor(race.status)}`}>
                        {formatStatus(race.status)}
                      </span>
                      
                      {race.status === 'completed' && race.finishersCount !== null && (
                        <div className="text-right">
                          <div className="text-2xl font-mono font-bold text-foreground leading-none">{race.finishersCount}</div>
                          <div className="text-[10px] uppercase font-medium text-muted-foreground mt-1">Finishers</div>
                        </div>
                      )}
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
