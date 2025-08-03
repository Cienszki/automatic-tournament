"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, ShieldPlus, Loader2, Image as ImageIcon, MessageCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PlayerRoles, TEAM_MMR_CAP } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { registerTeam } from "@/lib/actions";
import { uploadScreenshot, uploadTeamLogo } from "@/lib/storage";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const formSchema = z.object({
  name: z.string()
    .min(3, "Team name must be at least 3 characters.")
    .regex(/^[A-Za-z0-9 _-]+$/, "Team name can only contain letters, numbers, spaces, hyphens, and underscores."),
  tag: z.string().min(2, "Tag must be 2-4 characters.").max(4),
  discordUsername: z.string().min(2, "Discord username is required."),
  motto: z.string().min(5, "Motto must be at least 5 characters."),
  logo: z.custom<File | null>(
    (file) => file instanceof File, "Logo is required."
  ).refine(
    (file) => !!file && file.size <= MAX_FILE_SIZE, `Max file size is 5MB.`
  ).refine(
    (file) => !!file && ACCEPTED_IMAGE_TYPES.includes(file.type),
    "Only .jpg, .jpeg, .png and .webp formats are supported."
  ),
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
  })).min(5, "You must register exactly 5 players.").max(5),
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

import { getApp } from "firebase/app";

