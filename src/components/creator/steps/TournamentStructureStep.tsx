// src/components/creator/steps/TournamentStructureStep.tsx
// Step 3: Tournament structure configuration

'use client';

import { useEffect, useState } from 'react';
import { Trophy, Settings, LayoutGrid, GitBranch } from 'lucide-react';
import { ChangeableLaterNote } from '@/components/creator/AdvancedSection';

interface TournamentStructureStepProps {
  data: any;
  onChange: (data: any) => void;
  template: string;
}

const MATCH_FORMAT_OPTIONS = [
  { value: 'bo1', label: 'BO1' },
  { value: 'bo2', label: 'BO2' },
  { value: 'bo3', label: 'BO3' },
  { value: 'bo5', label: 'BO5' },
];

export function TournamentStructureStep({ data, onChange, template }: TournamentStructureStepProps) {
  const [formData, setFormData] = useState({
    type: data?.type || (
      template === 'mmr-limited' ? 'mmr-limited'
      : template === 'league' ? 'league'
      : template === 'swiss' ? 'swiss'
      : 'mmr-limited'
    ),
    maxTeams: data?.maxTeams ?? null,
    mmrCap: data?.mmrCap || 24000,
    // Swiss settings
    swissMatchFormat: data?.swissMatchFormat || 'bo2',
    swissPlannedRounds: data?.swissPlannedRounds ?? null,
    enablePlayoffs: data?.enablePlayoffs ?? true,
    // Group stage settings (MMR tournaments)
    groupMatchFormat: data?.groupMatchFormat || 'bo2',
    // Playoff settings
    playoffFormat: data?.playoffFormat || 'double-elimination',
    playoffSemifinalFormat: data?.playoffSemifinalFormat || 'bo3',
    playoffFinalFormat: data?.playoffFinalFormat || 'bo3',
    playoffGrandFinalFormat: data?.playoffGrandFinalFormat || 'bo5',
    // Features
    enableFantasy: data?.enableFantasy || false,
    enablePickem: data?.enablePickem || false,
    enableStandins: data?.enableStandins ?? true,
  });

  useEffect(() => {
    onChange(formData);
  }, [formData, onChange]);

  const handleChange = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isMmrLimited = formData.type === 'mmr-limited';
  const isSwiss = formData.type === 'swiss';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Struktura Turnieju</h2>
        <p className="text-muted-foreground">
          Skonfiguruj format rozgrywek i dodatkowe funkcje
        </p>
      </div>

      <ChangeableLaterNote />

      {/* Plain-language explanation of the three formats. The choice drives the
          most behaviour of anything in the wizard, and "mmr-limited vs league vs
          swiss" means nothing to someone running their first tournament. */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm space-y-2">
        <p className="font-medium">Który format wybrać?</p>
        <ul className="space-y-1.5 text-muted-foreground text-xs">
          <li>
            <strong className="text-foreground">Limit MMR</strong> — drużyny mieszczą się we
            wspólnym limicie sumy MMR. Faza grupowa, potem playoff. Dobre, gdy chcesz
            wyrównać poziom z góry.
          </li>
          <li>
            <strong className="text-foreground">Liga profesjonalna</strong> — sezon z dywizjami,
            awansami i spadkami. Dobre dla cyklicznych rozgrywek.
          </li>
          <li>
            <strong className="text-foreground">Liga szwajcarska</strong> — bez limitu MMR.
            Po każdej rundzie drużyny o podobnym dorobku grają ze sobą, więc poziom wyrównuje
            się sam. Dobre, gdy zgłoszą się drużyny o bardzo różnym poziomie.
          </li>
        </ul>
      </div>

      {/* Tournament Format */}
      <div className="space-y-6 p-6 rounded-xl bg-card border border-border">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Format Turnieju
        </h3>

        <div>
          <label className="block text-sm font-medium mb-2">
            Typ Turnieju
          </label>
          <select
            value={formData.type}
            onChange={(e) => handleChange('type', e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
          >
            <option value="mmr-limited">Turniej z Limitem MMR</option>
            <option value="league">Liga Profesjonalna</option>
            <option value="swiss">Liga Szwajcarska</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Maksymalna Liczba Drużyn <span className="text-muted-foreground font-normal">(opcjonalne)</span>
          </label>
          <input
            type="number"
            value={formData.maxTeams ?? ''}
            onChange={(e) => handleChange('maxTeams', e.target.value ? parseInt(e.target.value) : null)}
            min={4}
            max={256}
            placeholder="Bez limitu"
            className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Zostaw puste, aby drużyny mogły rejestrować się bez górnego limitu. Możesz to zmienić później w panelu admina.
          </p>
        </div>

        {isMmrLimited && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Limit MMR Drużyny
            </label>
            <input
              type="number"
              value={formData.mmrCap}
              onChange={(e) => handleChange('mmrCap', parseInt(e.target.value))}
              min={0}
              step={1000}
              className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Suma MMR wszystkich graczy w drużynie (np. 24,000 dla 5 graczy)
            </p>
          </div>
        )}
      </div>

      {/* Group Stage Settings (MMR tournaments only) */}
      {isMmrLimited && (
        <div className="space-y-6 p-6 rounded-xl bg-card border border-border">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
            Faza Grupowa
          </h3>
          <p className="text-sm text-muted-foreground -mt-4">
            Grupy tworzone i przypisywane ręcznie w panelu admina po utworzeniu turnieju (tak jak dywizje w lidze).
          </p>

          <div>
            <label className="block text-sm font-medium mb-2">
              Format Meczy w Fazie Grupowej
            </label>
            <select
              value={formData.groupMatchFormat}
              onChange={(e) => handleChange('groupMatchFormat', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
            >
              {MATCH_FORMAT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Mecze w grupach rozgrywane każdy z każdym (round-robin)
            </p>
          </div>

          <p className="text-xs text-muted-foreground border border-border rounded-lg p-3 bg-muted/30">
            Liczba miejsc awansu do Upper Bracket, Lower Bracket i Wildcards ustawiana jest osobno dla każdej grupy w panelu admina podczas jej tworzenia.
          </p>
        </div>
      )}

      {/* Swiss Settings */}
      {isSwiss && (
        <div className="space-y-6 p-6 rounded-xl bg-card border border-border">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
            Ustawienia systemu szwajcarskiego
          </h3>
          <p className="text-sm text-muted-foreground -mt-4">
            Rundy generujesz pojedynczo w panelu admina — parowania kolejnej rundy zależą
            od wyników poprzedniej. Tutaj ustawiasz tylko wartości domyślne.
          </p>

          <div>
            <label className="block text-sm font-medium mb-2">
              Domyślny format meczów
            </label>
            <select
              value={formData.swissMatchFormat}
              onChange={(e) => handleChange('swissMatchFormat', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
            >
              {MATCH_FORMAT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {/* Points are games won, so the format decides a round's weight. */}
            <p className="text-xs text-muted-foreground mt-1">
              Punktem jest każda wygrana mapa, więc format decyduje o wadze rundy
              (BO1 = maks. 1 pkt, BO2/BO3 = 2 pkt, BO5 = 3 pkt). Format możesz zmienić
              dla każdej rundy osobno.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Planowana liczba rund <span className="text-muted-foreground font-normal">(opcjonalne)</span>
            </label>
            <input
              type="number"
              value={formData.swissPlannedRounds ?? ''}
              onChange={(e) => handleChange('swissPlannedRounds', e.target.value ? parseInt(e.target.value) : null)}
              min={1}
              max={20}
              placeholder="ustalisz po rejestracji"
              className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Zwykle ustala się ją dopiero, gdy znasz liczbę drużyn. Panel admina podpowie
              zalecaną wartość (ok. log₂ z liczby drużyn + 1).
            </p>
          </div>
        </div>
      )}

      {/* Playoff Settings */}
      <div className="space-y-6 p-6 rounded-xl bg-card border border-border">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-primary" />
          Playoff
        </h3>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.enablePlayoffs}
            onChange={(e) => handleChange('enablePlayoffs', e.target.checked)}
            className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
          />
          <div>
            <p className="font-medium">Turniej kończy się fazą playoff</p>
            <p className="text-sm text-muted-foreground">
              Odznacz, jeśli o zwycięzcy ma decydować sama tabela.
            </p>
          </div>
        </label>

        {formData.enablePlayoffs && (
        <>
        <div>
          <label className="block text-sm font-medium mb-2">
            Format Playoff
          </label>
          <select
            value={formData.playoffFormat}
            onChange={(e) => handleChange('playoffFormat', e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
          >
            <option value="single-elimination">Single Elimination</option>
            <option value="double-elimination">Double Elimination</option>
          </select>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Półfinały
            </label>
            <select
              value={formData.playoffSemifinalFormat}
              onChange={(e) => handleChange('playoffSemifinalFormat', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
            >
              {MATCH_FORMAT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Finał
            </label>
            <select
              value={formData.playoffFinalFormat}
              onChange={(e) => handleChange('playoffFinalFormat', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
            >
              {MATCH_FORMAT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Grand Final
            </label>
            <select
              value={formData.playoffGrandFinalFormat}
              onChange={(e) => handleChange('playoffGrandFinalFormat', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
            >
              {MATCH_FORMAT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {(isMmrLimited || isSwiss) && (
          <p className="text-xs text-muted-foreground">
            Przypisanie drużyn do slotów w playoff odbywa się ręcznie w panelu admina
            {isSwiss ? ' po zakończeniu ostatniej rundy.' : ' po zakończeniu fazy grupowej.'}
          </p>
        )}
        </>
        )}
      </div>

      {/* Features */}
      <div className="space-y-6 p-6 rounded-xl bg-card border border-border">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Dodatkowe Funkcje
        </h3>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.enableFantasy}
              onChange={(e) => handleChange('enableFantasy', e.target.checked)}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
            />
            <div>
              <p className="font-medium">Fantasy League</p>
              <p className="text-sm text-muted-foreground">Pozwól użytkownikom tworzyć drużyny fantasy</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.enablePickem}
              onChange={(e) => handleChange('enablePickem', e.target.checked)}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
            />
            <div>
              <p className="font-medium">Pick'em</p>
              <p className="text-sm text-muted-foreground">System typowania wyników meczy</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.enableStandins}
              onChange={(e) => handleChange('enableStandins', e.target.checked)}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
            />
            <div>
              <p className="font-medium">System Stand-inów</p>
              <p className="text-sm text-muted-foreground">Zezwól drużynom na używanie zawodników zastępczych</p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
