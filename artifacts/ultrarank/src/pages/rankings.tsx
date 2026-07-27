import { useState } from "react";
import { useGetLeaderboard } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { ArrowDownRight, ArrowUpRight, Trophy, Search, SlidersHorizontal, Flag, Medal, Flame } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const flagEmojiMap: Record<string, string> = {
  US: "🇺🇸",
  KE: "🇰🇪",
  ES: "🇪🇸",
  DE: "🇩🇪",
  JP: "🇯🇵",
  BR: "🇧🇷",
  HR: "🇭🇷",
  MA: "🇲🇦",
  BG: "🇧🇬",
  NO: "🇳🇴",
  IN: "🇮🇳",
  PT: "🇵🇹",
  TN: "🇹🇳",
  JO: "🇯🇴",
  NZ: "🇳🇿",
  CH: "🇨🇭",
  FR: "🇫🇷",
  RS: "🇷🇸",
  GH: "🇬🇭",
  IT: "🇮🇹",
  PL: "🇵🇱",
  SE: "🇸🇪",
  CL: "🇨🇱",
  AR: "🇦🇷",
  KR: "🇰🇷",
  CZ: "🇨🇿",
  ET: "🇪🇹",
  EG: "🇪🇬",
  FI: "🇫🇮",
  MX: "🇲🇽",
  RO: "🇷🇴",
  TR: "🇹🇷",
  AE: "🇦🇪",
  AT: "🇦🇹",
  NL: "🇳🇱",
  UY: "🇺🇾",
  NG: "🇳🇬",
  DK: "🇩🇰",
};

export default function Rankings() {
  const [gender, setGender] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"rank" | "rating" | "name" | "ratingChange">("rank");

  const { data: leaderboard, isLoading } = useGetLeaderboard({
    gender: gender !== "all" ? gender : undefined,
    category: category !== "all" ? category : undefined,
    limit: 100
  });

  const leaderboardItems = Array.isArray(leaderboard) ? leaderboard : [];
  const filteredLeaderboard = leaderboardItems
    .filter((entry) => (search ? entry.name.toLowerCase().includes(search.toLowerCase()) : true))
    .sort((left, right) => {
      if (sortBy === "rating") return right.rating - left.rating;
      if (sortBy === "name") return left.name.localeCompare(right.name);
      if (sortBy === "ratingChange") return right.ratingChange - left.ratingChange;
      return left.rank - right.rank;
    });

  const topThree = filteredLeaderboard.slice(0, 3);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="rounded-3xl border border-neutral-800 bg-[linear-gradient(180deg,rgba(24,24,27,0.98),rgba(9,9,11,0.96))] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.32)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-orange-200">
              <Medal className="h-3.5 w-3.5" />
              Global leaderboard
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight uppercase text-white sm:text-5xl">
                Global Rankings
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                A live ranking table for ultrarunners worldwide. Results, rating changes, and race volume combine to show the current state of the field.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatChip icon={Trophy} label="Active runners" value={String(filteredLeaderboard.length)} />
            <StatChip icon={Flame} label="Top three" value={String(topThree.length)} />
            <StatChip icon={Flag} label="Countries" value={String(new Set(filteredLeaderboard.map((entry) => entry.countryCode ?? entry.country)).size)} />
          </div>
        </div>
      </div>

      <Card className="border border-neutral-800 bg-neutral-900 p-4 shadow-sm shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-1.5 w-full">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">Search runner</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-neutral-950 text-white placeholder:text-zinc-500"
              />
            </div>
          </div>
          <div className="w-full lg:w-40 space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">Gender</label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className="bg-neutral-950 text-white">
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
          <div className="w-full lg:w-48 space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">Distance Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-neutral-950 text-white">
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
          <div className="w-full lg:w-40 space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">Sort by</label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="bg-neutral-950 text-white">
                <SelectValue placeholder="Rank" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rank">Rank</SelectItem>
                <SelectItem value="rating">Rating</SelectItem>
                <SelectItem value="ratingChange">Rating change</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border border-neutral-800 bg-neutral-900 shadow-sm shadow-black/20">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="sticky top-0 z-10 text-xs uppercase tracking-[0.18em] text-zinc-400 bg-neutral-950 border-b border-neutral-800">
              <tr>
                <th className="px-6 py-4 font-medium">Rank</th>
                <th className="px-6 py-4 font-medium">Runner</th>
                <th className="px-6 py-4 font-medium">Country</th>
                <th className="px-6 py-4 font-medium text-right">Races</th>
                <th className="px-6 py-4 font-medium text-right">Rating</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-neutral-800 last:border-b-0">
                    <td className="px-6 py-4"><Skeleton className="h-5 w-12" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-48" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-24" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-8 ml-auto" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400">
                    No runners found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredLeaderboard.map((entry) => (
                  <tr key={entry.id} className="group border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex w-9 items-center justify-center rounded-full border px-2 py-1 text-xs font-bold ${entry.rank <= 3 ? "border-orange-500/30 bg-orange-500/10 text-orange-200" : "border-neutral-800 bg-neutral-900 text-zinc-200"}`}>
                          {entry.rank}
                        </span>
                        {entry.ratingChange > 0 ? (
                          <div className="flex items-center text-emerald-400 text-xs">
                            <ArrowUpRight className="h-3 w-3 mr-0.5" />
                            +{entry.ratingChange}
                          </div>
                        ) : entry.ratingChange < 0 ? (
                          <div className="flex items-center text-rose-400 text-xs">
                            <ArrowDownRight className="h-3 w-3 mr-0.5" />
                            {Math.abs(entry.ratingChange)}
                          </div>
                        ) : (
                          <span className="w-8" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/runners/${entry.id}`} className="font-semibold text-base text-white group-hover:text-[#FF5500] transition-colors flex items-center gap-2">
                        {entry.name}
                        <Badge variant="secondary" className="rounded-full border border-neutral-800 bg-neutral-800 px-2 py-0.5 text-[11px] font-semibold text-zinc-200">
                          {entry.gender}
                        </Badge>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-zinc-400">
                        {entry.countryCode && <span className="inline-flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-800 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-200">{flagEmojiMap[entry.countryCode] ?? "🏳️"} {entry.countryCode}</span>}
                        <span className="hidden sm:inline">{entry.country}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-zinc-400 font-mono">
                      {entry.totalRaces}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-lg text-white">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 ${entry.rank <= 3 ? "bg-orange-500/10 text-orange-200 ring-1 ring-orange-500/20" : "bg-neutral-800 text-zinc-100"}`}>
                        {formatNumber(Math.round(entry.rating))}
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
  );
}

function StatChip({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 shadow-sm shadow-black/20">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        <Icon className="h-3.5 w-3.5 text-[#FF5500]" />
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
