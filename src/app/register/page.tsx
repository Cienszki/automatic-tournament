"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, ShieldPlus, Loader2, Info, ShieldCheck, Upload } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { registerTeam, getUserTeam, uploadPlayerScreenshot, uploadTeamLogo } from "@/lib/admin-actions";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerRoles } from "@/lib/definitions";

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const playerSchema = z.object({
  nickname: z.string().min(2, "Nickname is required."),
  steamUrl: z.string().url("Invalid Steam Profile URL."),
  role: z.enum(PlayerRoles, { required_error: "You must select a role." }),
  mmr: z.coerce.number().min(1, "MMR must be a positive number.").max(12000, "MMR seems too high."),
  profileScreenshot: z.any()
    .refine((files) => files?.[0], "Screenshot is required.")
    .refine((files) => files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 1MB.`)
    .refine(
      (files) => ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
      "Only .jpg, .jpeg, .png and .webp formats are supported."
    ),
});

const formSchema = z.object({
  name: z.string().min(3, "Team name must be at least 3 characters."),
  tag: z.string().min(2, "Tag must be 2-4 characters.").max(4),
  motto: z.string().max(100, "Motto cannot exceed 100 characters.").optional(),
  captainDiscordUsername: z.string().min(2, "Discord username is required."),
  logo: z.any()
    .refine((files) => files?.[0], "Team logo is required.")
    .refine((files) => files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 1MB.`)
    .refine(
      (files) => ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
      "Only .jpg, .jpeg, .png and .webp formats are supported."
    ),
  players: z.array(playerSchema).min(5, "You must register at least 5 players."),
  rulesAcknowledged: z.boolean().refine((val) => val === true, {
    message: "You must acknowledge the tournament rules.",
  }),
});

