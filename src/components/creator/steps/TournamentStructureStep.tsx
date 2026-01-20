// src/components/creator/steps/TournamentStructureStep.tsx
// Step 3: Tournament structure configuration

'use client';

import { useEffect, useState } from 'react';
import { Trophy, Users, Calendar, Settings } from 'lucide-react';

interface TournamentStructureStepProps {
  data: any;
  onChange: (data: any) => void;
  template: string;
}

export function TournamentStructureStep({ data, onChange, template }: TournamentStructureStepProps) {
  const [formData, setFormData] = useState({
    type: data?.type || (template === 'mmr-limited' ? 'mmr-limited' : template === 'league' ? 'league' : 'mmr-limited'),
    teamsCount: data?.teamsCount || 16,
    mmrCap: data?.mmrCap || 24000,
    enableFantasy: data?.enableFantasy || false,
    enablePickem: data?.enablePickem || false,
    enableStandins: data?.enableStandins || true,
  });

  useEffect(() => {
    onChange(formData);
  }, [formData, onChange]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Struktura Turnieju</h2>
        <p className="text-muted-foreground">
          Skonfiguruj format rozgrywek i dodatkowe funkcje
        </p>
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
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Liczba Drużyn
          </label>
          <input
            type="number"
            value={formData.teamsCount}
            onChange={(e) => handleChange('teamsCount', parseInt(e.target.value))}
            min={4}
            max={256}
            className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
          />
        </div>

        {formData.type === 'mmr-limited' && (
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