export default function RegisterPage() {
    const { user, signInWithGoogle } = useAuth();
    // Firestore write test button handler
    async function handleTestFirestoreWrite() {
        try {
            const { getFirestore, collection, doc, setDoc, deleteDoc } = await import("firebase/firestore");
            const { getAuth } = await import("firebase/auth");
            const db = getFirestore();
            const auth = getAuth();
            console.log("Current user:", auth.currentUser);
            
            // Create a temporary test document and immediately delete it
            const testDocRef = doc(collection(db, "teams"), "temp-test-" + Date.now());
            await setDoc(testDocRef, { 
                test: true, 
                name: "Temporary Test", 
                tag: "TEMP",
                captainId: auth.currentUser?.uid,
                status: "pending",
                createdAt: new Date()
            });
            
            // Immediately delete the test document
            await deleteDoc(testDocRef);
            
            alert("Firestore write test succeeded! (Test document created and deleted)");
        } catch (e: any) {
            console.error("Firestore write failed", e);
            alert("Firestore write failed: " + (typeof e === 'object' && e !== null && 'message' in e ? (e as any).message : String(e)));
        }
    }
    const [serverError, setServerError] = React.useState<string | null>(null);
    const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
    const [screenshotPreviews, setScreenshotPreviews] = React.useState<(string | null)[]>(Array(5).fill(null));
    const router = useRouter();
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        mode: "onChange",
        defaultValues: {
            name: "",
            tag: "",
            discordUsername: "",
            motto: "",
            logo: null,
            players: Array(5).fill({ nickname: "", role: undefined, mmr: 0, steamProfileUrl: "", profileScreenshot: null }),
            rulesAcknowledged: false,
        },
    });

    const { fields } = useFieldArray({ control: form.control, name: "players" });
    const playerValues = form.watch("players");
    const totalMMR = playerValues.reduce((sum, player) => sum + (Number(player.mmr) || 0), 0);
    const { isSubmitting, isValid } = form.formState;
    
    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        form.setValue("logo", file, { shouldValidate: true });
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setLogoPreview(reader.result as string);
            reader.readAsDataURL(file);
        } else {
            setLogoPreview(null);
        }
    };

    const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0] || null;
        form.setValue(`players.${index}.profileScreenshot`, file, { shouldValidate: true });
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setScreenshotPreviews(prev => {
                    const newPreviews = [...prev];
                    newPreviews[index] = reader.result as string;
                    return newPreviews;
                });
            };
            reader.readAsDataURL(file);
        } else {
            setScreenshotPreviews(prev => {
                const newPreviews = [...prev];
                newPreviews[index] = null;
                return newPreviews;
            });
        }
    };
    
    // Log Firebase project ID for debugging
    try {
        const projectId = getApp().options.projectId;
        console.log("[DEBUG] Frontend Firebase projectId:", projectId);
    } catch (e) {
        console.log("[DEBUG] Could not get Firebase projectId", e);
    }

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        console.log("[DEBUG] user object at submit:", user);
        if (!user) {
            setServerError("You must be logged in to register a team.");
            return;
        }
        if (!user.uid || typeof user.uid !== "string" || user.uid.trim() === "") {
            console.error("Registration error: user.uid is missing or invalid", user);
            setServerError("Your user ID is missing. Please log out and log in again, or contact support.");
            return;
        }
        setServerError(null);
        try {
            const logoUrl = await uploadTeamLogo(values.logo!, values.name);
            const screenshotUrls = await Promise.all(
                values.players.map((player, index) => 
                    uploadScreenshot(player.profileScreenshot!, `${values.name}-player${index+1}`)
                )
            );

            const teamPayload = {
                name: values.name,
                tag: values.tag,
                discordUsername: values.discordUsername,
                motto: values.motto,
                logoUrl,
                captainId: user.uid,
                players: values.players.map((p, i) => ({
                    nickname: p.nickname,
                    mmr: p.mmr,
                    role: p.role,
                    steamProfileUrl: p.steamProfileUrl,
                    profileScreenshotUrl: screenshotUrls[i]
                })),
            };

            // Pass the actual Firebase Auth user object for authentication
            const result = await registerTeam({ ...teamPayload, _authUser: user });

            if (result?.success) {
                router.push('/my-team');
            } else {
                setServerError(result?.message || "An unknown error occurred during registration.");
            }
        } catch (error) {
            setServerError((error as Error).message || "An unexpected error occurred during registration.");
        }
    };

    if (!user) {
        return (
            <Card className="text-center">
                <CardHeader><CardTitle>Please Login</CardTitle><CardDescription>You must be logged in to register a team.</CardDescription></CardHeader>
                <CardContent><Button onClick={signInWithGoogle}>Sign in with Google</Button></CardContent>
            </Card>
        );
    }

  return (
    <div className="space-y-8">
      <Card><CardHeader className="text-center"><UserPlus className="h-16 w-16 mx-auto text-primary" /><CardTitle className="text-4xl font-bold">Team Registration</CardTitle></CardHeader></Card>

      {/* Firestore write test button for debugging */}
      {user && (
        <div className="flex justify-center mb-4">
          <Button type="button" variant="outline" onClick={handleTestFirestoreWrite}>
            Test Firestore Write
          </Button>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader><CardTitle>Team & Captain Details</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                    <FormField name="name" control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Team Name
                          <span className="block text-sm font-semibold text-[#b86fc6] mt-1">(Must be identical to the ingame team name!)</span>
                        </FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField name="tag" control={form.control} render={({ field }) => (<FormItem><FormLabel>Team Tag</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField name="discordUsername" control={form.control} render={({ field }) => (<FormItem><FormLabel>Captain's Discord</FormLabel><FormControl><Input {...field} placeholder="your_discord_name" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField name="motto" control={form.control} render={({ field }) => (<FormItem><FormLabel>Team Motto</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField
                    control={form.control}
                    name="logo"
                    render={() => (
                      <FormItem>
                        <FormLabel>Team Logo</FormLabel>
                        <div className="flex items-center gap-6">
                            <div className="w-32 h-32 rounded-lg bg-muted flex items-center justify-center border">
                                {logoPreview ? 
                                    <Image src={logoPreview} alt="Logo preview" width={128} height={128} className="object-cover rounded-lg"/> : 
                                    <ImageIcon className="w-16 h-16 text-muted-foreground"/>
                                }
                            </div>
                            <div className="flex-1">
                                <FormControl>
                                  <Input type="file" accept="image/*" onChange={handleLogoChange} />
                                </FormControl>
                                <FormDescription className="mt-2">
                                  Max 5MB. JPG, PNG, WEBP. Recommended: Square aspect ratio.
                                </FormDescription>
                                <FormMessage />
                            </div>
                        </div>
                      </FormItem>
                    )}
                  />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Player Roster</CardTitle>
              <div className={cn("p-3 mt-4 rounded-md text-center font-semibold", totalMMR > TEAM_MMR_CAP ? "text-destructive bg-destructive/10" : "text-primary bg-primary/10")}>
                Total MMR: {totalMMR.toLocaleString()} / {TEAM_MMR_CAP.toLocaleString()}
              </div>
              {form.formState.errors.players && <p className="text-sm font-medium text-destructive mt-2 text-center">{form.formState.errors.players.message}</p>}
            </CardHeader>
            <CardContent className="space-y-6">
                {fields.map((field, index) => (
                    <Card key={field.id} className="p-4">
                        <h4 className="font-bold text-lg text-center mb-4">Player {index + 1}</h4>
                        <div className="space-y-4 pt-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField name={`players.${index}.nickname`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Nickname</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField name={`players.${index}.mmr`} control={form.control} render={({ field }) => (<FormItem><FormLabel>MMR</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField name={`players.${index}.steamProfileUrl`} control={form.control} render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Steam Profile URL</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField name={`players.${index}.role`} control={form.control} render={({ field }) => (<FormItem><FormLabel>Role</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl><SelectContent>{PlayerRoles.map(role => (<SelectItem key={role} value={role}>{role}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                            <FormField
                                control={form.control}
                                name={`players.${index}.profileScreenshot`}
                                render={() => (
                                <FormItem>
                                    <FormLabel>MMR Screenshot</FormLabel>
                                    <FormControl>
                                    <Input type="file" accept="image/*" onChange={(e) => handleScreenshotChange(e, index)} />
                                    </FormControl>
                                    <FormMessage />
                                    {screenshotPreviews[index] && (
                                        <div className="mt-2 rounded-md border bg-muted p-2">
                                            <Image 
                                                src={screenshotPreviews[index]!} 
                                                alt={`Player ${index + 1} screenshot preview`} 
                                                width={400} 
                                                height={225} 
                                                className="rounded-md object-contain mx-auto"
                                            />
                                        </div>
                                    )}
                                </FormItem>
                                )}
                            />
                        </div>
                    </Card>
                ))}
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
