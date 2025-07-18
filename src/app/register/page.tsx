"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, ShieldPlus, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PlayerRoles, TEAM_MMR_CAP } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { registerTeam } from "@/lib/actions";
import { uploadScreenshot } from "@/lib/firebase";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const formSchema = z.object({
  name: z.string().min(3, "Team name must be at least 3 characters."),
  tag: z.string().min(2, "Tag must be 2-4 characters.").max(4),
  motto: z.string().min(5, "Motto must be at least 5 characters."),
  logoUrl: z.string().url("Must be a valid URL."),
  players: z.array(z.object({
    nickname: z.string().min(2, "Nickname is required."),
    role: z.enum(PlayerRoles),
    mmr: z.coerce.number().min(1000).max(12000),
    steamProfileUrl: z.string().url("Must be a valid Steam profile URL."),
    profileScreenshot: z.custom<File | null>(
      (file) => file instanceof File, "Screenshot is required."
    ).refine(
      (file) => !!file && file.size <= MAX_FILE_SIZE, `Max file size is 5MB.`
    ).refine(
      (file) => !!file && ACCEPTED_IMAGE_TYPES.includes(file.type),
      "Only .jpg, .jpeg, .png and .webp formats are supported."
    ),
  })).length(5, "You must register exactly 5 players."),
  rulesAcknowledged: z.boolean().refine((val) => val === true, {
    message: "You must acknowledge the tournament rules.",
  }),
}).refine(data => {
  const totalMMR = data.players.reduce((sum, player) => sum + player.mmr, 0);
  return totalMMR <= TEAM_MMR_CAP;
}, {
  message: `Total team MMR cannot exceed ${TEAM_MMR_CAP.toLocaleString()}.`,
  path: ["players"],
});

export default function RegisterPage() {
  const { user, signInWithGoogle } = useAuth();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      tag: "",
      motto: "",
      logoUrl: "",
      players: Array(5).fill({ nickname: "", role: undefined, mmr: 0, steamProfileUrl: "", profileScreenshot: null }),
      rulesAcknowledged: false,
    },
  });

  const { fields } = useFieldArray({ control: form.control, name: "players" });
  const totalMMR = form.watch("players").reduce((sum, player) => sum + (Number(player.mmr) || 0), 0);
  const { isSubmitting, isValid } = form.formState;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      setServerError("You must be logged in to register a team.");
      return;
    }
    setServerError(null);
    try {
        const screenshotUrls = await Promise.all(
            values.players.map(player => 
                uploadScreenshot(player.profileScreenshot!, values.name, player.nickname)
            )
        );

        const formData = new FormData();
        formData.append("name", values.name);
        formData.append("tag", values.tag);
        formData.append("motto", values.motto);
        formData.append("logoUrl", values.logoUrl);
        values.players.forEach((player, index) => {
            formData.append(`players[${index}].nickname`, player.nickname);
            formData.append(`players[${index}].mmr`, String(player.mmr));
            formData.append(`players[${index}].role`, player.role);
            formData.append(`players[${index}].steamProfileUrl`, player.steamProfileUrl);
            formData.append(`players[${index}].mmrScreenshotUrl`, screenshotUrls[index]);
        });


        const result = await registerTeam(user.uid, { message: serverError }, formData);

        if (result?.message) {
            setServerError(result.message);
        } else {
            // Handle success, e.g., redirect or show a success message
            console.log('Team registered successfully!');
            // e.g., router.push('/my-team');
        }
    } catch (error) {
        setServerError((error as Error).message || "An unexpected error occurred during registration.");
    }
  };

  if (!user) {
    return (
        <Card className="text-center">
            <CardHeader>
                <CardTitle>Please Login</CardTitle>
                <CardDescription>You must be logged in to register a team.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={signInWithGoogle}>Sign in with Google</Button>
            </CardContent>
        </Card>
    );
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
                    <AccordionTrigger>Player {index + 1}: {form.watch(`players.${index}.nickname`)}</AccordionTrigger>
                    <AccordionContent className="grid md:grid-cols-2 gap-6 p-4">
                      <FormField name={`players.${index}.nickname`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Nickname</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField name={`players.${index}.mmr`} control={form.control} render={({ field }) => (<FormItem><FormLabel>MMR</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField name={`players.${index}.steamProfileUrl`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Steam Profile URL</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField name={`players.${index}.role`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Role</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{PlayerRoles.map(role => (<SelectItem key={role} value={role}>{role}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                      <FormField
                        control={form.control}
                        name={`players.${index}.profileScreenshot`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>MMR Screenshot</FormLabel>
                            <FormControl>
                              <Input type="file" accept="image/*" onChange={(e) => field.onChange(e.target.files ? e.target.files[0] : null)} />
                            </FormControl>
                            <FormDescription>
                              Max file size: 5MB. Accepted formats: JPG, PNG, WEBP.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <FormField
                control={form.control}
                name="rulesAcknowledged"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        I have read and agree to the <Link href="/rules" className="text-primary hover:underline">tournament rules</Link>.
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
              <Button type="submit" size="lg" className="w-full mt-6" disabled={isSubmitting || !isValid}>
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldPlus className="mr-2 h-5 w-5" />}
                Submit Registration
              </Button>
              {serverError && <p className="text-sm font-medium text-destructive mt-4 text-center">{serverError}</p>}
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
