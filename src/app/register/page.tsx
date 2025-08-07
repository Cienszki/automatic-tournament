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
import { useTranslation } from "@/hooks/useTranslation";
import { PlayerRoles, TEAM_MMR_CAP } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { registerTeam } from "@/lib/actions";
import { uploadScreenshot, uploadTeamLogo } from "@/lib/storage";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

const formSchema = z.object({
  name: z.string()
    .min(3, "Nazwa zespołu musi mieć co najmniej 3 znaki.")
    .regex(/^[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż0-9 _-]+$/, "Nazwa zespołu może zawierać tylko litery (w tym polskie), cyfry, spacje, myślniki i podkreślenia."),
  tag: z.string().min(2, "Tag musi mieć 2-4 znaki.").max(4),
  discordUsername: z.string().min(2, "Nick Discord jest wymagany."),
  motto: z.string().min(5, "Motto musi mieć co najmniej 5 znaków."),
  logo: z.custom<File | null>(
    (file) => file instanceof File, "Logo jest wymagane."
  ).refine(
    (file) => !!file && file.size <= MAX_FILE_SIZE, `Maksymalny rozmiar pliku to 5MB.`
  ).refine(
    (file) => !!file && ACCEPTED_IMAGE_TYPES.includes(file.type),
    "Obsługiwane są tylko formaty .jpg, .jpeg, .png, .webp i .gif."
  ),
  players: z.array(z.object({
    nickname: z.string()
      .min(2, "Nick jest wymagany.")
      .regex(/^[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż0-9 _-]+$/, "Nick może zawierać tylko litery (w tym polskie), cyfry, spacje, myślniki i podkreślenia."),
    role: z.enum(PlayerRoles),
    mmr: z.coerce.number().min(1000).max(12000),
    steamProfileUrl: z.string().url("Musi być prawidłowym URL profilu Steam."),
    profileScreenshot: z.custom<File | null>(
      (file) => file instanceof File, "Zrzut ekranu jest wymagany."
    ).refine(
      (file) => !!file && file.size <= MAX_FILE_SIZE, `Maksymalny rozmiar pliku to 5MB.`
    ).refine(
      (file) => !!file && ACCEPTED_IMAGE_TYPES.includes(file.type),
      "Obsługiwane są tylko formaty .jpg, .jpeg, .png, .webp i .gif."
    ),
  })).min(5, "Musisz zarejestrować dokładnie 5 graczy.").max(5),
  rulesAcknowledged: z.boolean().refine((val) => val === true, {
    message: "Musisz zaakceptować regulamin turnieju.",
  }),
}).refine(data => {
  const totalMMR = data.players.reduce((sum, player) => sum + player.mmr, 0);
  return totalMMR <= TEAM_MMR_CAP;
}, {
  message: `Łączne MMR zespołu nie może przekroczyć ${TEAM_MMR_CAP.toLocaleString()}.`,
  path: ["players"],
}).refine(data => {
  const roles = data.players.map(player => player.role);
  const uniqueRoles = new Set(roles);
  return uniqueRoles.size === roles.length;
}, {
  message: "Każdy gracz musi mieć unikalną rolę. Nie można duplikować ról.",
  path: ["players"],
}).refine(data => {
  const roles = data.players.map(player => player.role);
  const allRoles = new Set(PlayerRoles);
  const playerRoles = new Set(roles);
  return PlayerRoles.every(role => playerRoles.has(role));
}, {
  message: "Musisz mieć gracza na każdej pozycji: Carry, Mid, Offlane, Soft Support, Hard Support.",
  path: ["players"],
});

import { getApp } from "firebase/app";

