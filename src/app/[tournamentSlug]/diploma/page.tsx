"use client";

import { useEffect, useState } from "react";
import { useTournament, useTournamentType } from "@/context/TournamentContext";
import { useAuth } from "@/context/AuthContext";
import { checkIfAdmin } from "@/lib/auth";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAllTeams } from "@/lib/firestore";
import { Shield, Printer, Trophy, LogIn } from "lucide-react";
import Image from "next/image";
import { organizationConfig } from "@/config/organization";
import type { TournamentTheme, DivisionConfig } from "@/types/tournament";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayerOption {
  id: string;
  nickname: string;
}

interface TeamOption {
  id: string;
  name: string;
  players: PlayerOption[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Genitive forms used inside "za zajęcie X. Miejsca"
const PLACE_OPTIONS = [
  { value: "I. Miejsca", label: "🥇 1. miejsce" },
  { value: "II. Miejsca", label: "🥈 2. miejsce" },
  { value: "III. Miejsca", label: "🥉 3. miejsce" },
  { value: "IV. Miejsca", label: "4. miejsce" },
  { value: "V. Miejsca", label: "5. miejsce" },
  { value: "VI. Miejsca", label: "6. miejsce" },
  { value: "VII. Miejsca", label: "7. miejsce" },
  { value: "VIII. Miejsca", label: "8. miejsce" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DiplomaPage() {
  const { tournament, theme, isLegacyTournament } = useTournament();
  const { isLeague } = useTournamentType();
  const { user, signInWithGoogle } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [selectedPlace, setSelectedPlace] = useState<string>("I. Miejsca");
  const [customTitle, setCustomTitle] = useState<string>("");
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>("");
  const [date, setDate] = useState<string>(
    new Date().toLocaleDateString("pl-PL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  );

  // Admin check
  useEffect(() => {
    async function verify() {
      if (user && tournament?.id) {
        const adminStatus = await checkIfAdmin(user, tournament.id);
        setIsAdmin(adminStatus);
      }
      setIsLoading(false);
    }
    verify();
  }, [user, tournament?.id]);

  // Load teams + players
  useEffect(() => {
    async function loadTeams() {
      if (!tournament?.id) return;

      try {
        let loaded: TeamOption[] = [];

        if (isLegacyTournament) {
          // Legacy Letnia structure
          const legacyTeams = await getAllTeams();
          loaded = legacyTeams.map((t) => ({
            id: t.id,
            name: t.name || t.id,
            players: (t.players ?? []).map((p) => ({
              id: p.id || p.steamId || String(p.steamId32 ?? ""),
              nickname: p.nickname || p.id,
            })),
          }));
        } else {
          // New multi-tournament structure
          const teamsRef = collection(db, "tournaments", tournament.id, "teams");
          const snap = await getDocs(teamsRef);

          for (const teamDoc of snap.docs) {
            const data = teamDoc.data();
            const players: PlayerOption[] = [];

            // Prefer the embedded roster map (new architecture)
            const roster = data.roster as
              | Record<string, { nickname: string }>
              | undefined;

            if (roster && Object.keys(roster).length > 0) {
              Object.entries(roster).forEach(([id, info]) => {
                players.push({ id, nickname: info.nickname || id });
              });
            } else {
              // Fallback: players subcollection
              const playersRef = collection(
                db,
                "tournaments",
                tournament.id,
                "teams",
                teamDoc.id,
                "players"
              );
              const playersSnap = await getDocs(playersRef);
              playersSnap.docs.forEach((pDoc) => {
                const pData = pDoc.data();
                players.push({
                  id: pDoc.id,
                  nickname: pData.nickname || pDoc.id,
                });
              });
            }

            loaded.push({
              id: teamDoc.id,
              name: data.name || teamDoc.id,
              players,
            });
          }
        }

        setTeams(loaded.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error("Failed to load teams for diploma:", err);
      }
    }

    loadTeams();
  }, [tournament?.id, isLegacyTournament]);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const selectedPlayer = selectedTeam?.players.find(
    (p) => p.id === selectedPlayerId
  );

  if (isLoading) return <LoadingScreen />;

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: `${theme.primaryColor}20` }}
          >
            <Shield className="h-8 w-8" style={{ color: theme.primaryColor }} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Wymagane logowanie</h2>
          <p className="text-muted-foreground mb-6">
            Ta strona jest dostępna tylko dla administratorów.
          </p>
          <Button
            onClick={signInWithGoogle}
            className="w-full"
            style={{ backgroundColor: theme.primaryColor }}
          >
            <LogIn className="mr-2 h-4 w-4" /> Zaloguj się
          </Button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
          >
            <Shield className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Brak dostępu</h2>
          <p className="text-muted-foreground">
            Nie masz uprawnień administratora dla tego turnieju.
          </p>
        </div>
      </div>
    );
  }

  const isCustom = customTitle.trim().length > 0;
  const effectivePlace = customTitle.trim() || selectedPlace;
  const tournamentName = tournament?.name ?? "";

  const divisions: DivisionConfig[] = tournament?.divisions ?? [];
  const selectedDivision = divisions.find((d) => d.id === selectedDivisionId) ?? null;

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Print styles                                                         */}
      {/* ------------------------------------------------------------------ */}
      <style>{`
        @media print {
          /* Hide everything except the diploma */
          body > * { visibility: hidden !important; }
          .diploma-print-root { visibility: visible !important; }
          .diploma-print-root * { visibility: visible !important; }
          .diploma-controls { display: none !important; }

          /* Make the diploma fill the printed page */
          .diploma-print-root {
            position: fixed !important;
            inset: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .diploma-card {
            width: 100vw !important;
            min-height: 100vh !important;
            max-width: none !important;
            border-radius: 0 !important;
          }

          @page {
            margin: 0;
            size: A4 landscape;
          }
        }
      `}</style>

      {/* ------------------------------------------------------------------ */}
      {/* Admin controls (hidden on print)                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="diploma-controls max-w-xl mx-auto mb-12 space-y-6">
        {/* Page title */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 flex items-center justify-center"
            style={{
              background: `${theme.primaryColor}20`,
              clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)",
            }}
          >
            <Trophy className="h-5 w-5" style={{ color: theme.primaryColor }} />
          </div>
          <div>
            <h1
              className="text-2xl uppercase tracking-widest font-bold"
              style={{
                fontFamily: theme.headerFont ? `var(${theme.headerFont})` : "inherit",
              }}
            >
              Generator Dyplomów
            </h1>
            <p className="text-sm text-white/40">
              Wybierz gracza i miejsce, a następnie wydrukuj dyplom
            </p>
          </div>
        </div>

        {/* Form card */}
        <div
          className="p-6 space-y-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {/* Place */}
          <div className="space-y-1.5">
            <Label className="text-xs tracking-widest uppercase text-white/50">Miejsce</Label>
            <Select value={selectedPlace} onValueChange={setSelectedPlace} disabled={isCustom}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLACE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom title */}
          <div className="space-y-1.5">
            <Label className="text-xs tracking-widest uppercase text-white/50">
              Niestandardowy tytuł{" "}
              <span className="normal-case tracking-normal text-white/30 font-normal">
                — nadpisuje miejsce (np. MVP, Najlepszy Support)
              </span>
            </Label>
            <Input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Zostaw puste, żeby użyć miejsca powyżej"
            />
          </div>

          {/* Team */}
          <div className="space-y-1.5">
            <Label className="text-xs tracking-widest uppercase text-white/50">Drużyna</Label>
            <Select
              value={selectedTeamId}
              onValueChange={(v) => {
                setSelectedTeamId(v);
                setSelectedPlayerId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz drużynę…" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Player (only when team is selected) */}
          {selectedTeam && (
            <div className="space-y-1.5">
              <Label className="text-xs tracking-widest uppercase text-white/50">Gracz</Label>
              <Select
                value={selectedPlayerId}
                onValueChange={setSelectedPlayerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz gracza…" />
                </SelectTrigger>
                <SelectContent>
                  {selectedTeam.players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nickname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Division (leagues only) */}
          {isLeague && divisions.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs tracking-widest uppercase text-white/50">Dywizja</Label>
              <Select value={selectedDivisionId} onValueChange={setSelectedDivisionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz dywizję… (opcjonalnie)" />
                </SelectTrigger>
                <SelectContent>
                  {divisions
                    .slice()
                    .sort((a, b) => a.tier - b.tier)
                    .map((div) => (
                      <SelectItem key={div.id} value={div.id}>
                        {div.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date */}
          <div className="space-y-1.5">
            <Label className="text-xs tracking-widest uppercase text-white/50">Data</Label>
            <Input value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {/* Print button */}
          <Button
            onClick={() => window.print()}
            className="w-full h-11 uppercase tracking-widest font-bold"
            style={{
              backgroundColor: selectedPlayer ? theme.primaryColor : undefined,
              clipPath: selectedPlayer
                ? "polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)"
                : undefined,
              borderRadius: 0,
            }}
            disabled={!selectedPlayer}
          >
            <Printer className="mr-2 h-4 w-4" />
            Drukuj dyplom
          </Button>

          {!selectedPlayer && (
            <p className="text-xs text-center text-muted-foreground">
              Wybierz drużynę i gracza, aby aktywować drukowanie.
            </p>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Diploma (used as preview + the printed output)                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="diploma-print-root flex items-center justify-center pb-12">
        <DiplomaCard
          theme={theme}
          tournamentName={tournamentName}
          playerName={selectedPlayer?.nickname ?? "Imię Gracza"}
          teamName={selectedTeam?.name ?? "Nazwa Drużyny"}
          place={effectivePlace}
          isCustomPlace={isCustom}
          date={date}
          organizerName={organizationConfig.displayName}
          organizerLogoUrl={theme?.organizerLogoUrl ?? null}
          division={selectedDivision}
          isPlaceholder={!selectedPlayer}
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// DiplomaCard
// ---------------------------------------------------------------------------

interface DiplomaCardProps {
  theme: TournamentTheme;
  tournamentName: string;
  playerName: string;
  teamName: string;
  /** "I. Miejsca" / "II. Miejsca" … or a custom freeform award title */
  place: string;
  /** True when place was typed in the custom field (no "za zajęcie" prefix) */
  isCustomPlace: boolean;
  date: string;
  organizerName: string;
  organizerLogoUrl?: string | null;
  division?: DivisionConfig | null;
  isPlaceholder?: boolean;
}

function DiplomaCard({
  theme,
  tournamentName,
  playerName,
  teamName,
  place,
  isCustomPlace,
  date,
  organizerName,
  organizerLogoUrl = null,
  division = null,
  isPlaceholder = false,
}: DiplomaCardProps) {
  const primary = theme.primaryColor || "#8B1538";
  const secondary = theme.secondaryColor || "#D4AF37";
  const bg = theme.backgroundColor || "#0a0a0f";
  const text = theme.textColor || "#ffffff";
  const headerFont = theme.headerFont ? `var(${theme.headerFont})` : "inherit";

  return (
    <div
      className="diploma-card relative w-full max-w-[960px] flex flex-col items-center overflow-hidden"
      style={{
        background: bg,
        color: text,
        outline: `1.5px solid ${secondary}50`,
        boxShadow: `0 0 0 6px ${bg}, 0 0 0 7.5px ${secondary}30, 0 40px 80px rgba(0,0,0,0.8)`,
        minHeight: "580px",
        fontFamily: theme.bodyFont ? `var(${theme.bodyFont})` : "inherit",
      }}
    >
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${secondary} 30%, ${primary} 50%, ${secondary} 70%, transparent 100%)`,
        }}
        aria-hidden="true"
      />

      {/* Corner ornaments */}
      <CornerOrnament position="top-left" primary={primary} secondary={secondary} />
      <CornerOrnament position="top-right" primary={primary} secondary={secondary} />
      <CornerOrnament position="bottom-left" primary={primary} secondary={secondary} />
      <CornerOrnament position="bottom-right" primary={primary} secondary={secondary} />

      {/* Subtle radial glow from top */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 40% at 50% -10%, ${primary}15 0%, transparent 70%)`,
        }}
        aria-hidden="true"
      />

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center w-full px-20 pt-12 pb-10 gap-5">

        {/* Logo */}
        {theme.logoUrl && (
          <Image
            src={theme.logoUrl}
            alt={tournamentName}
            width={220}
            height={220}
            className="object-contain mb-2"
            style={{ filter: "drop-shadow(0 0 24px rgba(255,255,255,0.15))" }}
            unoptimized
          />
        )}

        {/* ── DYPLOM ── */}
        <div className="text-center">
          <h1
            className="uppercase leading-none"
            style={{
              fontFamily: headerFont,
              fontSize: "clamp(2.8rem, 6vw, 4.5rem)",
              letterSpacing: "0.4em",
              color: secondary,
              textShadow: `0 0 40px ${secondary}60, 0 0 80px ${secondary}25`,
            }}
          >
            Dyplom
          </h1>

          {/* Diamond rule */}
          <div className="flex items-center justify-center gap-3 mt-3">
            <DiamondRule color={secondary} />
          </div>
        </div>

        {/* ── Player name ── */}
        <div
          className="text-center mt-1"
          style={{ opacity: isPlaceholder ? 0.3 : 1 }}
        >
          <p
            className="uppercase leading-none"
            style={{
              fontFamily: headerFont,
              fontSize: "clamp(2rem, 4.5vw, 3.2rem)",
              letterSpacing: "0.08em",
              color: text,
              textShadow: `0 0 30px ${text}20`,
            }}
          >
            {playerName}
          </p>
        </div>

        {/* ── Team ── */}
        <div
          className="text-center"
          style={{ opacity: isPlaceholder ? 0.3 : 1 }}
        >
          <p
            className="text-sm tracking-[0.25em] uppercase"
            style={{ color: `${text}50` }}
          >
            reprezentującego drużynę
          </p>
          <p
            className="mt-1 text-xl tracking-wide font-semibold"
            style={{
              color: primary,
              fontFamily: headerFont,
              textShadow: `0 0 20px ${primary}50`,
            }}
          >
            {teamName}
          </p>
        </div>

        {/* ── za zajęcie / place ── */}
        <div
          className="flex flex-col items-center gap-3 mt-1"
          style={{ opacity: isPlaceholder ? 0.3 : 1 }}
        >
          {!isCustomPlace && (
            <p
              className="text-sm tracking-[0.25em] uppercase"
              style={{ color: `${text}50` }}
            >
              za zajęcie
            </p>
          )}

          {/* Place badge — angular clip matching site CTAs */}
          <div
            className="px-12 py-3"
            style={{
              clipPath:
                "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)",
              background: `${secondary}12`,
              outline: `1.5px solid ${secondary}70`,
              boxShadow: `inset 0 0 30px ${secondary}08, 0 0 30px ${secondary}20`,
            }}
          >
            <span
              className="uppercase"
              style={{
                fontFamily: headerFont,
                fontSize: "clamp(1.4rem, 3vw, 2rem)",
                letterSpacing: "0.25em",
                color: secondary,
                textShadow: `0 0 20px ${secondary}80`,
              }}
            >
              {place}
            </span>
          </div>
        </div>

        {/* ── w turnieju ── */}
        <div className="text-center flex flex-col items-center gap-0.5">
          <p
            className="text-sm tracking-[0.25em] uppercase font-normal"
            style={{ color: `${text}50` }}
          >
            w
          </p>
          <p
            className="text-xl font-semibold tracking-wide"
            style={{ color: text }}
          >
            {tournamentName}
          </p>
        </div>

        {/* ── Division (league only) ── */}
        {division && (
          <div className="text-center -mt-2">
            <p
              className="text-lg font-semibold tracking-[0.2em] uppercase"
              style={{
                color: division.color || secondary,
                fontFamily: headerFont,
                textShadow: `0 0 20px ${division.color || secondary}60`,
              }}
            >
              Dywizja {division.name}
            </p>
          </div>
        )}

        {/* ── Footer ── */}
        <div
          className="w-full flex justify-between items-end mt-4 pt-6 text-xs tracking-wider uppercase"
          style={{
            borderTop: `1px solid ${secondary}20`,
            color: `${text}40`,
          }}
        >
          <span>{tournamentName}</span>
          <span>{date}</span>
          {organizerLogoUrl ? (
            <img
              src={organizerLogoUrl}
              alt={organizerName}
              style={{ height: '22px', objectFit: 'contain', opacity: 0.7 }}
            />
          ) : (
            <span style={{ color: `${secondary}80` }}>{organizerName}</span>
          )}
        </div>
      </div>

      {/* Bottom accent bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${secondary}40 50%, transparent 100%)`,
        }}
        aria-hidden="true"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiamondRule — decorative divider under DYPLOM
// ---------------------------------------------------------------------------

function DiamondRule({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-2" style={{ color }}>
      <div
        className="h-px w-24"
        style={{ background: `linear-gradient(to left, ${color}80, transparent)` }}
      />
      <span
        className="text-[10px] tracking-[0.3em] uppercase font-mono"
        style={{ color: `${color}90` }}
      >
        dla gracza
      </span>
      <div
        className="h-px w-24"
        style={{ background: `linear-gradient(to right, ${color}80, transparent)` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CornerOrnament — L-bracket with a primary-colored inner dot
// ---------------------------------------------------------------------------

function CornerOrnament({
  position,
  primary,
  secondary,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  primary: string;
  secondary: string;
}) {
  const isTop = position.startsWith("top");
  const isLeft = position.endsWith("left");

  const posClass =
    position === "top-left"
      ? "top-4 left-4"
      : position === "top-right"
      ? "top-4 right-4"
      : position === "bottom-left"
      ? "bottom-4 left-4"
      : "bottom-4 right-4";

  const d = isTop
    ? isLeft
      ? "M 22 2 L 2 2 L 2 22"
      : "M 6 2 L 26 2 L 26 22"
    : isLeft
    ? "M 22 26 L 2 26 L 2 6"
    : "M 6 26 L 26 26 L 26 6";

  const dotX = isLeft ? 22 : 6;
  const dotY = isTop ? 22 : 6;

  return (
    <div className={`absolute ${posClass}`} aria-hidden="true">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d={d} stroke={secondary} strokeWidth="1.5" />
        <circle cx={dotX} cy={dotY} r="1.5" fill={primary} />
      </svg>
    </div>
  );
}
