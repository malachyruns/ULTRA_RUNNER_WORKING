import { useState } from "react";
import { Link } from "wouter";
import {
  usePortalScrapePreview,
  usePortalScrapeImport,
  usePortalListRaces,
  usePortalAutoSearch,
  usePortalAutoImport,
  getPortalListRacesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Globe, ArrowLeft, Download, CheckCircle2, AlertTriangle, Search, Zap, ExternalLink } from "lucide-react";
import { formatSecondsToTime, formatDate } from "@/lib/format";

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-green-500/15 text-green-400 border-green-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

export default function PortalScrape() {
  const queryClient = useQueryClient();

  // --- Manual URL import state ---
  const [url, setUrl] = useState("");
  const [selectedRaceId, setSelectedRaceId] = useState<string>("");
  const previewMutation = usePortalScrapePreview();
  const importMutation = usePortalScrapeImport();

  // --- Auto-search state ---
  const [autoRaceId, setAutoRaceId] = useState<string>("");
  const autoSearchMutation = usePortalAutoSearch();
  const autoImportMutation = usePortalAutoImport();

  const { data: races, isLoading: isLoadingRaces } = usePortalListRaces();

  const handleFetch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    previewMutation.reset();
    importMutation.reset();
    previewMutation.mutate({ data: { url } });
  };

  const handleManualImport = () => {
    if (!selectedRaceId || !previewMutation.data) return;
    importMutation.mutate(
      { id: Number(selectedRaceId), data: { url } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getPortalListRacesQueryKey() });
        },
      }
    );
  };

  const handleAutoSearch = () => {
    if (!autoRaceId) return;
    autoSearchMutation.reset();
    autoImportMutation.reset();
    autoSearchMutation.mutate({ id: Number(autoRaceId) });
  };

  const handleAutoImport = () => {
    if (!autoRaceId) return;
    autoImportMutation.mutate(
      { id: Number(autoRaceId) },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getPortalListRacesQueryKey() });
        },
      }
    );
  };

  const handleUseUrl = (candidateUrl: string) => {
    setUrl(candidateUrl);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const anySuccess = importMutation.isSuccess || autoImportMutation.isSuccess;
  const successData = importMutation.data ?? autoImportMutation.data;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 py-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/portal/dashboard">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight uppercase">Import from Web</h1>
          <p className="text-muted-foreground mt-1">
            Scrape results from UltraSignup, DUV, or any results page — or let UltraRank find them for you.
          </p>
        </div>
      </div>

      {/* Success banner */}
      {anySuccess && successData && (
        <Alert className="bg-green-500/10 border-green-500/20 text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <AlertTitle className="uppercase font-bold tracking-wider">Import Successful</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col gap-3">
            <p>
              {successData.resultsCreated} results imported &middot; {successData.runnersCreated} new runners created &middot; rankings updated.
              {successData.source && <span className="ml-2 text-muted-foreground">Source: {successData.source}</span>}
            </p>
            <Link href="/portal/dashboard">
              <Button variant="outline" size="sm" className="w-fit border-green-500/20 hover:bg-green-500/10 text-green-400">
                Return to Dashboard
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* ─── Section 1: Auto-search ──────────────────────────────── */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/20 border-b border-border/50">
          <CardTitle className="text-xl font-bold uppercase tracking-wider flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Auto-Find Results
          </CardTitle>
          <CardDescription>
            Select one of your races and UltraRank will search DUV and UltraSignup automatically — no URL needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Select
                value={autoRaceId}
                onValueChange={setAutoRaceId}
                disabled={isLoadingRaces || anySuccess}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a race to search for..." />
                </SelectTrigger>
                <SelectContent>
                  {races?.map(race => (
                    <SelectItem key={race.id} value={race.id.toString()}>
                      {race.name} — {formatDate(race.date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAutoSearch}
              disabled={!autoRaceId || autoSearchMutation.isPending || anySuccess}
              variant="secondary"
              className="font-bold uppercase tracking-wider min-w-[140px]"
            >
              <Search className="mr-2 h-4 w-4" />
              {autoSearchMutation.isPending ? "Searching..." : "Search Web"}
            </Button>
          </div>

          {autoSearchMutation.isPending && (
            <div className="flex items-center gap-3 text-muted-foreground text-sm py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Searching DUV Ultramarathon Statistics and UltraSignup...
            </div>
          )}

          {autoSearchMutation.isError && (
            <Alert variant="destructive" className="bg-destructive/10">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle>Search failed</AlertTitle>
              <AlertDescription>
                Could not reach the search engines. Check your connection and try again.
              </AlertDescription>
            </Alert>
          )}

          {autoSearchMutation.isSuccess && autoSearchMutation.data && (
            <div className="space-y-3 mt-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {autoSearchMutation.data.candidates.length === 0
                    ? "No results pages found"
                    : `${autoSearchMutation.data.candidates.length} candidate${autoSearchMutation.data.candidates.length !== 1 ? "s" : ""} found for "${autoSearchMutation.data.raceName}"`}
                </p>
                {autoSearchMutation.data.candidates.some(c => c.confidence === "high" || c.confidence === "medium") && (
                  <Button
                    onClick={handleAutoImport}
                    disabled={autoImportMutation.isPending || anySuccess}
                    size="sm"
                    className="font-bold uppercase tracking-widest"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    {autoImportMutation.isPending ? "Importing..." : "Auto-Import Best Match"}
                  </Button>
                )}
              </div>

              {autoImportMutation.isError && (
                <Alert variant="destructive" className="bg-destructive/10 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {(autoImportMutation.error as { message?: string })?.message ?? "Auto-import failed. Try using the URL manually below."}
                  </AlertDescription>
                </Alert>
              )}

              {autoSearchMutation.data.candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No matching pages found on DUV or UltraSignup. You can still paste a URL manually below.
                </p>
              ) : (
                <div className="divide-y divide-border/30 rounded-lg border border-border/40 overflow-hidden">
                  {autoSearchMutation.data.candidates.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 bg-card/60 hover:bg-muted/20 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground truncate max-w-[280px]">{c.source}</span>
                          {c.date && <span className="text-xs text-muted-foreground">&middot; {c.date}</span>}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${CONFIDENCE_STYLES[c.confidence] ?? CONFIDENCE_STYLES.low}`}>
                        {c.confidence}
                      </span>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="Open in new tab"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs font-semibold"
                        onClick={() => handleUseUrl(c.url)}
                      >
                        Use URL
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Section 2: Manual URL import ──────────────────────── */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/20 border-b border-border/50">
          <CardTitle className="text-xl font-bold uppercase tracking-wider flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> Paste a URL
          </CardTitle>
          <CardDescription>
            Paste a link to any results page. Supported sources:{" "}
            <span className="inline-flex items-center gap-1.5 mt-1">
              <Badge variant="secondary">UltraSignup</Badge>
              <Badge variant="secondary">DUV Ultramarathon Statistics</Badge>
              <Badge variant="secondary">Generic HTML Table</Badge>
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleFetch} className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="https://ultrasignup.com/results_event.aspx?did=..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="flex-1"
              required
            />
            <Button
              type="submit"
              disabled={previewMutation.isPending || anySuccess}
              className="font-bold uppercase tracking-wider min-w-[140px]"
            >
              {previewMutation.isPending ? "Fetching..." : "Fetch Results"}
            </Button>
          </form>

          {previewMutation.isPending && (
            <div className="flex items-center gap-3 text-muted-foreground text-sm mt-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Analyzing web page...
            </div>
          )}

          {previewMutation.isError && (
            <Alert variant="destructive" className="mt-6 bg-destructive/10">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle>Failed to fetch results</AlertTitle>
              <AlertDescription>
                <p>{(previewMutation.error as { message?: string })?.message ?? "Could not scrape the provided URL."}</p>
                <p className="mt-2 text-xs opacity-80">
                  Make sure the URL is publicly accessible and points directly to the results table.
                </p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        {/* Preview table */}
        {previewMutation.isSuccess && previewMutation.data && !anySuccess && (
          <>
            <div className="border-t border-border/50 px-6 py-3 bg-muted/10 flex flex-wrap items-center gap-3 text-sm">
              <Badge className="bg-primary/20 text-primary hover:bg-primary/30 pointer-events-none border-0">
                {previewMutation.data.source}
              </Badge>
              {previewMutation.data.raceName && (
                <span className="font-semibold">{previewMutation.data.raceName}</span>
              )}
              {previewMutation.data.raceDate && (
                <span className="text-muted-foreground">&middot; {formatDate(previewMutation.data.raceDate)}</span>
              )}
              <span className="text-muted-foreground">&middot; {previewMutation.data.totalFound} finishers found</span>
            </div>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 font-medium w-14 text-center">Pos</th>
                    <th className="px-4 py-3 font-medium">Runner</th>
                    <th className="px-4 py-3 font-medium">Country</th>
                    <th className="px-4 py-3 font-medium">Gender</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {previewMutation.data.results.map((r, i) => (
                    <tr key={i} className="hover:bg-muted/10">
                      <td className="px-4 py-2 text-center font-mono text-muted-foreground">
                        {r.position ?? "-"}
                      </td>
                      <td className="px-4 py-2 font-medium">{r.runnerName}</td>
                      <td className="px-4 py-2 text-muted-foreground uppercase text-xs">{r.country ?? "-"}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.gender ?? "-"}</td>
                      <td className="px-4 py-2 font-mono text-muted-foreground">
                        {formatSecondsToTime(r.finishTimeSeconds)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {r.dnf ? (
                          <Badge variant="destructive" className="text-[10px]">DNF</Badge>
                        ) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardFooter className="bg-muted/10 border-t border-border/50 p-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex-1 w-full max-w-xs">
                <Select value={selectedRaceId} onValueChange={setSelectedRaceId} disabled={isLoadingRaces}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select race to import into" />
                  </SelectTrigger>
                  <SelectContent>
                    {races?.map(race => (
                      <SelectItem key={race.id} value={race.id.toString()}>
                        {race.name} ({formatDate(race.date)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleManualImport}
                disabled={!selectedRaceId || importMutation.isPending}
                className="w-full sm:w-auto font-bold uppercase tracking-widest"
              >
                <Download className="mr-2 h-4 w-4" />
                {importMutation.isPending ? "Importing..." : "Import Results"}
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
