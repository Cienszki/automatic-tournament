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
import { UserPlus, ShieldPlus, Image as ImageIcon, MessageCircle, Lock, Home, Users, Gamepad2, UserCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTournament } from "@/context/TournamentContext";
import { useTranslations } from "next-intl";
import { PlayerRoles } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

// PDL Registration Schema - No MMR requirements, optional coach
const pdlFormSchema = z.object({
  name: z.string()
    .min(3, "Nazwa zespołu musi mieć co najmniej 3 znaki.")
    .regex(/^[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż0-9 _\-&]+$/, "Nazwa zespołu może zawierać tylko litery (w tym polskie), cyfry, spacje, myślniki, podkreślenia i znak &."),
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
      .regex(/^[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż0-9 _\-&]+$/, "Nick może zawierać tylko litery (w tym polskie), cyfry, spacje, myślniki, podkreślenia i znak &."),
    role: z.enum(PlayerRoles),
    steamProfileUrl: z.string().url("Musi być prawidłowym URL profilu Steam."),
  })).min(5, "Musisz zarejestrować dokładnie 5 graczy.").max(5),
  coach: z.object({
    hasCoach: z.boolean(),
    nickname: z.string().optional(),
    steamProfileUrl: z.string().optional(),
  }),
  rulesAcknowledged: z.boolean().refine((val) => val === true, {
    message: "Musisz zaakceptować regulamin turnieju.",
  }),
}).refine(data => {
  const roles = data.players.map(player => player.role);
  const uniqueRoles = new Set(roles);
  return uniqueRoles.size === roles.length;
}, {
  message: "Każdy gracz musi mieć unikalną rolę. Nie można duplikować ról.",
  path: ["players"],
}).refine(data => {
  const roles = data.players.map(player => player.role);
  const playerRoles = new Set(roles);
  return PlayerRoles.every(role => playerRoles.has(role));
}, {
  message: "Musisz mieć gracza na każdej pozycji: Carry, Mid, Offlane, Soft Support, Hard Support.",
  path: ["players"],
}).refine(data => {
  // If coach is enabled, validate nickname and steam URL
  if (data.coach.hasCoach) {
    return data.coach.nickname && data.coach.nickname.length >= 2 && 
           data.coach.steamProfileUrl && data.coach.steamProfileUrl.startsWith('http');
  }
  return true;
}, {
  message: "Jeśli dodajesz trenera, musisz podać nick i link do profilu Steam.",
  path: ["coach"],
});

