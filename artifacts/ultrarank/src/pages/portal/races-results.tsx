import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePortalSubmitResults, useGetRace, getGetRaceQueryKey } from "@workspace/api-client-react";
import { useLocation, useParams, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Plus, Trash2, Trophy, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function parseTime(s: string): number | null {
  if (!s) return null;
  const parts = s.split(":").map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) return parts[0]*3600 + parts[1]*60 + parts[2];
  if (parts.length === 2 && !parts.some(isNaN)) return parts[0]*60 + parts[1];
  return null;
}

const rowSchema = z.object({
  runnerName: z.string().min(1, "Name required"),
  country: z.string().optional(),
  gender: z.string().optional(),
  finishTimeStr: z.string().optional(),
  dnf: z.boolean().default(false),
});

const formSchema = z.object({
  results: z.array(rowSchema).min(1, "At least one result is required"),
});

export default function PortalRaceResults() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const submitResults = usePortalSubmitResults();
  
  const { data: race, isLoading: isLoadingRace } = useGetRace(id, { query: { enabled: !!id, queryKey: getGetRaceQueryKey(id) } });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      results: [
        { runnerName: "", country: "", gender: "M", finishTimeStr: "", dnf: false }
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "results",
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // Transform to BulkResultItem
    let currentPos = 1;
    const transformed = values.results.map((r) => {
      const isDnf = r.dnf;
      const pos = isDnf ? null : currentPos++;
      const timeSecs = isDnf ? null : parseTime(r.finishTimeStr || "");
      
      return {
        runnerName: r.runnerName,
        country: r.country || null,
        gender: r.gender || null,
        position: pos,
        finishTimeSeconds: timeSecs,
        dnf: isDnf,
      };
    });

    submitResults.mutate(
      { id, data: { results: transformed } },
      {
        onSuccess: (data) => {
          toast({
            title: "Results submitted!",
            description: `${data.resultsCreated} results added, ${data.runnersCreated} new runners created. Rankings updated.`,
          });
          setTimeout(() => setLocation("/portal/dashboard"), 3000);
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Submission failed",
            description: "Please check your data and try again.",
          });
        }
      }
    );
  };

  if (isLoadingRace) {
    return <div className="p-8 text-center text-muted-foreground">Loading race data...</div>;
  }

  if (!race) {
    return <div className="p-8 text-center text-muted-foreground">Race not found.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 py-8">
      <div className="flex items-center gap-4">
        <Link href="/portal/dashboard">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight uppercase line-clamp-1">{race.name}</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <span className="font-mono text-primary font-bold">×{race.difficultyScore?.toFixed(2)}</span>
            <span>•</span>
            <span>{race.category.toUpperCase()}</span>
          </p>
        </div>
      </div>

      <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/20 border-b border-border/50">
          <CardTitle className="text-xl font-bold uppercase tracking-wider flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Submit Results
          </CardTitle>
          <CardDescription>
            Add finishers in order of completion. Positions are calculated automatically based on row order.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="overflow-x-auto p-6">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="text-xs text-muted-foreground uppercase border-b border-border">
                    <tr>
                      <th className="px-2 py-3 w-12 text-center font-medium">#</th>
                      <th className="px-2 py-3 font-medium">Runner Name</th>
                      <th className="px-2 py-3 w-24 font-medium">Country</th>
                      <th className="px-2 py-3 w-24 font-medium">Gender</th>
                      <th className="px-2 py-3 w-32 font-medium">Time (HH:MM:SS)</th>
                      <th className="px-2 py-3 w-16 text-center font-medium">DNF</th>
                      <th className="px-2 py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {fields.map((field, index) => {
                      const isDnf = form.watch(`results.${index}.dnf`);
                      // compute visual position
                      const prevDnfs = form.watch("results").slice(0, index).filter(r => r.dnf).length;
                      const visualPos = isDnf ? "-" : (index + 1 - prevDnfs);
                      
                      return (
                        <tr key={field.id} className={`group ${isDnf ? 'bg-destructive/5 opacity-80' : 'hover:bg-muted/20'}`}>
                          <td className="px-2 py-3 text-center font-mono font-bold text-muted-foreground">
                            {visualPos}
                          </td>
                          <td className="px-2 py-3">
                            <FormField control={form.control} name={`results.${index}.runnerName`} render={({ field }) => (
                              <FormItem className="space-y-0">
                                <FormControl>
                                  <Input placeholder="Runner name" className="h-8 text-sm" {...field} />
                                </FormControl>
                                <FormMessage className="text-[10px]" />
                              </FormItem>
                            )} />
                          </td>
                          <td className="px-2 py-3">
                            <FormField control={form.control} name={`results.${index}.country`} render={({ field }) => (
                              <FormItem className="space-y-0">
                                <FormControl>
                                  <Input placeholder="e.g. FR" className="h-8 text-sm uppercase" maxLength={3} {...field} />
                                </FormControl>
                              </FormItem>
                            )} />
                          </td>
                          <td className="px-2 py-3">
                            <FormField control={form.control} name={`results.${index}.gender`} render={({ field }) => (
                              <FormItem className="space-y-0">
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="M">M</SelectItem>
                                    <SelectItem value="F">F</SelectItem>
                                    <SelectItem value="X">X</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )} />
                          </td>
                          <td className="px-2 py-3">
                            <FormField control={form.control} name={`results.${index}.finishTimeStr`} render={({ field }) => (
                              <FormItem className="space-y-0">
                                <FormControl>
                                  <Input 
                                    placeholder="24:15:00" 
                                    className="h-8 text-sm font-mono" 
                                    disabled={isDnf}
                                    {...field} 
                                    value={isDnf ? "" : field.value}
                                  />
                                </FormControl>
                              </FormItem>
                            )} />
                          </td>
                          <td className="px-2 py-3 text-center">
                            <FormField control={form.control} name={`results.${index}.dnf`} render={({ field }) => (
                              <FormItem className="flex items-center justify-center space-y-0 h-8">
                                <FormControl>
                                  <Checkbox 
                                    checked={field.value} 
                                    onCheckedChange={field.onChange} 
                                    className="data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                                  />
                                </FormControl>
                              </FormItem>
                            )} />
                          </td>
                          <td className="px-2 py-3">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-6 bg-muted/10 border-t border-border/50">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => append({ runnerName: "", country: "", gender: "M", finishTimeStr: "", dnf: false })}
                  className="w-full sm:w-auto font-bold uppercase tracking-wider"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Row
                </Button>

                <Button 
                  type="submit" 
                  className="w-full sm:w-auto font-bold uppercase tracking-widest"
                  disabled={submitResults.isPending || fields.length === 0}
                >
                  <Save className="mr-2 h-4 w-4" /> {submitResults.isPending ? "Submitting..." : "Submit All Results"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      {form.formState.errors.results && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-start gap-3 border border-destructive/20 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>Please fix the validation errors in the table rows before submitting. Ensure all runners have a name.</div>
        </div>
      )}
    </div>
  );
}