export default function RegisterPage() {
    const { user, signInWithGoogle } = useAuth();
    const { t } = useTranslation();
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
                <CardHeader><CardTitle>{t("messages.loginRequired")}</CardTitle><CardDescription>{t("messages.loginRequiredDesc")}</CardDescription></CardHeader>
                <CardContent><Button onClick={signInWithGoogle}>{t("common.signInWithGoogle")}</Button></CardContent>
            </Card>
        );
    }

  return (
    <div className="space-y-8">
      <Card><CardHeader className="text-center"><UserPlus className="h-16 w-16 mx-auto text-primary" /><CardTitle className="text-4xl font-bold">{t("registration.teamRegistration")}</CardTitle></CardHeader></Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader><CardTitle>{t("registration.teamDetails")}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                    <FormField name="name" control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("registration.teamName")}
                          <span className="block text-sm font-semibold text-[#b86fc6] mt-1">(Musi być identyczna z nazwą drużyny w grze!)</span>
                        </FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField name="tag" control={form.control} render={({ field }) => (<FormItem><FormLabel>{t("registration.teamTag")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField name="discordUsername" control={form.control} render={({ field }) => (<FormItem><FormLabel>{t("registration.discordUsername")}</FormLabel><FormControl><Input {...field} placeholder="your_discord_name" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField name="motto" control={form.control} render={({ field }) => (<FormItem><FormLabel>{t("registration.teamMotto")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField
                    control={form.control}
                    name="logo"
                    render={() => (
                      <FormItem>
                        <FormLabel>{t("registration.teamLogo")}</FormLabel>
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
                                  Maks 5MB. JPG, PNG, WEBP. Zalecane: kwadratowe proporcje.
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
              <CardTitle>{t("registration.playerDetails")}</CardTitle>
              <div className={cn("p-3 mt-4 rounded-md text-center font-semibold", totalMMR > TEAM_MMR_CAP ? "text-destructive bg-destructive/10" : "text-primary bg-primary/10")}>
                Łączne MMR: {totalMMR.toLocaleString()} / {TEAM_MMR_CAP.toLocaleString()}
              </div>
              {form.formState.errors.players && <p className="text-sm font-medium text-destructive mt-2 text-center">{form.formState.errors.players.message}</p>}
            </CardHeader>
            <CardContent className="space-y-6">
                {fields.map((field, index) => (
                    <Card key={field.id} className="p-4">
                        <h4 className="font-bold text-lg text-center mb-4">Gracz {index + 1}</h4>
                        <div className="space-y-4 pt-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField name={`players.${index}.nickname`} control={form.control} render={({ field }) => (<FormItem><FormLabel>{t("players.nickname")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField name={`players.${index}.mmr`} control={form.control} render={({ field }) => (<FormItem><FormLabel>MMR</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField name={`players.${index}.steamProfileUrl`} control={form.control} render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>{t("registration.steamProfile")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField name={`players.${index}.role`} control={form.control} render={({ field }) => (<FormItem><FormLabel>{t("players.role")}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t("registration.selectRole")} /></SelectTrigger></FormControl><SelectContent>{PlayerRoles.map(role => (<SelectItem key={role} value={role}>{t(`players.roles.${role}`)}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                            <FormField
                                control={form.control}
                                name={`players.${index}.profileScreenshot`}
                                render={() => (
                                <FormItem>
                                    <FormLabel>{t("registration.uploadScreenshot")}</FormLabel>
                                    <FormControl>
                                    <Input type="file" accept="image/*" onChange={(e) => handleScreenshotChange(e, index)} />
                                    </FormControl>
                                    <FormMessage />
                                    {screenshotPreviews[index] && (
                                        <div className="mt-2 rounded-md border bg-muted p-2">
                                            <Image 
                                                src={screenshotPreviews[index]!} 
                                                alt={`Gracz ${index + 1} podgląd zrzutu ekranu`} 
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
                      <FormLabel>Zgadzam się z <Link href="/rules" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">regulaminem turnieju</Link>.</FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
              <Button type="submit" size="lg" className="w-full mt-6" disabled={isSubmitting || !isValid}>
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldPlus className="mr-2 h-5 w-5" />}
                {t("registration.submitRegistration")}
              </Button>
              {serverError && <p className="text-sm font-medium text-destructive mt-4 text-center">{serverError}</p>}
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
