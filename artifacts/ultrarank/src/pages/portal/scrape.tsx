import { useState } from "react";
import { useLocation, Link } from "wouter";
import { usePortalScrapePreview, usePortalScrapeImport, usePortalListRaces, getPortalListRacesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Globe, ArrowLeft, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { formatSecondsToTime, formatDate } from "@/lib/format";

export default function PortalScrape() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [selectedRaceId, setSelectedRaceId] = useState<string>("");
  
  const previewMutation = usePortalScrapePreview();
  const importMutation = usePortalScrapeImport();

  const { data: races, isLoading: isLoadingRaces } = usePortalListRaces();

  const handleFetch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    previewMutation.mutate({ data: { url } });
  };

  const handleImport = () => {
    if (!selectedRaceId || !previewMutation.data) return;
    importMutation.mutate(
      { id: Number(selectedRaceId), data: { url } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getPortalListRacesQueryKey() });
        }
      }
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 py-8">
      <div className="flex items-center gap-4">
        <Link href="/portal/dashboard">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight uppercase">Import from Web</h1>
          <p className="text-muted-foreground mt-1">Automatically scrape and import race results from supported websites.</p>
        </div>
      </div>

      {importMutation.isSuccess && importMutation.data && (
        <Alert className="bg-green-500/10 border-green-500/20 text-green-500">
          <CheckCircle2 className="h-5 w-5" />
          <AlertTitle className="uppercase font-bold tracking-wider">Import Successful</AlertTitle>
          <AlertDescription className="mt-2">
            <div className="flex flex-col gap-2">
              <p>{importMutation.data.resultsCreated} results imported, {importMutation.data.runnersCreated} new runners added. Rankings updated.</p>
              <Link href="/portal/dashboard">
                <Button variant="outline" className="w-fit border-green-500/20 hover:bg-green-500/20 text-green-500">
                  Return to Dashboard
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/20 border-b border-border/50">
          <CardTitle className="text-xl font-bold uppercase tracking-wider flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> Fetch Results
          </CardTitle>
          <CardDescription>
            Supported sources: 
            <span className="flex items-center gap-2 mt-2">
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
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
              required
            />
            <Button 
              type="submit" 
              disabled={previewMutation.isPending || importMutation.isSuccess}
              className="font-bold uppercase tracking-wider min-w-[140px]"
            >
              {previewMutation.isPending ? "Fetching..." : "Fetch Results"}
            </Button>
          </form>

          {previewMutation.isError && (
            <Alert variant="destructive" className="mt-6 bg-destructive/10">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle>Failed to fetch results</AlertTitle>
              <AlertDescription>
                <p>{(previewMutation.error as any)?.message || "Could not scrape the provided URL."}</p>
                <p className="mt-2 text-xs opacity-80">Make sure the URL is accessible publicly and points directly to the results page.</p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {previewMutation.isPending && (
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
          <CardContent className="p-8 flex flex-col items-center justify-center space-y-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground uppercase tracking-widest text-sm font-bold">Analyzing Web Page...</p>
          </CardContent>
        </Card>
      )}

      {previewMutation.isSuccess && previewMutation.data && !importMutation.isSuccess && (
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/20 border-b border-border/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-bold uppercase tracking-wider">Preview</CardTitle>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <Badge className="bg-primary/20 text-primary hover:bg-primary/30 pointer-events-none">
                    Source: {previewMutation.data.source}
                  </Badge>
                  {previewMutation.data.raceName && (
                    <span className="font-medium text-foreground">{previewMutation.data.raceName}</span>
                  )}
                  {previewMutation.data.raceDate && (
                    <span>• {formatDate(previewMutation.data.raceDate)}</span>
                  )}
                  <span>• {previewMutation.data.totalFound} finishers found</span>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm text-left border-collapse relative">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 font-medium w-16 text-center">Pos</th>
                  <th className="px-4 py-3 font-medium">Runner Name</th>
                  <th className="px-4 py-3 font-medium">Country</th>
                  <th className="px-4 py-3 font-medium">Gender</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {previewMutation.data.results.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/10">
                    <td className="px-4 py-2 text-center font-mono text-muted-foreground">{r.position || "-"}</td>
                    <td className="px-4 py-2 font-medium">{r.runnerName}</td>
                    <td className="px-4 py-2 text-muted-foreground uppercase">{r.country || "-"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.gender || "-"}</td>
                    <td className="px-4 py-2 font-mono text-muted-foreground">{formatSecondsToTime(r.finishTimeSeconds)}</td>
                    <td className="px-4 py-2 text-center">
                      {r.dnf ? <Badge variant="destructive" className="text-[10px]">DNF</Badge> : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <CardFooter className="bg-muted/10 border-t border-border/50 p-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full max-w-sm">
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
              onClick={handleImport}
              disabled={!selectedRaceId || importMutation.isPending}
              className="w-full sm:w-auto font-bold uppercase tracking-widest"
            >
              <Download className="mr-2 h-4 w-4" /> 
              {importMutation.isPending ? "Importing..." : "Import Results"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
