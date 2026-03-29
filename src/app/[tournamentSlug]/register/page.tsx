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
import { useTournament, useTournamentType } from "@/context/TournamentContext";
import { useTranslations } from "next-intl";
import { PlayerRoles } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

// PDL Registration Schema - Factory function accepting translations
function createPdlFormSchema(v: (key: string) => string) {
  return z.object({
    name: z.string()
      .min(3, v('teamNameMin'))
      .max(20, v('teamNameMax'))
      .regex(/^[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż0-9 _\-&]+$/, v('teamNameFormat')),
    tag: z.string().min(2, v('tagLength')).max(6, v('tagLength')),
    discordUsername: z.string().min(2, v('discordRequired')),
    motto: z.string().min(5, v('mottoMin')),
    logo: z.custom<File | null>(
      (file) => file instanceof File, v('logoRequired')
    ).refine(
      (file) => !!file && file.size <= MAX_FILE_SIZE, v('logoMaxSize')
    ).refine(
      (file) => !!file && ACCEPTED_IMAGE_TYPES.includes(file.type),
      v('logoFormat')
    ),
    players: z.array(z.object({
      nickname: z.string()
        .min(2, v('nicknameMin'))
        .max(20, v('nicknameMax'))
        .regex(/^[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż0-9 _\-&]+$/, v('nicknameFormat')),
      role: z.enum(PlayerRoles),
      steamProfileUrl: z.string().url(v('steamUrl')),
    })).min(5, v('playersCount')).max(5),
    rulesAcknowledged: z.boolean().refine((val) => val === true, {
      message: v('rulesRequired'),
    }),
  }).refine(data => {
    const roles = data.players.map(player => player.role);
    const uniqueRoles = new Set(roles);
    return uniqueRoles.size === roles.length;
  }, {
    message: v('uniqueRoles'),
    path: ["players"],
  }).refine(data => {
    const roles = data.players.map(player => player.role);
    const playerRoles = new Set(roles);
    return PlayerRoles.every(role => playerRoles.has(role));
  }, {
    message: v('allRoles'),
    path: ["players"],
  });
}

// MMR Tournament Registration Schema — adds per-player MMR + screenshot
function createMmrFormSchema(v: (key: string) => string, mmrCap: number) {
  return z.object({
    name: z.string()
      .min(3, v('teamNameMin'))
      .max(20, v('teamNameMax'))
      .regex(/^[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż0-9 _\-&]+$/, v('teamNameFormat')),
    tag: z.string().min(2, v('tagLength')).max(6, v('tagLength')),
    discordUsername: z.string().min(2, v('discordRequired')),
    motto: z.string().min(5, v('mottoMin')),
    logo: z.custom<File | null>(
      (file) => file instanceof File, v('logoRequired')
    ).refine(
      (file) => !!file && file.size <= MAX_FILE_SIZE, v('logoMaxSize')
    ).refine(
      (file) => !!file && ACCEPTED_IMAGE_TYPES.includes(file.type),
      v('logoFormat')
    ),
    players: z.array(z.object({
      nickname: z.string()
        .min(2, v('nicknameMin'))
        .max(20, v('nicknameMax'))
        .regex(/^[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż0-9 _\-&]+$/, v('nicknameFormat')),
      role: z.enum(PlayerRoles),
      steamProfileUrl: z.string().url(v('steamUrl')),
      mmr: z.coerce.number().int().min(0, 'MMR musi być >= 0').max(15000, 'Maksymalny MMR to 15000'),
      profileScreenshot: z.custom<File | null>(
        (file) => file instanceof File, 'Screenshot MMR jest wymagany'
      ).refine(
        (file) => !!file && file.size <= MAX_FILE_SIZE, 'Maksymalny rozmiar pliku to 5MB'
      ).refine(
        (file) => !!file && ACCEPTED_IMAGE_TYPES.includes(file.type), 'Dozwolone formaty: JPG, PNG, WEBP'
      ),
    })).min(5, v('playersCount')).max(5),
    rulesAcknowledged: z.boolean().refine((val) => val === true, {
      message: v('rulesRequired'),
    }),
  }).refine(data => {
    const roles = data.players.map(player => player.role);
    const uniqueRoles = new Set(roles);
    return uniqueRoles.size === roles.length;
  }, {
    message: v('uniqueRoles'),
    path: ["players"],
  }).refine(data => {
    const roles = data.players.map(player => player.role);
    const playerRoles = new Set(roles);
    return PlayerRoles.every(role => playerRoles.has(role));
  }, {
    message: v('allRoles'),
    path: ["players"],
  }).refine(data => {
    const totalMmr = data.players.reduce((sum, p) => sum + (p.mmr || 0), 0);
    return totalMmr <= mmrCap;
  }, {
    message: `Łączny MMR drużyny nie może przekraczać ${mmrCap}`,
    path: ["players"],
  });
}

