// src/components/creator/steps/ReviewStep.tsx
// Step 4: Review and publish

'use client';

import { Check } from 'lucide-react';

interface ReviewStepProps {
  data: any;
  onChange: (data: any) => void;
  template: string;
}

export function ReviewStep({ data, onChange, template }: ReviewStepProps) {
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
              Po kliknięciu "Opublikuj Turniej" zostanie utworzony nowy turniej z podanymi ustawieniami.
              Będziesz mógł dalej edytować wszystkie opcje w panelu administracyjnym.
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-4">
        <SummarySection title="Podstawowe Informacje">
          <SummaryItem label="Nazwa" value="(Podaj nazwę turnieju)" />
          <SummaryItem label="Organizator" value="(Podaj nazwę organizatora)" />
        </SummarySection>

        <SummarySection title="Wygląd">
          <SummaryItem label="Kolory" value="Dostosowane" />
          <SummaryItem label="Czcionki" value="Wybrane" />
        </SummarySection>

        <SummarySection title="Struktura">
          <SummaryItem label="Format" value="(Wybrany format)" />
          <SummaryItem label="Funkcje" value="Skonfigurowane" />
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