// Registration Closed Component
const RegistrationClosed: React.FC = () => {
  const t = useTranslations('pdlRegistration');
  const { getTournamentPath } = useTournament();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a1f] via-[#1e1e24] to-[#16161a] text-white">
      <div className="container mx-auto px-6 py-24">
        <div className="max-w-3xl mx-auto text-center">
          {/* Logo */}
          <motion.div 
            className="relative mb-8"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <div className="absolute inset-0 bg-[#8B1538] blur-2xl opacity-20 rounded-full"></div>
            <div className="relative">
              <Lock className="w-24 h-24 mx-auto text-[#8B1538] drop-shadow-[0_0_15px_rgba(139,21,56,0.7)]" />
            </div>
          </motion.div>

          {/* Main Title */}
          <motion.h1 
            className="text-5xl font-bold mb-6 text-transparent bg-gradient-to-r from-[#8B1538] to-[#d4d4d4] bg-clip-text"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {t('registrationClosed')}
          </motion.h1>

          {/* Description */}
          <motion.div 
            className="bg-black/30 backdrop-blur-sm rounded-xl p-8 mb-8 border border-[#8B1538]/20 shadow-[0_0_30px_rgba(139,21,56,0.1)]"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <p className="text-xl mb-4 text-gray-200">
              {t('closedMessage')}
            </p>
            <p className="text-lg text-[#d4d4d4] font-medium mb-4">
              {t('seasonInProgress')}
            </p>
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#8B1538]/20 to-[#d4d4d4]/20 border border-[#d4d4d4]/30 rounded-lg px-4 py-2">
              <Gamepad2 className="w-5 h-5 text-[#d4d4d4]" />
              <span className="text-[#d4d4d4] font-medium">{t('fantasyStillOpen')}</span>
            </div>
          </motion.div>

          {/* Navigation Buttons */}
          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Link href={getTournamentPath('/')}>
              <Button 
                variant="outline" 
                size="lg"
                className="bg-gradient-to-r from-[#8B1538]/20 to-[#d4d4d4]/20 border-[#8B1538] text-[#8B1538] hover:bg-[#8B1538]/10 hover:shadow-[0_0_20px_rgba(139,21,56,0.3)] transition-all duration-300"
              >
                <Home className="w-5 h-5 mr-2" />
                {t('backToHome')}
              </Button>
            </Link>
            <Link href={getTournamentPath('/teams')}>
              <Button 
                variant="outline" 
                size="lg"
                className="bg-gradient-to-r from-[#d4d4d4]/20 to-[#8B1538]/20 border-[#d4d4d4] text-[#d4d4d4] hover:bg-[#d4d4d4]/10 hover:shadow-[0_0_20px_rgba(212,212,212,0.3)] transition-all duration-300"
              >
                <Users className="w-5 h-5 mr-2" />
                {t('viewTeams')}
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default function RegisterPage() {
  const { user, signInWithGoogle } = useAuth();
  const { tournament, getTournamentPath } = useTournament();
  const t = useTranslations('pdlRegistration');
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const router = useRouter();

  // Check if registration is open
  const isRegistrationOpen = tournament?.status === 'registration';

  // Show registration closed page if not open
  if (!isRegistrationOpen) {
    return <RegistrationClosed />;
  }

  const form = useForm<z.infer<typeof pdlFormSchema>>({
    resolver: zodResolver(pdlFormSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      tag: "",
      discordUsername: "",
      motto: "",
      logo: null,
      players: Array(5).fill({ nickname: "", role: undefined, steamProfileUrl: "" }),
      coach: {
        hasCoach: false,
        nickname: "",
        steamProfileUrl: "",
      },
      rulesAcknowledged: false,
    },
  });

  const { fields } = useFieldArray({ control: form.control, name: "players" });
  const hasCoach = form.watch("coach.hasCoach");
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

  const onSubmit = async (values: z.infer<typeof pdlFormSchema>) => {
    if (!user) {
      setServerError("Musisz być zalogowany, aby zarejestrować drużynę.");
      return;
    }
    setServerError(null);
    
    try {
      // TODO: Implement PDL team registration
      console.log("PDL Team Registration:", values);
      // For now, just show success
      router.push(getTournamentPath('/my-team'));
    } catch (error) {
      setServerError((error as Error).message || "Wystąpił nieoczekiwany błąd podczas rejestracji.");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a1f] via-[#1e1e24] to-[#16161a] text-white flex items-center justify-center">
        <Card className="max-w-md w-full bg-[#1e1e24] border-[#2a2a32]">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">{t('loginRequired')}</CardTitle>
            <CardDescription className="text-[#808090]">{t('loginRequiredDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={signInWithGoogle} className="w-full bg-gradient-to-r from-[#8B1538] to-[#A91D45] hover:from-[#A91D45] hover:to-[#8B1538]">
              {t('signInWithGoogle')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a1f] via-[#1e1e24] to-[#16161a] py-12">
      <div className="container mx-auto px-4 max-w-5xl space-y-8">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="bg-gradient-to-br from-[#1e1e24] to-[#16161a] border-[#2a2a32]">
            <CardHeader className="text-center">
              <UserPlus className="h-16 w-16 mx-auto text-[#8B1538] mb-4" />
              <CardTitle className="text-4xl font-bold text-white">{t('teamRegistration')}</CardTitle>
              <CardDescription className="text-[#a0a0a0] text-lg mt-2">
                Polish Dota League - {t('seasonRegistration')}
              </CardDescription>
            </CardHeader>
          </Card>
        </motion.div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Team Details */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <Card className="bg-[#1e1e24] border-[#2a2a32]">
                <CardHeader>
                  <CardTitle className="text-white">{t('teamDetails')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField name="name" control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">
                          {t('teamName')}
                          <span className="block text-sm font-semibold text-[#8B1538] mt-1">
                            (Musi być identyczna z nazwą drużyny w grze!)
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-[#16161a] border-[#2a2a32] text-white" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField name="tag" control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">{t('teamTag')}</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-[#16161a] border-[#2a2a32] text-white" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField name="discordUsername" control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">{t('discordUsername')}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="your_discord_name" className="bg-[#16161a] border-[#2a2a32] text-white" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField name="motto" control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">{t('teamMotto')}</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-[#16161a] border-[#2a2a32] text-white" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField
                    control={form.control}
                    name="logo"
                    render={() => (
                      <FormItem>
                        <FormLabel className="text-white">{t('teamLogo')}</FormLabel>
                        <div className="flex items-center gap-6">
                          <div className="w-32 h-32 rounded-lg bg-[#16161a] flex items-center justify-center border border-[#2a2a32]">
                            {logoPreview ? 
                              <Image src={logoPreview} alt="Logo preview" width={128} height={128} className="object-cover rounded-lg"/> : 
                              <ImageIcon className="w-16 h-16 text-[#808090]"/>
                            }
                          </div>
                          <div className="flex-1">
                            <FormControl>
                              <Input type="file" accept="image/*" onChange={handleLogoChange} className="bg-[#16161a] border-[#2a2a32] text-white" />
                            </FormControl>
                            <FormDescription className="mt-2 text-[#808090]">
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
            </motion.div>

            {/* Players */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="bg-[#1e1e24] border-[#2a2a32]">
                <CardHeader>
                  <CardTitle className="text-white">{t('playerDetails')}</CardTitle>
                  <CardDescription className="text-[#808090]">
                    {t('playerDetailsDesc')}
                  </CardDescription>
                  {form.formState.errors.players && (
                    <p className="text-sm font-medium text-red-400 mt-2 text-center">
                      {form.formState.errors.players.message}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  {fields.map((field, index) => (
                    <Card key={field.id} className="p-4 bg-[#16161a] border-[#2a2a32]">
                      <h4 className="font-bold text-lg text-center mb-4 text-white">
                        Gracz {index + 1}
                      </h4>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField name={`players.${index}.nickname`} control={form.control} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white">{t('nickname')}</FormLabel>
                              <FormControl>
                                <Input {...field} className="bg-[#1e1e24] border-[#2a2a32] text-white" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField name={`players.${index}.role`} control={form.control} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white">{t('role')}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-[#1e1e24] border-[#2a2a32] text-white">
                                    <SelectValue placeholder={t('selectRole')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-[#1e1e24] border-[#2a2a32]">
                                  {PlayerRoles.map(role => (
                                    <SelectItem key={role} value={role} className="text-white hover:bg-[#2a2a32]">
                                      {t(`roles.${role}`)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField name={`players.${index}.steamProfileUrl`} control={form.control} render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel className="text-white">{t('steamProfile')}</FormLabel>
                              <FormControl>
                                <Input {...field} className="bg-[#1e1e24] border-[#2a2a32] text-white" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                      </div>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            {/* Coach (Optional) */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Card className="bg-[#1e1e24] border-[#2a2a32]">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    {t('coach')} ({t('optional')})
                  </CardTitle>
                  <CardDescription className="text-[#808090]">
                    {t('coachDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="coach.hasCoach"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-white">{t('addCoach')}</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  {hasCoach && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField name="coach.nickname" control={form.control} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">{t('coachNickname')}</FormLabel>
                            <FormControl>
                              <Input {...field} className="bg-[#16161a] border-[#2a2a32] text-white" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField name="coach.steamProfileUrl" control={form.control} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">{t('coachSteamProfile')}</FormLabel>
                            <FormControl>
                              <Input {...field} className="bg-[#16161a] border-[#2a2a32] text-white" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Rules & Submit */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Card className="bg-[#1e1e24] border-[#2a2a32]">
                <CardContent className="pt-6">
                  <FormField
                    control={form.control}
                    name="rulesAcknowledged"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-[#2a2a32] p-4">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-white">
                            Zgadzam się z <Link href={getTournamentPath('/rules')} target="_blank" rel="noopener noreferrer" className="text-[#8B1538] hover:underline">regulaminem turnieju</Link>.
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="w-full mt-6 bg-gradient-to-r from-[#8B1538] to-[#A91D45] hover:from-[#A91D45] hover:to-[#8B1538] text-white font-bold text-lg"
                    disabled={isSubmitting || !isValid}
                  >
                    {isSubmitting ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    ) : (
                      <ShieldPlus className="mr-2 h-5 w-5" />
                    )}
                    {t('submitRegistration')}
                  </Button>
                  {serverError && (
                    <p className="text-sm font-medium text-red-400 mt-4 text-center">{serverError}</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </form>
        </Form>
      </div>
    </div>
  );
}
