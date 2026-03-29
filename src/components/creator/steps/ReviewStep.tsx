// src/components/creator/steps/ReviewStep.tsx
// Step 4: Review and publish

'use client';

import { Check } from 'lucide-react';

interface ReviewStepProps {
  data: any;
  onChange: (data: any) => void;
  template: string;
  allData?: {
    basic?: any;
    branding?: any;
    structure?: any;
  };
}

const MATCH_FORMAT_LABELS: Record<string, string> = {
  'bo1': 'BO1',
  'bo2': 'BO2',
  'bo3': 'BO3',
  'bo5': 'BO5',
};

export function ReviewStep({ data, onChange, template, allData }: ReviewStepProps) {
  const basic = allData?.basic || {};
  const branding = allData?.branding || {};
  const structure = allData?.structure || {};
  const isMmrLimited = structure.type === 'mmr-limited';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Podsumowanie</h2>
        <p className="text-muted-foreground">
          Sprawdź wszystkie ustawienia przed publikacją
        </p>
      </div>

      <div className="p-6 rounded-xl bg-primary/5 border border-primary/20">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
            <Check className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">Turniej jest gotowy do publikacji!</h3>
            <p className="text-sm text-muted-foreground">
              Po kliknięciu &quot;Opublikuj Turniej&quot; zostanie utworzony nowy turniej z podanymi ustawieniami.
              Będziesz mógł dalej edytować wszystkie opcje w panelu administracyjnym.
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-4">
        <SummarySection title="Podstawowe Informacje">
          <SummaryItem label="Nazwa" value={basic.name || '—'} />
          <SummaryItem label="Skrót" value={basic.shortName || '—'} />
          <SummaryItem label="Slug URL" value={basic.slug ? `/${basic.slug}` : '—'} />
          <SummaryItem label="Organizator" value={basic.organizerName || '—'} />
          {basic.registrationStart && (
            <SummaryItem label="Rejestracja" value={`${basic.registrationStart} — ${basic.registrationEnd || '?'}`} />
          )}
          {basic.tournamentStart && (
            <SummaryItem label="Turniej" value={`${basic.tournamentStart} — ${basic.tournamentEnd || '?'}`} />
          )}
        </SummarySection>

        <SummarySection title="Wygląd">
          <SummaryItem label="Kolor główny" value={branding.primaryColor || '—'} />
          <SummaryItem label="Kolor dodatkowy" value={branding.secondaryColor || '—'} />
          {branding.accentColor && <SummaryItem label="Kolor akcentowy" value={branding.accentColor} />}
          {branding.glowColor && <SummaryItem label="Kolor glow" value={branding.glowColor} />}
          <SummaryItem label="Font nagłówków" value={branding.headerFont || '—'} />
          <SummaryItem label="Font treści" value={branding.bodyFont || '—'} />
          <SummaryItem label="Logo" value={branding.logoUrl ? 'Przesłane' : 'Brak'} />
          <SummaryItem label="Obraz tła" value={branding.backgroundImageUrl ? 'Przesłane' : 'Brak'} />
          <SummaryItem label="Favicon" value={branding.faviconUrl ? 'Przesłane' : 'Brak'} />
          <SummaryItem label="Styl navbara" value={branding.navbarStyle || 'blur'} />
          <SummaryItem label="Motyw" value={branding.themeStyle || 'dark'} />
        </SummarySection>

        <SummarySection title="Struktura">
          <SummaryItem label="Typ" value={isMmrLimited ? 'Turniej z Limitem MMR' : 'Liga Profesjonalna'} />
          <SummaryItem label="Liczba drużyn" value={String(structure.teamsCount || '—')} />
          {isMmrLimited && (
            <>
              <SummaryItem label="Limit MMR" value={structure.mmrCap ? structure.mmrCap.toLocaleString() : '—'} />
              <SummaryItem label="Format meczy (grupy)" value={MATCH_FORMAT_LABELS[structure.groupMatchFormat] || '—'} />
              <SummaryItem label="Awans do UB z grupy" value={String(structure.teamsToUpperBracketPerGroup || '—')} />
              <SummaryItem label="Awans do LB z grupy" value={String(structure.teamsToLowerBracketPerGroup || '—')} />
            </>
          )}
        </SummarySection>

        <SummarySection title="Playoff">
          <SummaryItem label="Format" value={structure.playoffFormat === 'single-elimination' ? 'Single Elimination' : 'Double Elimination'} />
          <SummaryItem label="Półfinały" value={MATCH_FORMAT_LABELS[structure.playoffSemifinalFormat] || '—'} />
          <SummaryItem label="Finał" value={MATCH_FORMAT_LABELS[structure.playoffFinalFormat] || '—'} />
          <SummaryItem label="Grand Final" value={MATCH_FORMAT_LABELS[structure.playoffGrandFinalFormat] || '—'} />
        </SummarySection>

        <SummarySection title="Dodatkowe Funkcje">
          <SummaryItem label="Fantasy League" value={structure.enableFantasy ? 'Włączone' : 'Wyłączone'} />
          <SummaryItem label="Pick'em" value={structure.enablePickem ? 'Włączone' : 'Wyłączone'} />
          <SummaryItem label="Stand-iny" value={structure.enableStandins ? 'Włączone' : 'Wyłączone'} />
        </SummarySection>
      </div>
    </div>
  );
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-6 rounded-xl bg-card border border-border">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
