"use client";

import React, { useState } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { 
  BarChart3,
  Save,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Users,
  Swords,
  TrendingUp,
  Database,
} from 'lucide-react';

interface StatCategory {
  id: string;
  name: string;
  description: string;
  lastUpdated: string;
  recordCount: number;
  selected: boolean;
}

/**
 * Stats Tab - Force recalculate stats (all or selected)
 */
export function StatsTab() {
  const { tournament, theme } = useTournament();
  
  const [categories, setCategories] = useState<StatCategory[]>([
    { id: 'players', name: 'Statystyki graczy', description: 'KDA, GPM, XPM, damage, healing...', lastUpdated: '2025-02-24 15:30', recordCount: 156, selected: false },
    { id: 'teams', name: 'Statystyki drużyn', description: 'Win rate, średnia długość gry, first blood...', lastUpdated: '2025-02-24 15:30', recordCount: 24, selected: false },
    { id: 'heroes', name: 'Statystyki bohaterów', description: 'Pick rate, ban rate, win rate, średnie KDA...', lastUpdated: '2025-02-24 15:30', recordCount: 123, selected: false },
    { id: 'matches', name: 'Statystyki meczów', description: 'Dane z gier, performance graczy...', lastUpdated: '2025-02-24 15:30', recordCount: 84, selected: false },
  ]);
  
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentCategory, setCurrentCategory] = useState('');

  const toggleCategory = (categoryId: string) => {
    setCategories(categories.map(c => 
      c.id === categoryId ? { ...c, selected: !c.selected } : c
    ));
  };

  const selectAll = () => {
    setCategories(categories.map(c => ({ ...c, selected: true })));
  };

  const deselectAll = () => {
    setCategories(categories.map(c => ({ ...c, selected: false })));
  };

  const selectedCategories = categories.filter(c => c.selected);

  const handleRecalculate = async () => {
    const toProcess = selectedCategories.length > 0 ? selectedCategories : categories;
    setIsRecalculating(true);
    setProgress(0);

    for (let i = 0; i < toProcess.length; i++) {
      setCurrentCategory(toProcess[i].name);
      
      // Simulate processing
      for (let p = 0; p <= 100; p += 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setProgress(((i / toProcess.length) * 100) + (p / toProcess.length));
      }
      
      // Update last updated time
      setCategories(prev => prev.map(c => 
        c.id === toProcess[i].id 
          ? { ...c, lastUpdated: new Date().toLocaleString('pl-PL') }
          : c
      ));
    }

    setProgress(100);
    setIsRecalculating(false);
    setCurrentCategory('');
  };

  const getCategoryIcon = (id: string) => {
    switch (id) {
      case 'players':
        return <Users className="h-5 w-5" />;
      case 'teams':
        return <Swords className="h-5 w-5" />;
      case 'heroes':
        return <TrendingUp className="h-5 w-5" />;
      case 'matches':
        return <Database className="h-5 w-5" />;
      default:
        return <BarChart3 className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Statystyki</h2>
          <p className="text-muted-foreground font-logik">
            Przeliczanie i zarządzanie statystykami turnieju
          </p>
        </div>
        <Button 
          onClick={handleRecalculate}
          disabled={isRecalculating}
          className="font-logik"
          style={{ backgroundColor: theme.primaryColor }}
        >
          {isRecalculating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Przeliczanie...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              {selectedCategories.length > 0 
                ? `Przelicz wybrane (${selectedCategories.length})`
                : 'Przelicz wszystko'}
            </>
          )}
        </Button>
      </div>

      {/* Progress */}
      {isRecalculating && (
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm border-2 border-primary/30">
          <CardContent className="py-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: theme.primaryColor }} />
                  <div>
                    <p className="font-logik-extended-bold">Przeliczanie statystyk</p>
                    <p className="text-sm text-muted-foreground font-logik">
                      {currentCategory}
                    </p>
                  </div>
                </div>
                <span className="font-logik-extended-bold">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={selectAll} className="font-logik">
          Zaznacz wszystko
        </Button>
        <Button variant="outline" size="sm" onClick={deselectAll} className="font-logik">
          Odznacz wszystko
        </Button>
        {selectedCategories.length > 0 && (
          <Badge variant="outline" className="font-logik">
            {selectedCategories.length} wybranych
          </Badge>
        )}
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map(category => (
          <Card 
            key={category.id}
            className={cn(
              "border-0 shadow-lg bg-card/50 backdrop-blur-sm cursor-pointer transition-all duration-200",
              category.selected && "ring-2 ring-primary bg-primary/5"
            )}
            onClick={() => toggleCategory(category.id)}
          >
            <CardContent className="py-4">
              <div className="flex items-start gap-4">
                <Checkbox
                  checked={category.selected}
                  onCheckedChange={() => toggleCategory(category.id)}
                  className="mt-1"
                />
                <div 
                  className="p-2 rounded-lg shrink-0"
                  style={{ backgroundColor: `${theme.primaryColor}20` }}
                >
                  <div style={{ color: theme.primaryColor }}>
                    {getCategoryIcon(category.id)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-logik-extended-bold">{category.name}</h3>
                  <p className="text-sm text-muted-foreground font-logik mb-2">
                    {category.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground font-logik">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {category.lastUpdated}
                    </span>
                    <span className="flex items-center gap-1">
                      <Database className="h-3 w-3" />
                      {category.recordCount} rekordów
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-logik-extended-bold">
            <BarChart3 className="h-5 w-5" style={{ color: theme.primaryColor }} />
            Informacje o statystykach
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-border">
              <p className="text-sm text-muted-foreground font-logik mb-1">Źródło danych</p>
              <p className="font-logik-extended-bold">OpenDota API</p>
            </div>
            <div className="p-4 rounded-xl border border-border">
              <p className="text-sm text-muted-foreground font-logik mb-1">Liga Valve</p>
              <p className="font-logik-extended-bold">#19206</p>
            </div>
            <div className="p-4 rounded-xl border border-border">
              <p className="text-sm text-muted-foreground font-logik mb-1">Łącznie meczów</p>
              <p className="font-logik-extended-bold">42</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-logik-extended-bold text-amber-500">Ważne</p>
                <p className="text-sm text-amber-500/80 font-logik">
                  Przeliczanie statystyk może zająć kilka minut w zależności od liczby meczów.
                  Statystyki są pobierane z OpenDota API, więc mecze muszą być najpierw sparsowane przez ich system.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
