"use client";

import * as React from "react";
import { useFormState } from 'react-dom';
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, ShieldPlus, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PlayerRoles, TEAM_MMR_CAP } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { registerTeam } from "@/lib/actions";

const formSchema = z.object({
  name: z.string().min(3, "Team name must be at least 3 characters."),
  tag: z.string().min(2, "Tag must be 2-4 characters.").max(4),
  motto: z.string().min(5, "Motto must be at least 5 characters."),
  logoUrl: z.string().url("Must be a valid URL."),
  players: z.array(z.object({
    id: z.string().min(1, "Player ID is required."),
    nickname: z.string().min(2, "Nickname is required."),
    role: z.enum(PlayerRoles),
    mmr: z.coerce.number().min(1000).max(12000),
    steamProfileUrl: z.string().url("Must be a valid Steam profile URL."),
  })).length(5, "You must register exactly 5 players."),
}).refine(data => {
  const totalMMR = data.players.reduce((sum, player) => sum + player.mmr, 0);
  return totalMMR <= TEAM_MMR_CAP;
}, {
  message: `Total team MMR cannot exceed ${TEAM_MMR_CAP.toLocaleString()}.`,
  path: ["players"],
});

export default function RegisterPage() {
  const { user } = useAuth();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      players: Array(5).fill({ id: "", nickname: "", role: undefined, mmr: 0, steamProfileUrl: "" }),
    },
  });

  const { fields } = useFieldArray({ control: form.control, name: "players" });
  const totalMMR = form.watch("players").reduce((sum, player) => sum + (Number(player.mmr) || 0), 0);
  const [formState, dispatch] = useFormState(registerTeam.bind(null, user?.uid || ""), { message: null });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => {
        if (key === 'players') {
            (value as any[]).forEach((p, i) => {
                Object.entries(p).forEach(([pKey, pValue]) => {
                    formData.append(`players[${i}].${pKey}`, pValue as string);
                });
            });
        } else {
            formData.append(key, value as string);
        }
    });
    await dispatch(formData);
    setIsSubmitting(false);
  };

  if (!user) {
    return <Card><CardHeader><CardTitle>Please Login</CardTitle><CardDescription>You must be logged in to register a team.</CardDescription></CardHeader></Card>;
  }

  return (
    <div className="space-y-8">
      <Card><CardHeader className="text-center"><UserPlus className="h-16 w-16 mx-auto text-primary" /><CardTitle className="text-4xl font-bold">Team Registration</CardTitle></CardHeader></Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader><CardTitle>Team Details</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <FormField name="name" control={form.control} render={({ field }) => (<FormItem><FormLabel>Team Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="tag" control={form.control} render={({ field }) => (<FormItem><FormLabel>Team Tag</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="motto" control={form.control} render={({ field }) => (<FormItem><FormLabel>Motto</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="logoUrl" control={form.control} render={({ field }) => (<FormItem><FormLabel>Logo URL</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
                <CardTitle>Player Roster</CardTitle>
                <div className={cn("p-3 rounded-md text-center", totalMMR > TEAM_MMR_CAP ? "text-destructive" : "text-primary")}>
                    Total MMR: {totalMMR.toLocaleString()} / {TEAM_MMR_CAP.toLocaleString()}
                </div>
                {form.formState.errors.players && <p className="text-sm font-medium text-destructive">{form.formState.errors.players.message}</p>}
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible defaultValue="item-0" className="w-full">
                    {fields.map((field, index) => (
                        <AccordionItem value={`item-${index}`} key={field.id}>
                            <AccordionTrigger>Player {index + 1}</AccordionTrigger>
                            <AccordionContent className="grid md:grid-cols-2 gap-6 p-4">
                                <FormField name={`players.${index}.nickname`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Nickname</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField name={`players.${index}.mmr`} control={form.control} render={({ field }) => (<FormItem><FormLabel>MMR</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField name={`players.${index}.id`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Player ID (e.g. Steam64)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField name={`players.${index}.steamProfileUrl`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Steam Profile URL</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField name={`players.${index}.role`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Role</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{PlayerRoles.map(role => (<SelectItem key={role} value={role}>{role}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
                 <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldPlus className="mr-2 h-5 w-5" />}
                    Submit Registration
                </Button>
                {formState?.message && <p className="text-sm font-medium text-destructive mt-4 text-center">{formState.message}</p>}
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
