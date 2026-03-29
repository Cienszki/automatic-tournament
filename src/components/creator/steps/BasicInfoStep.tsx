// src/components/creator/steps/BasicInfoStep.tsx
// Step 1: Basic tournament information

'use client';

import { useEffect, useState } from 'react';
import { Info, Calendar, Users, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BasicInfoStepProps {
  data: any;
  onChange: (data: any) => void;
  template: string;
}

export function BasicInfoStep({ data, onChange, template }: BasicInfoStepProps) {
  const [formData, setFormData] = useState({
    name: data?.name || '',
    shortName: data?.shortName || '',
    slug: data?.slug || '',
    description: data?.description || '',
    organizerName: data?.organizerName || '',
    contactEmail: data?.contactEmail || '',
    discordUrl: data?.discordUrl || '',
    twitchUrl: data?.twitchUrl || '',
    registrationStart: data?.registrationStart || '',
    registrationEnd: data?.registrationEnd || '',
    tournamentStart: data?.tournamentStart || '',
    tournamentEnd: data?.tournamentEnd || '',
  });

  // Auto-generate slug from name
  useEffect(() => {
    if (formData.name && !data?.slug) {
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setFormData(prev => ({ ...prev, slug }));
    }
  }, [formData.name, data?.slug]);

  // Update parent component when form data changes
  useEffect(() => {
    onChange(formData);
  }, [formData, onChange]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Podstawowe Informacje</h2>
        <p className="text-muted-foreground">
          Podaj nazwę turnieju, daty i dane kontaktowe organizatora
        </p>
      </div>

      {/* Template Info */}
      {template !== 'custom' && (
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground mb-1">
              Wybrany szablon: {template === 'mmr-limited' ? 'Turniej z Limitem MMR' : 'Liga Profesjonalna'}
            </p>
            <p className="text-muted-foreground">
              Struktura turnieju zostanie skonfigurowana w kolejnych krokach
            </p>
          </div>
        </div>
      )}

      {/* Tournament Identity */}
      <div className="space-y-6 p-6 rounded-xl bg-card border border-border">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Tożsamość Turnieju
        </h3>

        <div className="grid gap-6">
          <FormField
            label="Nazwa turnieju"
            required
            helperText="Pełna nazwa wyświetlana (np. 'Polish Dota League Season 1')"
          >
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Nazwa turnieju"
              className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
              maxLength={100}
            />
          </FormField>

          <div className="grid md:grid-cols-2 gap-6">
            <FormField
              label="Skrócona nazwa"
              required
              helperText="Używana w UI (np. 'PDL')"
            >
              <input
                type="text"
                value={formData.shortName}
                onChange={(e) => handleChange('shortName', e.target.value)}
                placeholder="PDL"
                className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
                maxLength={20}
              />
            </FormField>

            <FormField
              label="Slug URL"
              required
              helperText="Używany w adresie (np. 'pdl')"
            >
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => handleChange('slug', e.target.value)}
                placeholder="pdl"
                className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors font-mono text-sm"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground mt-1">
                URL: dota2inhouse.pl/<span className="text-primary">{formData.slug || 'slug'}</span>
              </p>
            </FormField>
          </div>

          <FormField
            label="Opis turnieju"
            required
            helperText="Krótki opis dla strony głównej (max 500 znaków)"
          >
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Opisz swój turniej..."
              rows={3}
              className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right mt-1">
              {formData.description.length}/500
            </p>
          </FormField>
        </div>
      </div>

      {/* Organization */}
      <div className="space-y-6 p-6 rounded-xl bg-card border border-border">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          Organizacja & Kontakt
        </h3>

        <div className="grid gap-6">
          <div className="grid md:grid-cols-2 gap-6">
            <FormField
              label="Nazwa organizatora"
              required
            >
              <input
                type="text"
                value={formData.organizerName}
                onChange={(e) => handleChange('organizerName', e.target.value)}
                placeholder="PD2IH"
                className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
              />
            </FormField>

            <FormField
              label="Email kontaktowy"
              required
            >
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => handleChange('contactEmail', e.target.value)}
                placeholder="kontakt@turniej.pl"
                className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
              />
            </FormField>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <FormField
              label="Discord (opcjonalnie)"
            >
              <input
                type="url"
                value={formData.discordUrl}
                onChange={(e) => handleChange('discordUrl', e.target.value)}
                placeholder="https://discord.gg/..."
                className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
              />
            </FormField>

            <FormField
              label="Twitch (opcjonalnie)"
            >
              <input
                type="url"
                value={formData.twitchUrl}
                onChange={(e) => handleChange('twitchUrl', e.target.value)}
                placeholder="https://twitch.tv/..."
                className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
              />
            </FormField>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-6 p-6 rounded-xl bg-card border border-border">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Harmonogram
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          <FormField
            label="Początek rejestracji"
            required
          >
            <input
              type="date"
              value={formData.registrationStart}
              onChange={(e) => handleChange('registrationStart', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
            />
          </FormField>

          <FormField
            label="Koniec rejestracji"
            required
          >
            <input
              type="date"
              value={formData.registrationEnd}
              onChange={(e) => handleChange('registrationEnd', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
            />
          </FormField>

          <FormField
            label="Początek turnieju"
            required
          >
            <input
              type="date"
              value={formData.tournamentStart}
              onChange={(e) => handleChange('tournamentStart', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
            />
          </FormField>

          <FormField
            label="Zakończenie turnieju (opcjonalnie)"
          >
            <input
              type="date"
              value={formData.tournamentEnd}
              onChange={(e) => handleChange('tournamentEnd', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  required?: boolean;
  helperText?: string;
  children: React.ReactNode;
}

function FormField({ label, required, helperText, children }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        {label}
        {required && <span className="text-primary ml-1">*</span>}
      </label>
      {children}
      {helperText && (
        <p className="text-xs text-muted-foreground mt-1">{helperText}</p>
      )}
    </div>
  );
}
