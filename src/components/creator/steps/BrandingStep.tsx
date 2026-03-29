// src/components/creator/steps/BrandingStep.tsx
// Step 2: Branding and visual identity

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Palette, Image as ImageIcon, Type, Upload, X, Sliders, Eye } from 'lucide-react';
import {
  uploadTournamentLogo,
  uploadTournamentBackground,
  uploadTournamentFavicon,
} from '@/lib/storage';

interface BrandingStepProps {
  data: any;
  onChange: (data: any) => void;
  template: string;
  allData?: any;
}

interface FileUploadFieldProps {
  label: string;
  hint: string;
  accept: string;
  currentUrl: string;
  isUploading: boolean;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  previewSize?: 'small' | 'large';
}

function FileUploadField({
  label,
  hint,
  accept,
  currentUrl,
  isUploading,
  onFileSelect,
  onClear,
  previewSize = 'small',
}: FileUploadFieldProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      {currentUrl ? (
        <div className="flex items-start gap-4">
          <img
            src={currentUrl}
            alt={label}
            className={
              previewSize === 'large'
                ? 'max-h-40 rounded-lg border border-border object-cover'
                : 'h-16 w-16 rounded-lg border border-border object-cover'
            }
          />
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition-colors mt-1"
          >
            <X className="h-3 w-3" />
            Usuń
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors bg-background/50"
        >
          {isUploading ? (
            <p className="text-sm text-muted-foreground animate-pulse">Przesyłanie...</p>
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Kliknij aby wybrać plik</p>
            </>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          e.target.value = '';
        }}
      />
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}

export function BrandingStep({ data, onChange, template, allData }: BrandingStepProps): React.ReactElement {
  const slug = allData?.basic?.slug || 'draft';

  const [formData, setFormData] = useState({
    // Core colors
    primaryColor: data?.primaryColor || '#8B1538',
    secondaryColor: data?.secondaryColor || '#D4AF37',
    accentColor: data?.accentColor || '',
    backgroundColor: data?.backgroundColor || 'hsl(240 17% 6%)',
    cardColor: data?.cardColor || '',
    textColor: data?.textColor || '',
    borderColor: data?.borderColor || '',
    headingColor: data?.headingColor || '',
    glowColor: data?.glowColor || '',
    // Fonts
    headerFont: data?.headerFont || 'geist-sans',
    bodyFont: data?.bodyFont || 'geist-sans',
    // Assets
    logoUrl: data?.logoUrl || '',
    backgroundImageUrl: data?.backgroundImageUrl || '',
    faviconUrl: data?.faviconUrl || '',
    // Background tuning
    backgroundOverlayColor: data?.backgroundOverlayColor || 'rgba(0,0,0,0.7)',
    backgroundOverlayOpacity: data?.backgroundOverlayOpacity ?? 90,
    backgroundBlur: data?.backgroundBlur ?? 0,
    backgroundPosition: data?.backgroundPosition || 'center center',
    backgroundSize: data?.backgroundSize || 'cover',
    // Card style
    cardOpacity: data?.cardOpacity ?? 100,
    cardBlur: data?.cardBlur ?? 0,
    cardBorderRadius: data?.cardBorderRadius || '0.75rem',
    // Navbar
    navbarStyle: data?.navbarStyle || 'blur',
    navbarColor: data?.navbarColor || '',
    // Overall style
    themeStyle: data?.themeStyle || 'dark',
  });

  const [uploading, setUploading] = useState({ logo: false, bg: false, favicon: false });
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    onChange(formData);
  }, [formData, onChange]);

  const handleChange = useCallback((field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleFileUpload = async (
    type: 'logo' | 'bg' | 'favicon',
    file: File,
  ): Promise<void> => {
    setUploading(prev => ({ ...prev, [type]: true }));
    try {
      let url: string;
      if (type === 'logo') {
        url = await uploadTournamentLogo(file, slug);
        handleChange('logoUrl', url);
      } else if (type === 'bg') {
        url = await uploadTournamentBackground(file, slug);
        handleChange('backgroundImageUrl', url);
      } else {
        url = await uploadTournamentFavicon(file, slug);
        handleChange('faviconUrl', url);
      }
    } catch (err) {
      console.error(`Failed to upload ${type}:`, err);
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Branding i Wygląd</h2>
        <p className="text-muted-foreground">
          Dostosuj kolory, czcionki i zasoby graficzne turnieju
        </p>
      </div>

      {/* ── Assets ─────────────────────────────────────── */}
      <div className="space-y-6 p-6 rounded-xl bg-card border border-border">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          Zasoby Graficzne
        </h3>

        <div className="grid md:grid-cols-3 gap-6">
          <FileUploadField
            label="Logo Turnieju"
            hint="PNG lub SVG, zalecany rozmiar: 512x512 px"
            accept="image/png,image/svg+xml,image/webp,image/jpeg"
            currentUrl={formData.logoUrl}
            isUploading={uploading.logo}
            onFileSelect={(f) => handleFileUpload('logo', f)}
            onClear={() => handleChange('logoUrl', '')}
          />
          <FileUploadField
            label="Obraz Tła"
            hint="JPG/PNG, zalecane 1920x1080 px lub większe"
            accept="image/png,image/jpeg,image/webp"
            currentUrl={formData.backgroundImageUrl}
            isUploading={uploading.bg}
            onFileSelect={(f) => handleFileUpload('bg', f)}
            onClear={() => handleChange('backgroundImageUrl', '')}
            previewSize="large"
          />
          <FileUploadField
            label="Favicon"
            hint="PNG lub ICO, 32x32 lub 64x64 px"
            accept="image/png,image/x-icon,image/svg+xml"
            currentUrl={formData.faviconUrl}
            isUploading={uploading.favicon}
            onFileSelect={(f) => handleFileUpload('favicon', f)}
            onClear={() => handleChange('faviconUrl', '')}
          />
        </div>
      </div>

      {/* ── Core Colors ────────────────────────────────── */}
      <div className="space-y-6 p-6 rounded-xl bg-card border border-border">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          Schemat Kolorów
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          {([
            ['primaryColor', 'Kolor Główny', true],
            ['secondaryColor', 'Kolor Dodatkowy', true],
            ['accentColor', 'Kolor Akcentowy', false],
            ['glowColor', 'Kolor Glow / Highlight', false],
          ] as const).map(([field, label, required]) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-2">
                {label} {required && <span className="text-primary">*</span>}
              </label>
              <div className="flex gap-3">
                <input
                  type="color"
                  value={formData[field] || '#000000'}
                  onChange={(e) => handleChange(field, e.target.value)}
                  className="w-16 h-10 rounded-lg border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={formData[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  placeholder={required ? undefined : 'Opcjonalne'}
                  className="flex-1 px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors font-mono text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Preview */}
        <div className="p-6 rounded-lg border-2 border-dashed border-border">
          <p className="text-sm text-muted-foreground mb-3">Podgląd kolorów:</p>
          <div className="flex gap-4 flex-wrap">
            {(['primaryColor', 'secondaryColor', 'accentColor', 'glowColor'] as const)
              .filter((f) => formData[f])
              .map((f) => (
                <div key={f} className="text-center">
                  <div
                    className="w-20 h-20 rounded-lg shadow-lg"
                    style={{ backgroundColor: formData[f] }}
                  />
                  <p className="text-xs text-muted-foreground mt-1 capitalize">
                    {f.replace('Color', '')}
                  </p>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ── Typography ─────────────────────────────────── */}
      <div className="space-y-6 p-6 rounded-xl bg-card border border-border">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Type className="h-5 w-5 text-primary" />
          Typografia
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Czcionka Nagłówków</label>
            <select
              value={formData.headerFont}
              onChange={(e) => handleChange('headerFont', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
            >
              <option value="logik">Logik (Professional)</option>
              <option value="mitchell">Mitchell (Elegant Serif)</option>
              <option value="neon-bines">Neon Bines (Cyberpunk)</option>
              <option value="neonderthaw">Neonderthaw (Handwritten Neon)</option>
              <option value="tilt-neon">Tilt Neon (Retro)</option>
              <option value="geist-sans">Geist Sans (Modern)</option>
              <option value="space-mono">Space Mono (Monospace)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Czcionka Treści</label>
            <select
              value={formData.bodyFont}
              onChange={(e) => handleChange('bodyFont', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
            >
              <option value="geist-sans">Geist Sans (Recommended)</option>
              <option value="space-mono">Space Mono</option>
              <option value="logik">Logik</option>
              <option value="mitchell">Mitchell</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Background Tuning ──────────────────────────── */}
      {formData.backgroundImageUrl && (
        <div className="space-y-6 p-6 rounded-xl bg-card border border-border">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Ustawienia Tła
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Przezroczystość nakładki ({formData.backgroundOverlayOpacity}%)
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={formData.backgroundOverlayOpacity}
                onChange={(e) => handleChange('backgroundOverlayOpacity', Number(e.target.value))}
                className="w-full accent-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Wyższe = ciemniejsze tło, lepiej czytelny tekst
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Rozmycie tła ({formData.backgroundBlur}px)
              </label>
              <input
                type="range"
                min={0}
                max={20}
                value={formData.backgroundBlur}
                onChange={(e) => handleChange('backgroundBlur', Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Pozycja tła</label>
              <select
                value={formData.backgroundPosition}
                onChange={(e) => handleChange('backgroundPosition', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
              >
                <option value="center center">Środek</option>
                <option value="center top">Góra</option>
                <option value="center bottom">Dół</option>
                <option value="left center">Lewo</option>
                <option value="right center">Prawo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Rozmiar tła</label>
              <select
                value={formData.backgroundSize}
                onChange={(e) => handleChange('backgroundSize', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
              >
                <option value="cover">Wypełnij (cover)</option>
                <option value="contain">Dopasuj (contain)</option>
                <option value="auto">Oryginał (auto)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Kolor nakładki</label>
              <div className="flex gap-3">
                <input
                  type="color"
                  value={formData.backgroundOverlayColor?.startsWith('rgba') ? '#000000' : (formData.backgroundOverlayColor || '#000000')}
                  onChange={(e) => handleChange('backgroundOverlayColor', e.target.value)}
                  className="w-16 h-10 rounded-lg border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.backgroundOverlayColor}
                  onChange={(e) => handleChange('backgroundOverlayColor', e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Live mini-preview */}
          <div className="relative overflow-hidden rounded-lg h-32 border border-border">
            <div
              className="absolute inset-0 bg-no-repeat"
              style={{
                backgroundImage: `url(${formData.backgroundImageUrl})`,
                backgroundSize: formData.backgroundSize,
                backgroundPosition: formData.backgroundPosition,
                filter: formData.backgroundBlur ? `blur(${formData.backgroundBlur}px)` : undefined,
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: formData.backgroundOverlayColor,
                opacity: formData.backgroundOverlayOpacity / 100,
              }}
            />
            <div className="relative z-10 flex items-center justify-center h-full">
              <p className="text-white text-sm font-medium drop-shadow-lg">Podgląd tła</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Advanced Theme Options ─────────────────────── */}
      <div className="space-y-6 p-6 rounded-xl bg-card border border-border">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-lg font-semibold w-full"
        >
          <Sliders className="h-5 w-5 text-primary" />
          Zaawansowane Ustawienia Motywu
          <span className="text-xs text-muted-foreground ml-auto">
            {showAdvanced ? 'Zwiń' : 'Rozwiń'}
          </span>
        </button>

        {showAdvanced && (
          <div className="space-y-6 pt-4 border-t border-border">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Surface colors */}
              {([
                ['backgroundColor', 'Kolor Tła Strony'],
                ['cardColor', 'Kolor Kart'],
                ['textColor', 'Kolor Tekstu'],
                ['headingColor', 'Kolor Nagłówków'],
                ['borderColor', 'Kolor Obramowań'],
                ['navbarColor', 'Kolor Navbara'],
              ] as const).map(([field, label]) => (
                <div key={field}>
                  <label className="block text-sm font-medium mb-2">{label}</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={formData[field]?.startsWith('hsl') ? '#0d0e1a' : (formData[field] || '#000000')}
                      onChange={(e) => handleChange(field, e.target.value)}
                      className="w-16 h-10 rounded-lg border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData[field]}
                      onChange={(e) => handleChange(field, e.target.value)}
                      placeholder="Domyślny"
                      className="flex-1 px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors font-mono text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Card style */}
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Przezroczystość kart ({formData.cardOpacity}%)
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={formData.cardOpacity}
                  onChange={(e) => handleChange('cardOpacity', Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Rozmycie kart ({formData.cardBlur}px)
                </label>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={formData.cardBlur}
                  onChange={(e) => handleChange('cardBlur', Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Zaokrąglenie kart</label>
                <select
                  value={formData.cardBorderRadius}
                  onChange={(e) => handleChange('cardBorderRadius', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
                >
                  <option value="0">Kwadratowe</option>
                  <option value="0.375rem">Delikatne</option>
                  <option value="0.75rem">Standardowe</option>
                  <option value="1rem">Duże</option>
                  <option value="1.5rem">Bardzo duże</option>
                </select>
              </div>
            </div>

            {/* Navbar style */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Styl Nawigacji</label>
                <select
                  value={formData.navbarStyle}
                  onChange={(e) => handleChange('navbarStyle', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
                >
                  <option value="solid">Solidny (nieprzezroczysty)</option>
                  <option value="transparent">Przezroczysty</option>
                  <option value="blur">Rozmycie (glassmorphism)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Motyw</label>
                <select
                  value={formData.themeStyle}
                  onChange={(e) => handleChange('themeStyle', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
                >
                  <option value="dark">Ciemny</option>
                  <option value="light">Jasny</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
