import { useMemo, useState, useRef, useEffect } from "react";
import { useListRunners } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "wouter";
import { Users, Search, SlidersHorizontal, X, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";

const PAGE_SIZE = 50;

export default function Runners() {
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [ageCategory, setAgeCategory] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Ref to track the location of the Load More button / list bottom
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollRef = useRef(false);

  const { data: runners, isLoading, isFetching } = useListRunners({
    search: search || undefined,
    limit,
  });

  const runnersItems = Array.isArray(runners) ? runners : [];

  // Scroll back to the saved point once the fetch completes
  useEffect(() => {
    if (!isFetching && shouldScrollRef.current && loadMoreRef.current) {
      loadMoreRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
      shouldScrollRef.current = false;
    }
  }, [isFetching]);

  const ageCategories = useMemo(() => {
    const set = new Set<string>();
    runnersItems.forEach((r) => r.ageCategory && set.add(r.ageCategory));
    return Array.from(set).sort();
  }, [runnersItems]);

  const filtered = runnersItems.filter((r) => {
    if (gender && r.gender !== gender) return false;
    if (ageCategory && r.ageCategory !== ageCategory) return false;
    return true;
  });

  const activeFilterCount = (gender ? 1 : 0) + (ageCategory ? 1 : 0);
  const hasMore = runnersItems.length >= limit;

  const handleLoadMore = () => {
    shouldScrollRef.current = true;
    setLimit((prev) => prev + PAGE_SIZE);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-3 text-3xl font-black uppercase tracking-tight text-white">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6366F1]/15 text-[#6366F1] ring-1 ring-[#6366F1]/30">
              <Users className="h-6 w-6" strokeWidth={2.25} />
            </span>
            Athlete Directory
          </h1>
          <p className="text-sm text-neutral-400">Search and analyze performance profiles for tracked athletes.</p>
        </div>

        <div className="flex w-full gap-2 md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <Input
              placeholder="Search runners by name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(PAGE_SIZE);
              }}
              className="rounded-full border-neutral-800 bg-neutral-900 pl-10 text-white placeholder:text-neutral-500 focus-visible:border-[#6366F1] focus-visible:ring-[#6366F1]/30"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={`relative rounded-full border-neutral-800 bg-neutral-900 px-4 text-neutral-300 hover:border-[#6366F1]/60 hover:bg-[#6366F1]/10 hover:text-white ${
                  activeFilterCount > 0 ? "border-[#6366F1]/60 bg-[#6366F1]/10 text-white" : ""
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">Filter</span>
                {activeFilterCount > 0 && (
                  <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#6366F1] text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 border-neutral-800 bg-neutral-900 p-4">
              <div className="space-y-5">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Gender</div>
                  <div className="flex gap-2">
                    {["M", "F"].map((g) => (
                      <button
                        key={g}
                        onClick={() => setGender(gender === g ? null : g)}
                        className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                          gender === g
                            ? "border-[#6366F1] bg-[#6366F1]/15 text-white"
                            : "border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700"
                        }`}
                      >
                        {g === "M" ? "Male" : "Female"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Age category</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ageCategories.length === 0 ? (
                      <span className="text-xs text-neutral-500">No data yet</span>
                    ) : (
                      ageCategories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setAgeCategory(ageCategory === cat ? null : cat)}
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                            ageCategory === cat
                              ? "border-[#6366F1] bg-[#6366F1]/15 text-white"
                              : "border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700"
                          }`}
                        >
                          {cat}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {activeFilterCount > 0 && (
                  <button
                    onClick={() => {
                      setGender(null);
                      setAgeCategory(null);
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-800 py-1.5 text-xs font-semibold text-neutral-400 hover:border-rose-500/40 hover:text-rose-400"
                  >
                    <X className="h-3 w-3" /> Clear filters
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="border border-neutral-800 bg-neutral-900">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/40 py-14 text-center text-neutral-400">
            No runners found matching your filters.
          </div>
        ) : (
          filtered.map((runner) => {
            const medal = runner.rank === 1 ? "gold" : runner.rank === 2 ? "silver" : runner.rank === 3 ? "bronze" : null;
            const medalColor = medal === "gold" ? "#FFD700" : medal === "silver" ? "#C0C0C0" : medal === "bronze" ? "#CD7F32" : "#6366F1";
            const initials = runner.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
            
            const numericRating = typeof runner.rating === "number" ? runner.rating : parseFloat(runner.rating ?? "0");

            return (
              <Link key={runner.id} href={`/runners/${runner.id}`}>
                <Card className="group relative h-full overflow-hidden border border-neutral-800 bg-neutral-900 transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-700">
                  <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: medalColor, opacity: medal ? 1 : 0.4 }} />

                  <CardContent className="flex h-full flex-col gap-4 p-5 pl-6">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-mono text-sm font-black ring-1"
                        style={{
                          backgroundColor: medal ? medalColor : `${medalColor}26`,
                          color: medal ? "#0a0a0a" : medalColor,
                          borderColor: `${medalColor}66`,
                        }}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-base font-bold leading-tight text-white transition-colors group-hover:text-[#6366F1]">
                            {runner.name}
                          </h3>
                          <span className="shrink-0 rounded-full bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-neutral-300">
                            #{runner.rank}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral-400">
                          {runner.countryCode && (
                            <span className="rounded-full bg-neutral-800 px-2 py-0.5 font-bold uppercase text-neutral-200">
                              {runner.countryCode}
                            </span>
                          )}
                          <span className="text-neutral-500">{runner.gender === "M" ? "Male" : "Female"}</span>
                          {runner.age && <span className="text-neutral-500">· {runner.age}yo</span>}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Rating</div>
                      <div className="font-mono text-lg font-bold text-white">{formatNumber(Math.round(numericRating))}</div>
                    </div>

                    <div className="mt-auto border-t border-neutral-800 pt-3 text-xs text-neutral-400">
                      {runner.totalRaces} races completed
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>

      {/* Load More Section with Ref */}
      {!isLoading && hasMore && (
        <div ref={loadMoreRef} className="flex justify-center pt-4">
          <Button
            onClick={handleLoadMore}
            disabled={isFetching}
            variant="outline"
            className="rounded-full border-neutral-800 bg-neutral-900 px-8 py-2 font-semibold text-neutral-300 hover:border-[#6366F1]/60 hover:bg-[#6366F1]/10 hover:text-white"
          >
            {isFetching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}