import { useState } from "react";
import { useGetLeaderboard } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { ArrowDownRight, ArrowUpRight, Trophy, Search, SlidersHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";

export default function Rankings() {
  const [gender, setGender] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: leaderboard, isLoading } = useGetLeaderboard({
    gender: gender !== "all" ? gender : undefined,
    category: category !== "all" ? category : undefined,
    limit: 100
  });

  const filteredLeaderboard = leaderboard?.filter(entry => 
    search ? entry.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
            <Trophy className="h-8 w-8 text-primary" />
            Global Rankings
          </h1>
          <p className="text-muted-foreground mt-1">The top ultrarunners worldwide, ranked by performance rating.</p>
        </div>
      </div>

      <Card className="p-4 border-border/50 bg-card/50">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 space-y-1.5 w-full">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Search Runner</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background/50"
              />
            </div>
          </div>
          <div className="w-full md:w-48 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gender</label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="All Genders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="M">Men</SelectItem>
                <SelectItem value="F">Women</SelectItem>
                <SelectItem value="X">Non-Binary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-48 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Distance Category</label>
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

      <Card className="overflow-hidden border-border/50 shadow-sm bg-card/50">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">Rank</th>
                <th className="px-6 py-4 font-medium">Runner</th>
                <th className="px-6 py-4 font-medium">Country</th>
                <th className="px-6 py-4 font-medium text-right">Races</th>
                <th className="px-6 py-4 font-medium text-right">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-12" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-48" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-24" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-8 ml-auto" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredLeaderboard?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No runners found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredLeaderboard?.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 font-mono font-medium">
                      <div className="flex items-center gap-3">
                        <span className="text-foreground text-base w-8">{entry.rank}</span>
                        {entry.ratingChange > 0 ? (
                          <div className="flex items-center text-green-500 text-xs">
                            <ArrowUpRight className="h-3 w-3 mr-0.5" />
                            {entry.ratingChange}
                          </div>
                        ) : entry.ratingChange < 0 ? (
                          <div className="flex items-center text-destructive text-xs">
                            <ArrowDownRight className="h-3 w-3 mr-0.5" />
                            {Math.abs(entry.ratingChange)}
                          </div>
                        ) : (
                          <span className="w-8" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/runners/${entry.id}`} className="font-semibold text-base text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                        {entry.name}
                        <span className="text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{entry.gender}</span>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {entry.countryCode && <span className="uppercase text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded border border-border">{entry.countryCode}</span>}
                        <span className="hidden sm:inline">{entry.country}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-muted-foreground font-mono">
                      {entry.totalRaces}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-lg text-primary">
                      {formatNumber(Math.round(entry.rating))}
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