export default function RegisterPage() {
  const { user, signInWithGoogle, refreshUserTeam } = useAuth();
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submissionSuccess, setSubmissionSuccess] = React.useState(false);
  const [userTeam, setUserTeam] = React.useState<{ hasTeam: boolean; team: { id: string; name: string } | null } | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [screenshotPreviews, setScreenshotPreviews] = React.useState<Record<number, string>>({});
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function checkUserTeam() {
      if (user) {
        setIsLoading(true);
        const teamData = await getUserTeam(user.uid);
        setUserTeam(teamData);
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    }
    checkUserTeam();
  }, [user]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      tag: "",
      motto: "",
      captainDiscordUsername: "",
      logo: undefined,
      players: Array(5).fill({ nickname: "", steamUrl: "", mmr: 0, profileScreenshot: undefined }),
      rulesAcknowledged: false,
    },
  });

  const { fields } = useFieldArray({ control: form.control, name: "players" });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      setServerError("You must be logged in to register a team.");
      return;
    }
    setServerError(null);
    setIsSubmitting(true);

    try {
      // 1. Upload Team Logo
      const logoFormData = new FormData();
      logoFormData.append('logo', values.logo[0]);
      logoFormData.append('teamName', values.name);
      const logoResult = await uploadTeamLogo(logoFormData);
      if (!logoResult.success) {
        throw new Error(`Failed to upload team logo: ${logoResult.message}`);
      }

      // 2. Upload Player Screenshots
      const playerInfoWithUrls = await Promise.all(
        values.players.map(async (player) => {
          const screenshotFormData = new FormData();
          screenshotFormData.append('screenshot', player.profileScreenshot[0]);
          screenshotFormData.append('teamName', values.name);
          screenshotFormData.append('nickname', player.nickname);

          const screenshotResult = await uploadPlayerScreenshot(screenshotFormData);
          if (!screenshotResult.success) {
            throw new Error(`Failed to upload screenshot for ${player.nickname}: ${screenshotResult.message}`);
          }
          
          const { profileScreenshot, ...rest } = player;
          return { ...rest, profileScreenshotUrl: screenshotResult.url };
        })
      );

      // 3. Register Team with all the data
      const teamData = {
        ...values,
        logoUrl: logoResult.url, // Use the uploaded logo URL
        createdBy: user.uid,
        players: playerInfoWithUrls,
      };

      const result = await registerTeam(teamData);

      if (result.success) {
        await refreshUserTeam();
        setSubmissionSuccess(true);
      } else {
        setServerError(result.message || "An unknown error occurred.");
      }
    } catch (error) {
      console.error("Registration submission error:", error);
      setServerError((error as Error).message || "An unexpected response was received from the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <Card><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>;
  }

  if (!user) {
    return (
        <Card className="text-center">
            <CardHeader><CardTitle>Please Login</CardTitle><CardDescription>You must be logged in to register a team.</CardDescription></CardHeader>
            <CardContent><Button onClick={signInWithGoogle}>Sign in with Google</Button></CardContent>
        </Card>
    );
  }
  
  if (submissionSuccess) {
    return (
        <Card className="text-center">
            <CardHeader>
                <ShieldCheck className="h-16 w-16 mx-auto text-green-500" />
                <CardTitle className="text-3xl">Registration Submitted!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p>Your team registration has been received and is now pending verification from a tournament administrator.</p>
                <p className="text-sm text-muted-foreground">You can check the status of your team on your team page.</p>
                <Button asChild size="lg">
                    <Link href="/my-team">Go to My Team Page</Link>
                </Button>
            </CardContent>
        </Card>
    );
  }

  if (userTeam?.hasTeam) {
    return (
        <Card className="text-center">
            <CardHeader><Info className="h-12 w-12 mx-auto text-blue-500" /><CardTitle>You Have Already Registered a Team</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <p>You are the captain of team <strong>{userTeam.team?.name}</strong>.</p>
                <p>You can manage your team from your dashboard.</p>
                <Button asChild><Link href="/my-team">Go to My Team</Link></Button>
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
              <FormField name="motto" control={form.control} render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Team Motto (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="captainDiscordUsername" control={form.control} render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Captain's Discord Username</FormLabel><FormControl><Input {...field} /></FormControl><FormDescription>This will be displayed to other captains for scheduling matches.</FormDescription><FormMessage /></FormItem>)} />
              <FormField
                control={form.control}
                name="logo"
                render={({ field: { onChange, value, ...rest } }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Team Logo</FormLabel>
                    <FormControl>
                       <Input 
                        type="file" 
                        accept="image/*" 
                        {...rest}
                        onChange={(e) => {
                            const files = e.target.files;
                            onChange(files);
                            if (files && files[0]) {
                                const file = files[0];
                                setLogoPreview(URL.createObjectURL(file));
                            } else {
                                setLogoPreview(null);
                            }
                        }}
                       />
                    </FormControl>
                    <FormDescription>Max 1MB. JPG, PNG, WEBP. Recommended: 1:1 aspect ratio (e.g., 256x256px).</FormDescription>
                    <FormMessage />
                    {logoPreview && (
                        <div className="mt-4 p-2 border rounded-md bg-muted/50 w-fit">
                             <p className="text-xs font-medium text-foreground mb-2">Logo Preview:</p>
                             <Image
                                src={logoPreview}
                                alt="Team logo preview"
                                width={128}
                                height={128}
                                className="rounded-md object-cover"
                            />
                        </div>
                    )}
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle>Player Roster</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="multiple" defaultValue={["item-0"]} className="w-full">
                {fields.map((field, index) => (
                  <AccordionItem value={`item-${index}`} key={field.id}>
                    <AccordionTrigger>Player {index + 1}: {form.watch(`players.${index}.nickname`)}</AccordionTrigger>
                    <AccordionContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
                      <FormField name={`players.${index}.nickname`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Nickname</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField name={`players.${index}.steamUrl`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Steam Profile URL</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                       <FormField name={`players.${index}.mmr`} control={form.control} render={({ field }) => (<FormItem><FormLabel>MMR</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField
                        control={form.control}
                        name={`players.${index}.role`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {PlayerRoles.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`players.${index}.profileScreenshot`}
                        render={({ field: { onChange, value, ...rest } }) => (
                          <FormItem className="lg:col-span-2">
                            <FormLabel>MMR Screenshot</FormLabel>
                            <FormControl>
                               <Input 
                                type="file" 
                                accept="image/*" 
                                {...rest}
                                onChange={(e) => {
                                    const files = e.target.files;
                                    onChange(files);
                                    if (files && files[0]) {
                                        const file = files[0];
                                        setScreenshotPreviews(prev => ({ ...prev, [index]: URL.createObjectURL(file) }));
                                    } else {
                                        setScreenshotPreviews(prev => {
                                            const newPreviews = { ...prev };
                                            delete newPreviews[index];
                                            return newPreviews;
                                        });
                                    }
                                }}
                               />
                            </FormControl>
                            <FormDescription>Max 1MB. JPG, PNG, WEBP.</FormDescription>
                            <FormMessage />
                            {screenshotPreviews[index] && (
                                <div className="mt-2 p-2 border rounded-md bg-muted/50">
                                    <p className="text-xs font-medium text-foreground mb-2">Screenshot Preview:</p>
                                    <div className="relative w-full h-40">
                                        <Image
                                            src={screenshotPreviews[index]}
                                            alt={`Player ${index + 1} screenshot preview`}
                                            fill
                                            style={{ objectFit: 'contain' }}
                                        />
                                    </div>
                                </div>
                            )}
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
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>I agree to the <Link href="/rules" className="text-primary hover:underline">tournament rules</Link>.</FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
              <Button type="submit" size="lg" className="w-full mt-6" disabled={isSubmitting || !form.formState.isValid}>
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
