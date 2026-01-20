// src/components/creator/steps/BrandingStep.tsx
// Step 2: Branding and visual identity

'use client';

import { useEffect, useState } from 'react';
import { Palette, Image as ImageIcon, Type } from 'lucide-react';

interface BrandingStepProps {
  data: any;
  onChange: (data: any) => void;
  template: string;
}

export function BrandingStep({ data, onChange, template }: BrandingStepProps) {
  const [formData, setFormData] = useState({
    primaryColor: data?.primaryColor || '#8B1538',
    secondaryColor: data?.secondaryColor || '#D4AF37',
    headerFont: data?.headerFont || 'geist-sans',
    bodyFont: data?.bodyFont || 'geist-sans',
    logoUrl: data?.logoUrl || '',
  });

  useEffect(() => {
    onChange(formData);
  }, [formData, onChange]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Branding i Wygląd</h2>
        <p className="text-muted-foreground">
          Dostosuj kolory, czcionki i logo turnieju
        </p>
      </div>

      {/* Color Scheme */}
      <div className="space-y-6 p-6 rounded-xl bg-card border border-border">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          Schemat Kolorów
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Kolor Główny <span className="text-primary">*</span>
            </label>
            <div className="flex gap-3">
              <input
                type="color"
                value={formData.primaryColor}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                className="w-16 h-10 rounded-lg border border-border cursor-pointer"
              />
              <input
                type="text"
                value={formData.primaryColor}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Kolor Dodatkowy <span className="text-primary">*</span>
            </label>
            <div className="flex gap-3">
              <input
                type="color"
                value={formData.secondaryColor}
                onChange={(e) => handleChange('secondaryColor', e.target.value)}
                className="w-16 h-10 rounded-lg border border-border cursor-pointer"
              />
              <input
                type="text"
                value={formData.secondaryColor}
                onChange={(e) => handleChange('secondaryColor', e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors font-mono text-sm"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="p-6 rounded-lg border-2 border-dashed border-border">
          <p className="text-sm text-muted-foreground mb-3">Podgląd kolorów:</p>
          <div className="flex gap-4">
            <div 
              className="w-24 h-24 rounded-lg shadow-lg"
              style={{ backgroundColor: formData.primaryColor }}
            />
            <div 
              className="w-24 h-24 rounded-lg shadow-lg"
              style={{ backgroundColor: formData.secondaryColor }}
            />
          </div>
        </div>
      </div>

      {/* Typography */}
      <div className="space-y-6 p-6 rounded-xl bg-card border border-border">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Type className="h-5 w-5 text-primary" />
          Typografia
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Czcionka Nagłówków
            </label>
            <select
              value={formData.headerFont}
              onChange={(e) => handleChange('headerFont', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
            >
              <option value="logik">Logik (Professional)</option>
              <option value="neon-bines">Neon Bines (Cyberpunk)</option>
              <option value="tilt-neon">Tilt Neon (Retro)</option>
              <option value="geist-sans">Geist Sans (Modern)</option>
              <option value="space-mono">Space Mono (Monospace)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Czcionka Treści
            </label>
            <select
              value={formData.bodyFont}
              onChange={(e) => handleChange('bodyFont', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
            >
              <option value="geist-sans">Geist Sans (Recommended)</option>
              <option value="space-mono">Space Mono</option>
              <option value="logik">Logik</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logo */}
      <div className="space-y-6 p-6 rounded-xl bg-card border border-border">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          Logo Turnieju
        </h3>

        <div>
          <label className="block text-sm font-medium mb-2">
            URL Logo
          </label>
          <input
            type="url"
            value={formData.logoUrl}
            onChange={(e) => handleChange('logoUrl', e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Możesz wgrać logo później w panelu administracyjnym
          </p>
        </div>
      </div>
    </div>
  );
}