// Registration Closed Component
const RegistrationClosed: React.FC = () => {
  const t = useTranslations('pdlRegistration');
  const { getTournamentPath, theme } = useTournament();
  const primaryColor = theme?.primaryColor || '#8B1538';

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-60"
          style={{ background: 'radial-gradient(circle at center, transparent 0%, #000000 100%)' }}
        />
        <div
          className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full opacity-[0.06] blur-[150px]"
          style={{ background: primaryColor }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-6 py-24">
        <div className="max-w-3xl mx-auto text-center">
          {/* Icon */}
          <motion.div
            className="relative mb-8"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <div
              className="absolute inset-0 blur-2xl opacity-20 rounded-full"
              style={{ background: primaryColor }}
            />
            <div className="relative">
              <Lock
                className="w-24 h-24 mx-auto"
                style={{ color: primaryColor, filter: `drop-shadow(0 0 15px ${primaryColor}B0)` }}
              />
            </div>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            className="text-5xl font-logik-wide-black mb-6 text-transparent bg-clip-text"
            style={{ backgroundImage: `linear-gradient(to right, ${primaryColor}, #d4d4d4)` }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {t('registrationClosed')}
          </motion.h1>

          {/* Description */}
          <motion.div
            className="bg-black/30 backdrop-blur-sm rounded-xl p-8 mb-8"
            style={{ border: `1px solid ${primaryColor}30`, boxShadow: `0 0 30px ${primaryColor}18` }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <p className="text-xl mb-4 text-gray-200">
              {t('closedMessage')}
            </p>
            <p className="text-lg text-white/70 font-medium mb-4">
              {t('seasonInProgress')}
            </p>
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
                className="transition-all duration-300"
                style={{
                  background: `linear-gradient(to right, ${primaryColor}33, #d4d4d430)`,
                  borderColor: primaryColor,
                  color: primaryColor,
                }}
              >
                <Home className="w-5 h-5 mr-2" />
                {t('backToHome')}
              </Button>
            </Link>
            <Link href={getTournamentPath('/teams')}>
              <Button
                variant="outline"
                size="lg"
                className="border-white/30 text-white/80 hover:bg-white/10 transition-all duration-300"
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

// MMR Summary component for MMR-limited tournaments
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MmrSummary({ form, mmrCap }: { form: { watch: (name: string) => any }; mmrCap: number }) {
  const players = form.watch('players') as Array<{ mmr?: number }> | undefined;
  const totalMmr = (players || []).reduce((sum: number, p: { mmr?: number }) => sum + (Number(p?.mmr) || 0), 0);
  const isOverCap = totalMmr > mmrCap;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.3 }}
    >
      <div className={cn(
        "p-4 rounded-xl border text-center",
        isOverCap
          ? "border-red-500/30 bg-red-500/10"
          : "border-green-500/30 bg-green-500/10"
      )}>
        <p className="font-logik-extended-bold text-lg">
          Łączny MMR: <span className={isOverCap ? "text-red-400" : "text-green-400"}>
            {totalMmr.toLocaleString()}
          </span>
          {' / '}
          <span className="text-white/60">{mmrCap.toLocaleString()}</span>
        </p>
        {isOverCap && (
          <p className="text-red-400 text-sm mt-1">
            Przekroczono limit MMR o {(totalMmr - mmrCap).toLocaleString()} punktów
          </p>
        )}
      </div>
    </motion.div>
  );
}

export default function RegisterPage() {
  const { user, signInWithGoogle } = useAuth();
  const { tournament, getTournamentPath } = useTournament();
  const { isMmrLimited } = useTournamentType();
  const t = useTranslations('pdlRegistration');
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [checkingTeam, setCheckingTeam] = React.useState(true);
  const router = useRouter();

  // Create schema with i18n validation messages — picks the right schema based on tournament type
  const mmrCap = tournament?.mmrCap || 24000;
  const pdlFormSchema = React.useMemo(
    () => isMmrLimited
      ? createMmrFormSchema((key: string) => t(`validation.${key}` as Parameters<typeof t>[0]), mmrCap)
      : createPdlFormSchema((key: string) => t(`validation.${key}` as Parameters<typeof t>[0])),
    [t, isMmrLimited, mmrCap]
  );
  type PdlFormValues = z.infer<typeof pdlFormSchema>;

  // Initialize form hooks BEFORE any early returns (Rules of Hooks)
  const form = useForm<PdlFormValues>({
    resolver: zodResolver(pdlFormSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      tag: "",
      discordUsername: "",
      motto: "",
      logo: null,
      players: Array(5).fill(
        isMmrLimited
          ? { nickname: "", role: undefined, steamProfileUrl: "", mmr: 0, profileScreenshot: null }
          : { nickname: "", role: undefined, steamProfileUrl: "" }
      ),
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
  const primaryColor = tournament?.theme?.primaryColor || '#8B1538';

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

  const onSubmit = async (values: PdlFormValues) => {
    if (!user) {
      setServerError("Musisz być zalogowany, aby zarejestrować drużynę.");
      return;
    }
    setServerError(null);

    try {
      // Upload team logo first
      const { uploadTeamLogo, uploadScreenshot } = await import('@/lib/storage');
      const logoUrl = await uploadTeamLogo(values.logo!, values.name);

      // For MMR tournaments, upload profile screenshots and attach MMR values
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let playersData: any = values.players;
      if (isMmrLimited) {
        const mmrPlayers = values.players as Array<{
          nickname: string;
          role: string;
          steamProfileUrl: string;
          mmr: number;
          profileScreenshot: File | null;
        }>;
        playersData = await Promise.all(
          mmrPlayers.map(async (player) => {
            let profileScreenshotUrl: string | undefined;
            if (player.profileScreenshot) {
              profileScreenshotUrl = await uploadScreenshot(
                player.profileScreenshot,
                `${values.name}-${player.nickname}`
              );
            }
            return {
              nickname: player.nickname,
              role: player.role,
              steamProfileUrl: player.steamProfileUrl,
              mmr: player.mmr,
              ...(profileScreenshotUrl ? { profileScreenshotUrl } : {}),
            };
          })
        );
      }

      // Prepare registration data
      const registrationData = {
        tournamentId: tournament?.id || 'pdl-s1',
        name: values.name,
        tag: values.tag,
        discordUsername: values.discordUsername,
        motto: values.motto,
        logoUrl,
        captainId: user.uid,
        players: playersData,
        ...(isMmrLimited ? { mmrCap } : {}),
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
              <Button onClick={signInWithGoogle} className="w-full text-white font-bold py-6 text-lg transition-all duration-300" style={{ backgroundColor: tournament?.theme?.primaryColor || '#8B1538', boxShadow: `0 0 20px ${tournament?.theme?.primaryColor || '#8B1538'}4D` }}>
              {t('signInWithGoogle')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden font-logik text-white selection:bg-primary/30 py-12"
      style={{ '--reg-primary': primaryColor } as React.CSSProperties}
    >
      <Background />
      <div className="relative z-10 container mx-auto px-4 max-w-5xl space-y-12">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-4"
        >
          <UserPlus
            className="h-16 w-16 mx-auto mb-4"
            style={{ color: tournament?.theme?.primaryColor || '#8B1538', filter: `drop-shadow(0 0 15px ${tournament?.theme?.primaryColor || '#8B1538'}80)` }}
          />
          <h1 className="text-4xl md:text-6xl font-logik-extended-bold text-white tracking-tight drop-shadow-lg">
            {t('teamRegistration')}
          </h1>
          <p className="text-white/60 text-lg md:text-xl font-medium max-w-2xl mx-auto">
            {tournament?.name} — {t('seasonRegistration')}
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
                <div className="h-0.5 w-12" style={{ background: `${tournament?.theme?.primaryColor || '#8B1538'}80` }} />
                <h2 className="text-2xl font-logik-extended-bold text-white/90">{t('teamDetails')}</h2>
                <div className="h-0.5 flex-1" style={{ background: `${tournament?.theme?.primaryColor || '#8B1538'}33` }} />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <FormField name="name" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/80 font-bold ml-1">
                      {t('teamName')}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-black/30 backdrop-blur-md border-white/10 text-white placeholder:text-white/20 focus:bg-black/50 transition-all duration-300 h-12" style={{ '--tw-ring-color': 'transparent' } as React.CSSProperties} />
                    </FormControl>
                    <FormDescription className="text-xs font-semibold mt-1 ml-1 opacity-80" style={{ color: tournament?.theme?.primaryColor || '#8B1538' }}>
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
                            <Input type="file" accept="image/*" onChange={handleLogoChange} className="bg-transparent border-white/10 file:bg-[var(--reg-primary)] file:text-white file:border-0 file:rounded-md file:px-4 file:py-1.5 file:mr-4 file:font-semibold text-white/80 cursor-pointer h-10" />
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
                <div className="h-0.5 w-12" style={{ background: `${primaryColor}80` }} />
                <h2 className="text-2xl font-logik-extended-bold text-white/90">{t('playerDetails')}</h2>
                <div className="h-0.5 flex-1" style={{ background: `${primaryColor}33` }} />
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
                      <span style={{ color: primaryColor }}>#{index + 1}</span> Gracz
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField name={`players.${index}.nickname`} control={form.control} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white/70">{t('nickname')}</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-black/40 border-white/10 text-white focus:border-[var(--reg-primary)] transition-all" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField name={`players.${index}.role`} control={form.control} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white/70">{t('role')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-black/40 border-white/10 text-white focus:border-[var(--reg-primary)] transition-all">
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
                            <Input {...field} className="bg-black/40 border-white/10 text-white focus:border-[var(--reg-primary)] transition-all" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      {/* MMR fields — only for MMR-limited tournaments */}
                      {isMmrLimited && (
                        <>
                          <FormField name={`players.${index}.mmr`} control={form.control} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white/70">MMR</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  min={0}
                                  max={15000}
                                  className="bg-black/40 border-white/10 text-white focus:border-[var(--reg-primary)] transition-all"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField name={`players.${index}.profileScreenshot`} control={form.control} render={() => (
                            <FormItem>
                              <FormLabel className="text-white/70">Screenshot MMR</FormLabel>
                              <FormControl>
                                <Input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    form.setValue(`players.${index}.profileScreenshot` as `players.${number}.profileScreenshot`, file, { shouldValidate: true });
                                  }}
                                  className="bg-transparent border-white/10 file:bg-[var(--reg-primary)] file:text-white file:border-0 file:rounded-md file:px-3 file:py-1 file:mr-3 file:font-semibold text-white/80 cursor-pointer"
                                />
                              </FormControl>
                              <FormDescription className="text-white/40 text-xs">
                                Screenshot profilu z widocznym MMR (maks 5MB)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* MMR Summary (MMR tournaments only) */}
            {isMmrLimited && (
              <MmrSummary form={form} mmrCap={mmrCap} />
            )}

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
                          className="border-white/20 data-[state=checked]:bg-[var(--reg-primary)] data-[state=checked]:border-[var(--reg-primary)]"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-white/90">
                          Zgadzam się z <Link href={getTournamentPath('/rules')} target="_blank" rel="noopener noreferrer" className="hover:underline font-bold transition-colors" style={{ color: primaryColor }}>regulaminem turnieju</Link>.
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-14 text-white font-logik-extended-bold text-lg transition-all duration-300"
                  style={{ backgroundColor: primaryColor, boxShadow: `0 0 20px ${primaryColor}33` }}
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
