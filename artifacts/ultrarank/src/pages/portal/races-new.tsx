import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePortalCreateRace } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

// Replicate Zod schemas from backend slightly
const formSchema = z.object({
  name: z.string().min(2, "Race name is required"),
  location: z.string().min(2, "Location is required"),
  country: z.string().min(2, "Country is required"),
  date: z.string().min(10, "Date is required"),
  distanceKm: z.coerce.number().min(1, "Distance is required"),
  category: z.enum(["50k", "100k", "50mi", "100mi", "200mi", "other"]),
  surface: z.enum(["trail", "road", "mountain", "mixed"]),
  totalElevationM: z.coerce.number().optional(),
  description: z.string().optional(),
  weatherConditions: z.enum(["clear", "rain", "heat", "snow", "storm"]).optional(),
  technicalityRating: z.number().min(1).max(5).optional(),
});

function clientDifficulty(surface: string, elevM: number, distKm: number, weather: string, techRating: number): number {
  const surfaceFactor: Record<string, number> = { road: 1.0, trail: 1.2, mixed: 1.35, mountain: 1.55 };
  const weatherFactor: Record<string, number> = { clear: 1.0, rain: 1.12, heat: 1.15, snow: 1.22, storm: 1.35 };
  
  const sFactor = surfaceFactor[surface] ?? 1.0;
  const vertRatio = elevM && distKm ? (elevM / distKm) * 100 : 0;
  const elevFactor = 1.0 + (vertRatio / 1000) * 0.08;
  const wFactor = weatherFactor[weather] ?? 1.0;
  const techFactor = techRating ? 1.0 + ((Math.max(1, Math.min(5, techRating)) - 1) / 4) * 0.45 : 1.0;
  
  return Math.round(sFactor * elevFactor * wFactor * techFactor * 1000) / 1000;
}

export default function PortalRaceNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createRace = usePortalCreateRace();
  const [difficulty, setDifficulty] = useState(1.0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      location: "",
      country: "",
      date: new Date().toISOString().split("T")[0],
      category: "100k",
      surface: "trail",
      weatherConditions: "clear",
      technicalityRating: 3,
    },
  });

  const watchAll = form.watch();

  useEffect(() => {
    const diff = clientDifficulty(
      watchAll.surface || "trail",
      Number(watchAll.totalElevationM || 0),
      Number(watchAll.distanceKm || 0),
      watchAll.weatherConditions || "clear",
      Number(watchAll.technicalityRating || 3)
    );
    setDifficulty(diff);
  }, [watchAll]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createRace.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({ title: "Race created successfully." });
          setLocation("/portal/dashboard");
        },
        onError: () => {
          toast({ variant: "destructive", title: "Failed to create race." });
        }
      }
    );
  };

  const getDifficultyBadge = (score: number) => {
    if (score < 1.3) return <Badge className="bg-green-500">Normal</Badge>;
    if (score < 1.8) return <Badge className="bg-yellow-500">Challenging</Badge>;
    if (score < 2.4) return <Badge className="bg-orange-500 text-white">Hard</Badge>;
    return <Badge className="bg-red-500 text-white">Extreme</Badge>;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 py-8">
      <div className="flex items-center gap-4">
        <Link href="/portal/dashboard">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight uppercase">Create New Race</h1>
          <p className="text-muted-foreground mt-1">Add a new event to your organization.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
            <CardHeader>
              <CardTitle>Race Details</CardTitle>
              <CardDescription>Enter the core information about this race.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form id="race-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Race Name</FormLabel>
                        <FormControl><Input placeholder="Ultra Trail Mont Blanc" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="location" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl><Input placeholder="Chamonix" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="country" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country (Code or Name)</FormLabel>
                        <FormControl><Input placeholder="FR" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="date" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="category" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="50k">50K</SelectItem>
                            <SelectItem value="100k">100K</SelectItem>
                            <SelectItem value="50mi">50 Mile</SelectItem>
                            <SelectItem value="100mi">100 Mile</SelectItem>
                            <SelectItem value="200mi">200 Mile</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="distanceKm" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Distance (km)</FormLabel>
                        <FormControl><Input type="number" step="0.1" placeholder="100" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="totalElevationM" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Elevation Gain (m)</FormLabel>
                        <FormControl><Input type="number" placeholder="6000" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border/50">
                    <h3 className="font-semibold text-lg uppercase tracking-tight">Difficulty Factors</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="surface" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Surface Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select surface" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="road">Road</SelectItem>
                              <SelectItem value="mixed">Mixed</SelectItem>
                              <SelectItem value="trail">Trail</SelectItem>
                              <SelectItem value="mountain">Mountain</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      
                      <FormField control={form.control} name="weatherConditions" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Weather Conditions</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select weather" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="clear">Clear / Optimal</SelectItem>
                              <SelectItem value="rain">Rain / Mud</SelectItem>
                              <SelectItem value="heat">Extreme Heat</SelectItem>
                              <SelectItem value="snow">Snow / Ice</SelectItem>
                              <SelectItem value="storm">Severe Storms</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="technicalityRating" render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="flex justify-between">
                            <span>Technicality Rating (1-5)</span>
                            <span className="font-mono text-primary">{field.value}</span>
                          </FormLabel>
                          <FormControl>
                            <Slider
                              min={1}
                              max={5}
                              step={1}
                              value={[field.value || 3]}
                              onValueChange={(vals) => field.onChange(vals[0])}
                              className="py-4"
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground flex justify-between">
                            <span>1 = Smooth, runnable</span>
                            <span>5 = Scrambling, extreme terrain</span>
                          </p>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-border/50">
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Race details, requirements, etc." className="resize-none" rows={4} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-primary/20 bg-card/80 backdrop-blur-sm shadow-sm sticky top-6">
            <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
              <CardTitle className="text-lg font-bold uppercase flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" /> Live Difficulty
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="text-center space-y-2">
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Estimated Score</div>
                <div className="text-5xl font-mono font-bold text-foreground">
                  ×{difficulty.toFixed(2)}
                </div>
                <div className="pt-2">{getDifficultyBadge(difficulty)}</div>
              </div>
              
              <div className="space-y-2 text-sm pt-4 border-t border-border/50">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  This score is a multiplier applied to baseline runner performance. 
                  A score of ×1.0 represents a flat road race in optimal conditions.
                </p>
              </div>

              <Button form="race-form" type="submit" className="w-full font-bold uppercase tracking-widest h-12 mt-4" disabled={createRace.isPending}>
                {createRace.isPending ? "Saving..." : "Create Race"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
