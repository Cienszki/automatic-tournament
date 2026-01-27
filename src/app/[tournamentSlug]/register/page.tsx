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
import { UserPlus, ShieldPlus, Image as ImageIcon, MessageCircle, Lock, Home, Users, Gamepad2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTournament } from "@/context/TournamentContext";
import { useTranslations } from "next-intl";
import { PlayerRoles } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

// PDL Registration Schema - No MMR requirements, optional coach
const pdlFormSchema = z.object({
  name: z.string()
    .min(3, "Nazwa zespołu musi mieć co najmniej 3 znaki.")
    .max(20, "Nazwa zespołu nie może przekroczyć 20 znaków.")
    .regex(/^[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż0-9 _\-&]+$/, "Nazwa zespołu może zawierać tylko litery (w tym polskie), cyfry, spacje, myślniki, podkreślenia i znak &."),
  tag: z.string().min(2, "Tag musi mieć 2-6 znaków.").max(6, "Tag musi mieć 2-6 znaków."),
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
      .max(20, "Nick nie może przekroczyć 20 znaków.")
      .regex(/^[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż0-9 _\-&]+$/, "Nick może zawierać tylko litery (w tym polskie), cyfry, spacje, myślniki, podkreślenia i znak &."),
    role: z.enum(PlayerRoles),
    steamProfileUrl: z.string().url("Musi być prawidłowym URL profilu Steam."),
  })).min(5, "Musisz zarejestrować dokładnie 5 graczy.").max(5),
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
  const [checkingTeam, setCheckingTeam] = React.useState(true);
  const router = useRouter();

  // Initialize form hooks BEFORE any early returns (Rules of Hooks)
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
      rulesAcknowledged: false,
    },
  });

  const { fields } = useFieldArray({ control: form.control, name: "players" });

  // Redirect to my-team if user already has a registered team
  React.useEffect(() => {
    const checkExistingTeam = async () => {
      if (!user?.uid || !tournament?.id) {
        setCheckingTeam(false);
        return;
      }

      try {
        const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
        const captainQuery = query(teamsRef, where('captainId', '==', user.uid));
        const snapshot = await getDocs(captainQuery);

        if (!snapshot.empty) {
          // User already has a team, redirect to my-team
          router.push(getTournamentPath('/my-team'));
        } else {
          // User doesn't have a team, stop loading
          setCheckingTeam(false);
        }
      } catch (err) {
        console.error('Error checking existing team:', err);
        setCheckingTeam(false);
      }
    };

    checkExistingTeam();
  }, [user?.uid, tournament?.id, router, getTournamentPath]);

  // Check if registration is open
  const isRegistrationOpen = tournament?.status === 'registration';

  // Show loading while checking if user has a team
  if (checkingTeam) {
    return null; // or a loading spinner
  }

  // Show registration closed page if not open
  if (!isRegistrationOpen) {
    return <RegistrationClosed />;
  }
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
      // Upload team logo first
      const { uploadTeamLogo } = await import('@/lib/storage');
      const logoUrl = await uploadTeamLogo(values.logo!, values.name);

      // Prepare registration data
      const registrationData = {
        tournamentId: tournament?.id || 'pdl-s1',
        name: values.name,
        tag: values.tag,
        discordUsername: values.discordUsername,
        motto: values.motto,
        logoUrl,
        captainId: user.uid,
        players: values.players,
      };

      // Get Firebase auth token for API security
      const token = await user.getIdToken();

      // Call registration API with authentication
      const response = await fetch('/api/register-pdl-team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(registrationData),
      });

      const result = await response.json();

      if (result.success) {
        // Success - redirect to my team page
        router.push(getTournamentPath('/my-team'));
      } else {
        // Show error message
        const errorMessage = result.errors
          ? result.errors.join('. ')
          : result.message;
        setServerError(errorMessage || 'Wystąpił błąd podczas rejestracji.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setServerError((error as Error).message || "Wystąpił nieoczekiwany błąd podczas rejestracji.");
    }
  };


  const Background = () => (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Vignette */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-80"
        style={{
          background: 'radial-gradient(circle at center, transparent 0%, #000000 100%)',
        }}
      />
      {/* Ambient glow */}
      <div
        className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full opacity-[0.03] blur-[150px]"
        style={{ background: tournament?.theme?.primaryColor || '#8B1538' }}
      />
      {/* Particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white/5"
          style={{
            width: Math.random() * 2 + 1 + 'px',
            height: Math.random() * 2 + 1 + 'px',
            left: Math.random() * 100 + '%',
            top: Math.random() * 100 + '%',
          }}
          animate={{
            y: [0, -100],
            opacity: [0, 0.3, 0],
          }}
          transition={{
            duration: 10 + Math.random() * 20,
            repeat: Infinity,
            ease: "linear",
            delay: Math.random() * 10,
          }}
        />
      ))}
    </div>
  );

  if (!user) {
    return (
      <div className="relative min-h-screen overflow-hidden font-logik text-white selection:bg-primary/30 flex items-center justify-center">
        <Background />
        <Card className="relative z-10 max-w-md w-full bg-black/40 backdrop-blur-xl border-white/10 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl text-white font-logik-extended-bold">{t('loginRequired')}</CardTitle>
            <CardDescription className="text-white/60 font-logik text-base">{t('loginRequiredDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={signInWithGoogle} className="w-full bg-[#8B1538] hover:bg-[#A91D45] text-white font-bold py-6 text-lg transition-all duration-300 shadow-[0_0_20px_rgba(139,21,56,0.3)] hover:shadow-[0_0_30px_rgba(139,21,56,0.5)]">
              {t('signInWithGoogle')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden font-logik text-white selection:bg-primary/30 py-12">
      <Background />
      <div className="relative z-10 container mx-auto px-4 max-w-5xl space-y-12">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-4"
        >
          <UserPlus className="h-16 w-16 mx-auto text-[#8B1538] mb-4 drop-shadow-[0_0_15px_rgba(139,21,56,0.5)]" />
          <h1 className="text-4xl md:text-6xl font-logik-extended-bold text-white tracking-tight drop-shadow-lg">
            {t('teamRegistration')}
          </h1>
          <p className="text-white/60 text-lg md:text-xl font-medium max-w-2xl mx-auto">
            Polish Dota League - {t('seasonRegistration')}
          </p>
        </motion.div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
            {/* Team Details */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div className="mb-6 flex items-center gap-4">
                <div className="h-0.5 w-12 bg-[#8B1538]/50" />
                <h2 className="text-2xl font-logik-extended-bold text-white/90">{t('teamDetails')}</h2>
                <div className="h-0.5 flex-1 bg-[#8B1538]/20" />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <FormField name="name" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/80 font-bold ml-1">
                      {t('teamName')}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-black/30 backdrop-blur-md border-white/10 text-white placeholder:text-white/20 focus:border-[#8B1538] focus:bg-black/50 transition-all duration-300 h-12" />
                    </FormControl>
                    <FormDescription className="text-[#8B1538] text-xs font-semibold mt-1 ml-1 opacity-80">
                      (Musi być identyczna z nazwą drużyny w grze!)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="tag" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/80 font-bold ml-1">{t('teamTag')}</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-black/30 backdrop-blur-md border-white/10 text-white placeholder:text-white/20 focus:border-[#8B1538] focus:bg-black/50 transition-all duration-300 h-12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="discordUsername" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/80 font-bold ml-1">{t('discordUsername')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="your_discord_name" className="bg-black/30 backdrop-blur-md border-white/10 text-white placeholder:text-white/20 focus:border-[#8B1538] focus:bg-black/50 transition-all duration-300 h-12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="motto" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/80 font-bold ml-1">{t('teamMotto')}</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-black/30 backdrop-blur-md border-white/10 text-white placeholder:text-white/20 focus:border-[#8B1538] focus:bg-black/50 transition-all duration-300 h-12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="mt-6">
                <FormField
                  control={form.control}
                  name="logo"
                  render={() => (
                    <FormItem>
                      <FormLabel className="text-white/80 font-bold ml-1">{t('teamLogo')}</FormLabel>
                      <div className="flex items-center gap-6 p-4 bg-black/20 backdrop-blur-sm rounded-xl border border-white/5">
                        <div className="w-32 h-32 rounded-lg bg-black/40 flex items-center justify-center border border-white/10 overflow-hidden shadow-inner">
                          {logoPreview ?
                            <Image src={logoPreview} alt="Logo preview" width={128} height={128} className="object-cover w-full h-full" /> :
                            <ImageIcon className="w-12 h-12 text-white/20" />
                          }
                        </div>
                        <div className="flex-1">
                          <FormControl>
                            <Input type="file" accept="image/*" onChange={handleLogoChange} className="bg-transparent border-white/10 file:bg-[#8B1538] file:text-white file:border-0 file:rounded-md file:px-4 file:py-1.5 file:mr-4 file:font-semibold hover:file:bg-[#A91D45] text-white/80 cursor-pointer h-10" />
                          </FormControl>
                          <FormDescription className="mt-2 text-white/40">
                            Maks 5MB. JPG, PNG, WEBP.
                          </FormDescription>
                          <FormMessage />
                        </div>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </motion.div>

            {/* Players */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="mb-6 flex items-center gap-4">
                <div className="h-0.5 w-12 bg-[#8B1538]/50" />
                <h2 className="text-2xl font-logik-extended-bold text-white/90">{t('playerDetails')}</h2>
                <div className="h-0.5 flex-1 bg-[#8B1538]/20" />
              </div>
              <p className="text-white/50 mb-6 font-logik ml-1">{t('playerDetailsDesc')}</p>

              {form.formState.errors.players && (
                <p className="text-sm font-medium text-red-400 mb-6 text-center bg-red-500/10 py-2 rounded border border-red-500/20">
                  {form.formState.errors.players.message}
                </p>
              )}

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-6 bg-black/30 backdrop-blur-md border border-white/5 rounded-xl hover:border-white/10 transition-all duration-300">
                    <h4 className="font-logik-extended-bold text-lg mb-4 text-white/80 flex items-center gap-2">
                      <span className="text-[#8B1538]">#{index + 1}</span> Gracz
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField name={`players.${index}.nickname`} control={form.control} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white/70">{t('nickname')}</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-black/40 border-white/10 text-white focus:border-[#8B1538] transition-all" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField name={`players.${index}.role`} control={form.control} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white/70">{t('role')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-black/40 border-white/10 text-white focus:border-[#8B1538] transition-all">
                                <SelectValue placeholder={t('selectRole')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-[#1e1e24] border-[#2a2a32] text-white">
                              {PlayerRoles.map(role => (
                                <SelectItem key={role} value={role} className="text-white hover:bg-[#2a2a32] focus:bg-[#2a2a32] cursor-pointer">
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
                          <FormLabel className="text-white/70">{t('steamProfile')}</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-black/40 border-white/10 text-white focus:border-[#8B1538] transition-all" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Rules & Submit */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="pb-20"
            >
              <div className="bg-black/30 backdrop-blur-md rounded-xl p-6 border border-white/5">
                <FormField
                  control={form.control}
                  name="rulesAcknowledged"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-4 rounded-lg bg-black/40 border border-white/5 mb-6">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="border-white/20 data-[state=checked]:bg-[#8B1538] data-[state=checked]:border-[#8B1538]"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-white/90">
                          Zgadzam się z <Link href={getTournamentPath('/rules')} target="_blank" rel="noopener noreferrer" className="text-[#8B1538] hover:text-[#A91D45] hover:underline font-bold transition-colors">regulaminem turnieju</Link>.
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-14 bg-[#8B1538] hover:bg-[#A91D45] text-white font-logik-extended-bold text-lg shadow-[0_0_20px_rgba(139,21,56,0.2)] hover:shadow-[0_0_40px_rgba(139,21,56,0.5)] transition-all duration-300"
                  disabled={isSubmitting || !isValid}
                >
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  ) : (
                    <ShieldPlus className="mr-3 h-5 w-5" />
                  )}
                  {t('submitRegistration')}
                </Button>
                {serverError && (
                  <p className="text-sm font-bold text-red-500 mt-4 text-center">{serverError}</p>
                )}
              </div>
            </motion.div>
          </form>
        </Form>
      </div>
    </div>
  );

}
