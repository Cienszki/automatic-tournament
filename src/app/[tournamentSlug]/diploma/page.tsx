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
import { PrintableDiploma, type DiplomaOrientation } from "@/components/diploma/PrintableDiploma";
import { organizationConfig } from "@/config/organization";
import type { DivisionConfig } from "@/types/tournament";

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
  const [orientation, setOrientation] = useState<DiplomaOrientation>("landscape");
  // Diplomas are often printed long after the tournament and players change nicknames:
  // the name on the diploma can differ from the roster (null = use the roster nickname).
  const [playerNameOverride, setPlayerNameOverride] = useState<string | null>(null);
  const [organizerName, setOrganizerName] = useState<string>(organizationConfig.displayName);
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
                setPlayerNameOverride(null);
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
                onValueChange={(v) => {
                  setSelectedPlayerId(v);
                  setPlayerNameOverride(null);
                }}
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

          {/* Name printed on the diploma (editable — nicknames change) */}
          {selectedPlayer && (
            <div className="space-y-1.5">
              <Label className="text-xs tracking-widest uppercase text-white/50">
                Nick na dyplomie{" "}
                <span className="normal-case tracking-normal text-white/30 font-normal">
                  — zmień, jeśli gracz używa już innego nicku
                </span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={playerNameOverride ?? selectedPlayer.nickname}
                  onChange={(e) => setPlayerNameOverride(e.target.value)}
                  placeholder={selectedPlayer.nickname}
                />
                {playerNameOverride !== null && playerNameOverride !== selectedPlayer.nickname && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="shrink-0 text-xs text-white/50"
                    onClick={() => setPlayerNameOverride(null)}
                    title={`Przywróć „${selectedPlayer.nickname}”`}
                  >
                    Przywróć
                  </Button>
                )}
              </div>
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

          {/* Organizer name in the footer (next to the organizer logo) */}
          <div className="space-y-1.5">
            <Label className="text-xs tracking-widest uppercase text-white/50">
              Organizator{" "}
              <span className="normal-case tracking-normal text-white/30 font-normal">
                — w stopce, obok logo organizatora (puste = samo logo)
              </span>
            </Label>
            <Input value={organizerName} onChange={(e) => setOrganizerName(e.target.value)} />
          </div>

          {/* Orientation */}
          <div className="space-y-1.5">
            <Label className="text-xs tracking-widest uppercase text-white/50">Orientacja (A4)</Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["landscape", "Pozioma"],
                ["portrait", "Pionowa"],
              ] as const).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant="outline"
                  onClick={() => setOrientation(value)}
                  aria-pressed={orientation === value}
                  className="rounded-none"
                  style={orientation === value
                    ? { borderColor: theme.primaryColor, backgroundColor: `color-mix(in srgb, ${theme.primaryColor} 20%, transparent)` }
                    : undefined}
                >
                  {label}
                </Button>
              ))}
            </div>
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
            disabled={!selectedPlayer || (playerNameOverride !== null && !playerNameOverride.trim())}
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
      <div className="pb-12">
        <PrintableDiploma
          theme={theme}
          tournamentName={tournamentName}
          playerName={selectedPlayer ? (playerNameOverride ?? selectedPlayer.nickname) : "Imię Gracza"}
          teamName={selectedTeam?.name ?? "Nazwa Drużyny"}
          place={effectivePlace}
          isCustomPlace={isCustom}
          date={date}
          organizerName={organizerName}
          organizerLogoUrl={theme?.organizerLogoUrl ?? null}
          division={selectedDivision}
          isPlaceholder={!selectedPlayer}
          orientation={orientation}
        />
      </div>
    </>
  );
}
