"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Type,
  Plus,
  Search,
  Trash2,
  Eye,
} from 'lucide-react';
import { 
  getAllGoogleFonts,
  type GoogleFont 
} from '@/lib/google-fonts';

// Local fonts from public/fonts directory
const LOCAL_FONTS: CustomFont[] = [
  {
    id: 'local-logik',
    family: 'Logik',
    type: 'local',
    variants: ['400'],
    category: 'display',
    path: '/fonts/logik/logik.ttf',
  },
  {
    id: 'local-logik-2',
    family: 'Logik 2',
    type: 'local',
    variants: ['400'],
    category: 'display',
    path: '/fonts/logik/logik-2.ttf',
  },
  {
    id: 'local-logik-3',
    family: 'Logik 3',
    type: 'local',
    variants: ['400'],
    category: 'display',
    path: '/fonts/logik/logik-3.ttf',
  },
  {
    id: 'local-logik-4',
    family: 'Logik 4',
    type: 'local',
    variants: ['400'],
    category: 'sans-serif',
    path: '/fonts/logik/logik-4.ttf',
  },
  {
    id: 'local-logik-6',
    family: 'Logik 6',
    type: 'local',
    variants: ['400'],
    category: 'display',
    path: '/fonts/logik/logik-6.ttf',
  },
  {
    id: 'local-logik-extended-6',
    family: 'Logik Extended 6',
    type: 'local',
    variants: ['400'],
    category: 'display',
    path: '/fonts/logik/logik-extended-6.ttf',
  },
  {
    id: 'local-logik-extended-7',
    family: 'Logik Extended 7',
    type: 'local',
    variants: ['400'],
    category: 'display',
    path: '/fonts/logik/logik-extended-7.ttf',
  },
  {
    id: 'local-logik-extended-8',
    family: 'Logik Extended 8',
    type: 'local',
    variants: ['400'],
    category: 'display',
    path: '/fonts/logik/logik-extended-8.ttf',
  },
  {
    id: 'local-logik-extended-9',
    family: 'Logik Extended 9',
    type: 'local',
    variants: ['400'],
    category: 'display',
    path: '/fonts/logik/logik-extended-9.ttf',
  },
  {
    id: 'local-logik-extended-bold',
    family: 'Logik Extended Bold',
    type: 'local',
    variants: ['700'],
    category: 'display',
    path: '/fonts/logik/Logik-ExtendedBold.ttf',
  },
  {
    id: 'local-logik-wide-black',
    family: 'Logik Wide Black',
    type: 'local',
    variants: ['900'],
    category: 'display',
    path: '/fonts/logik/Logik-WideBlack.ttf',
  },
  {
    id: 'local-mitchell',
    family: 'Mitchell',
    type: 'local',
    variants: ['400'],
    category: 'script',
    path: '/fonts/mitchell/Mitchell.otf',
  },
  {
    id: 'local-neonderthaw',
    family: 'Neonderthaw',
    type: 'local',
    variants: ['400'],
    category: 'handwriting',
    path: '/fonts/neonderthaw/Neonderthaw-Regular.ttf',
  },
  {
    id: 'local-space-mono',
    family: 'Space Mono',
    type: 'local',
    variants: ['400', '700'],
    category: 'monospace',
    path: '/fonts/space-mono',
  },
  {
    id: 'local-tilt-neon',
    family: 'Tilt Neon',
    type: 'local',
    variants: ['400'],
    category: 'display',
    path: '/fonts/tilt-neon/TiltNeon-Regular-VariableFont_XROT,YROT.ttf',
  },
];

export interface CustomFont {
  id: string;
  family: string;
  type: 'google' | 'local';
  variants: string[];
  category: string;
  path?: string; // For local fonts
}

interface FontManagementProps {
  customFonts: CustomFont[];
  onAddFont: (font: CustomFont) => void;
  onRemoveFont: (fontId: string) => void;
  primaryColor: string;
}

export function FontManagement({ 
  customFonts, 
  onAddFont, 
  onRemoveFont,
  primaryColor 
}: FontManagementProps) {
  const [showBrowser, setShowBrowser] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewFont, setPreviewFont] = useState<CustomFont | null>(null);
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set());
  const attemptedLoads = useRef<Set<string>>(new Set());

  // Helper function to load a Google Font
  const loadGoogleFont = useCallback((fontFamily: string) => {
    // Skip if already attempted
    if (attemptedLoads.current.has(fontFamily)) {
      return;
    }
    attemptedLoads.current.add(fontFamily);

    const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@400;700&display=swap`;
    const linkId = `google-font-${fontFamily.replace(/\s+/g, '-')}`;

    // Check if already loaded in DOM
    if (document.getElementById(linkId)) {
      setLoadedFonts(prev => {
        if (prev.has(fontFamily)) return prev;
        const updated = new Set(prev);
        updated.add(fontFamily);
        return updated;
      });
      return;
    }

    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = fontUrl;
    
    // Mark as loaded after font loads
    link.onload = () => {
      // Use document.fonts API if available to ensure font is really loaded
      if (document.fonts && document.fonts.load) {
        Promise.all([
          document.fonts.load(`400 12px "${fontFamily}"`),
          document.fonts.load(`700 12px "${fontFamily}"`)
        ]).then(() => {
          setLoadedFonts(prev => {
            if (prev.has(fontFamily)) return prev;
            const updated = new Set(prev);
            updated.add(fontFamily);
            return updated;
          });
        }).catch(() => {
          // Fallback if font loading fails
          setTimeout(() => {
            setLoadedFonts(prev => {
              if (prev.has(fontFamily)) return prev;
              const updated = new Set(prev);
              updated.add(fontFamily);
              return updated;
            });
          }, 500);
        });
      } else {
        // Fallback for browsers without Font Loading API
        setTimeout(() => {
          setLoadedFonts(prev => {
            if (prev.has(fontFamily)) return prev;
            const updated = new Set(prev);
            updated.add(fontFamily);
            return updated;
          });
        }, 300);
      }
    };
    
    document.head.appendChild(link);
  }, []);

  // Load Google Fonts for custom fonts list
  useEffect(() => {
    customFonts.forEach(font => {
      if (font.type === 'google') {
        loadGoogleFont(font.family);
      }
    });
  }, [customFonts, loadGoogleFont]);

  // Combine local and Google fonts
  const googleFontsAsCustom = getAllGoogleFonts();
  const allFonts = [...LOCAL_FONTS, ...googleFontsAsCustom];
  
  // Mark all local fonts as loaded (run once on mount and when custom fonts change)
  useEffect(() => {
    setLoadedFonts(prev => {
      const updated = new Set(prev);
      
      // Add built-in local fonts
      LOCAL_FONTS.forEach(font => updated.add(font.family));
      
      // Add custom local fonts
      customFonts.forEach(font => {
        if (font.type === 'local') {
          updated.add(font.family);
        }
      });
      
      // Only update if something changed
      if (updated.size === prev.size && Array.from(updated).every(f => prev.has(f))) {
        return prev;
      }
      return updated;
    });
  }, [customFonts]);
  
  const searchResults = searchQuery
    ? allFonts.filter(font => 
        font.family.toLowerCase().includes(searchQuery.toLowerCase()) ||
        font.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allFonts;
  
  const localResults = searchResults.filter(f => f.type === 'local');
  const googleResults = searchResults.filter(f => f.type === 'google');

  // Load Google Fonts for search results when browser is open
  useEffect(() => {
    if (!showBrowser) return;
    
    // Load first 20 Google fonts from search results
    const fontsToLoad = googleResults.slice(0, 20);
    fontsToLoad.forEach(font => {
      loadGoogleFont(font.family);
    });
  }, [showBrowser, searchQuery, loadGoogleFont]);

  // Load preview font
  useEffect(() => {
    if (previewFont && previewFont.type === 'google') {
      loadGoogleFont(previewFont.family);
    }
  }, [previewFont, loadGoogleFont]);

  const handleAddFont = (font: CustomFont) => {
    onAddFont(font);
    setShowBrowser(false);
    setSearchQuery('');
  };

  const isAlreadyAdded = (fontId: string) => {
    return customFonts.some(f => f.id === fontId);
  };

  return (
    <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
              <Type className="h-5 w-5" style={{ color: primaryColor }} />
              Zarządzanie czcionkami
            </CardTitle>
            <CardDescription className="font-logik">
              Dodaj niestandardowe czcionki lokalne lub z Google Fonts
            </CardDescription>
          </div>
          <Dialog open={showBrowser} onOpenChange={setShowBrowser}>
            <DialogTrigger asChild>
              <Button className="font-logik" style={{ backgroundColor: primaryColor }}>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj czcionkę
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-logik-extended-bold">
                  Przeglądaj czcionki
                </DialogTitle>
                <DialogDescription className="font-logik">
                  Wybierz czcionkę lokalną lub z Google Fonts
                </DialogDescription>
              </DialogHeader>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Szukaj czcionki..."
                  className="pl-9 font-logik"
                />
              </div>

              {/* Font Grid - Split into Local and Google sections */}
              <div className="space-y-6 mt-4">
                {/* Local Fonts */}
                {localResults.length > 0 && (
                  <div>
                    <h3 className="font-logik-extended-bold text-sm text-muted-foreground mb-3 px-2">
                      Lokalne czcionki (z projektu)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {localResults.map((font) => (
                        <div
                          key={font.id}
                          className="border border-border rounded-xl p-4 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-logik-extended-bold text-lg mb-1">
                                {font.family}
                              </h4>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="text-xs font-logik">
                                  {font.category}
                                </Badge>
                                <Badge className="text-xs font-logik bg-purple-100 text-purple-700 hover:bg-purple-100">
                                  Lokalna
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPreviewFont(font)}
                                className="font-logik"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleAddFont(font)}
                                disabled={isAlreadyAdded(font.id)}
                                className="font-logik"
                                style={{ backgroundColor: isAlreadyAdded(font.id) ? undefined : primaryColor }}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Font Preview - Local fonts already loaded */}
                          <div className="text-sm text-muted-foreground" style={{ minHeight: '1.5rem' }}>
                            <p
                              style={{ fontFamily: `'${font.family}', sans-serif` }}
                            >
                              The quick brown fox jumps over the lazy dog
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Google Fonts */}
                {googleResults.length > 0 && (
                  <div>
                    <h3 className="font-logik-extended-bold text-sm text-muted-foreground mb-3 px-2">
                      Google Fonts
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {googleResults.map((font) => (
                        <div
                          key={font.id}
                          className="border border-border rounded-xl p-4 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-logik-extended-bold text-lg mb-1">
                                {font.family}
                              </h4>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="text-xs font-logik">
                                  {font.category}
                                </Badge>
                                <Badge className="text-xs font-logik bg-green-100 text-green-700 hover:bg-green-100">
                                  Google
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPreviewFont(font)}
                                className="font-logik"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleAddFont(font)}
                                disabled={isAlreadyAdded(font.id)}
                                className="font-logik"
                                style={{ backgroundColor: isAlreadyAdded(font.id) ? undefined : primaryColor }}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Font Preview */}
                          <div className="text-sm text-muted-foreground" style={{ minHeight: '1.5rem' }}>
                            {loadedFonts.has(font.family) ? (
                              <p style={{ fontFamily: `'${font.family}', sans-serif` }}>
                                The quick brown fox jumps over the lazy dog
                              </p>
                            ) : (
                              <p className="italic opacity-50">Loading font...</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {localResults.length === 0 && googleResults.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground font-logik">
                    Nie znaleziono czcionek pasujących do zapytania
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {customFonts.length === 0 ? (
          <div className="text-center py-8 px-4 border border-dashed border-border rounded-xl">
            <Type className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground font-logik">
              Nie dodano jeszcze żadnych niestandardowych czcionek
            </p>
            <p className="text-xs text-muted-foreground font-logik mt-1">
              Kliknij "Dodaj czcionkę" aby przeglądać lokalne i Google Fonts
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customFonts.map((font) => (
              <div
                key={font.id}
                className="border border-border rounded-xl p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-logik-extended-bold text-base mb-1">
                      {font.family}
                    </h4>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs font-logik">
                        {font.category}
                      </Badge>
                      {font.type === 'local' && (
                        <Badge className="text-xs font-logik bg-purple-100 text-purple-700 hover:bg-purple-100">
                          Lokalna
                        </Badge>
                      )}
                      {font.type === 'google' && (
                        <Badge className="text-xs font-logik bg-green-100 text-green-700 hover:bg-green-100">
                          Google
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveFont(font.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                {/* Font Preview */}
                <div className="text-sm text-muted-foreground" style={{ minHeight: '1.5rem' }}>
                  {font.type === 'local' || loadedFonts.has(font.family) ? (
                    <p style={{ fontFamily: `'${font.family}', sans-serif` }}>
                      Przykładowy tekst w tej czcionce
                    </p>
                  ) : (
                    <p className="italic opacity-50">Ładowanie czcionki...</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Preview Dialog */}
      {previewFont && (
        <Dialog open={!!previewFont} onOpenChange={() => setPreviewFont(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-logik-extended-bold">
                {previewFont.family}
              </DialogTitle>
              <DialogDescription className="font-logik">
                Podgląd czcionki w różnych rozmiarach
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {previewFont.type === 'local' || loadedFonts.has(previewFont.family) ? (
                <div style={{ fontFamily: `'${previewFont.family}', sans-serif` }}>
                  <p className="text-3xl font-bold mb-2">
                    The Quick Brown Fox
                  </p>
                  <p className="text-xl mb-2">
                    Jumps over the lazy dog
                  </p>
                  <p className="text-base mb-2">
                    Pack my box with five dozen liquor jugs
                  </p>
                  <p className="text-sm mb-2">
                    ABCDEFGHIJKLMNOPQRSTUVWXYZ
                  </p>
                  <p className="text-sm">
                    abcdefghijklmnopqrstuvwxyz 0123456789
                  </p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="italic">Ładowanie czcionki...</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                onClick={() => {
                  handleAddFont(previewFont);
                  setPreviewFont(null);
                }}
                disabled={isAlreadyAdded(previewFont.id)}
                className="font-logik"
                style={{ backgroundColor: isAlreadyAdded(previewFont.id) ? undefined : primaryColor }}
              >
                <Plus className="h-4 w-4 mr-2" />
                {isAlreadyAdded(previewFont.id) ? 'Już dodana' : 'Dodaj czcionkę'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
