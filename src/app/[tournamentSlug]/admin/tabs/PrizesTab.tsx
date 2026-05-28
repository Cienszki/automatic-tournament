"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, updateDoc, deleteDoc, getDocs, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadTournamentPrizesImage } from '@/lib/storage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Gift,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Trophy,
  Eye,
  EyeOff,
  GripVertical,
  ImageIcon,
  List,
  Save,
} from 'lucide-react';

interface Prize {
  id: string;
  category: string;
  description: string;
  prizeDetails: string;
  order: number;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PrizeFormData {
  category: string;
  description: string;
  prizeDetails: string;
  order: number;
  visible: boolean;
}

const DEFAULT_FORM: PrizeFormData = {
  category: '',
  description: '',
  prizeDetails: '',
  order: 0,
  visible: true,
};

/**
 * PrizesTab – admin panel for managing tournament prizes
 */
export function PrizesTab() {
  const { tournament, theme } = useTournament();
  const { user } = useAuth();
  const { toast } = useToast();

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [deletingPrize, setDeletingPrize] = useState<Prize | null>(null);
  const [formData, setFormData] = useState<PrizeFormData>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [displayMode, setDisplayMode] = useState<'list' | 'image'>('list');
  const [imageUrl, setImageUrl] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tournament?.id) return;
    loadPrizes();
    setDisplayMode(((tournament as any).prizesDisplayMode as 'list' | 'image') || 'list');
    setImageUrl((tournament as any).prizesImageUrl || '');
  }, [tournament?.id]);

  const loadPrizes = async () => {
    if (!tournament?.id) return;
    setLoading(true);
    try {
      const prizesRef = collection(db, 'tournaments', tournament.id, 'prizes');
      const q = query(prizesRef, orderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      const loaded = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Prize[];
      setPrizes(loaded);
    } catch (error) {
      console.error('Error loading prizes:', error);
      toast({ title: 'Błąd', description: 'Nie udało się załadować nagród', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingPrize(null);
    setFormData({ ...DEFAULT_FORM, order: prizes.length });
    setDialogOpen(true);
  };

  const openEditDialog = (prize: Prize) => {
    setEditingPrize(prize);
    setFormData({
      category: prize.category,
      description: prize.description,
      prizeDetails: prize.prizeDetails,
      order: prize.order,
      visible: prize.visible,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!tournament?.id || !user) return;
    if (!formData.category.trim() || !formData.prizeDetails.trim()) {
      toast({ title: 'Błąd', description: 'Kategoria i nagroda są wymagane', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      if (editingPrize) {
        const prizeRef = doc(db, 'tournaments', tournament.id, 'prizes', editingPrize.id);
        await updateDoc(prizeRef, { ...formData, updatedAt: now });
        setPrizes(prev => prev.map(p => p.id === editingPrize.id ? { ...p, ...formData, updatedAt: now } : p));
        toast({ title: 'Nagroda zaktualizowana', description: 'Zmiany zostały zapisane' });
      } else {
        const prizesRef = collection(db, 'tournaments', tournament.id, 'prizes');
        const docRef = await addDoc(prizesRef, { ...formData, createdAt: now, updatedAt: now });
        setPrizes(prev => [...prev, { id: docRef.id, ...formData, createdAt: now, updatedAt: now }]);
        toast({ title: 'Nagroda dodana', description: 'Nowa nagroda została zapisana' });
      }
      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving prize:', error);
      toast({ title: 'Błąd', description: 'Nie udało się zapisać nagrody', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!tournament?.id || !deletingPrize) return;
    try {
      await deleteDoc(doc(db, 'tournaments', tournament.id, 'prizes', deletingPrize.id));
      setPrizes(prev => prev.filter(p => p.id !== deletingPrize.id));
      toast({ title: 'Nagroda usunięta' });
    } catch (error) {
      console.error('Error deleting prize:', error);
      toast({ title: 'Błąd', description: 'Nie udało się usunąć nagrody', variant: 'destructive' });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingPrize(null);
    }
  };

  const toggleVisibility = async (prize: Prize) => {
    if (!tournament?.id) return;
    try {
      const prizeRef = doc(db, 'tournaments', tournament.id, 'prizes', prize.id);
      const newVisible = !prize.visible;
      await updateDoc(prizeRef, { visible: newVisible, updatedAt: new Date().toISOString() });
      setPrizes(prev => prev.map(p => p.id === prize.id ? { ...p, visible: newVisible } : p));
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast({ title: 'Błąd', description: 'Nie udało się zmienić widoczności', variant: 'destructive' });
    }
  };

  const handleSaveSettings = async () => {
    if (!tournament?.id) return;
    setIsSavingSettings(true);
    try {
      await updateDoc(doc(db, 'tournaments', tournament.id), {
        prizesDisplayMode: displayMode,
        prizesImageUrl: imageUrl,
      });
      toast({ title: 'Ustawienia zapisane', description: 'Tryb wyświetlania nagród został zaktualizowany' });
    } catch (error) {
      console.error('Error saving prize settings:', error);
      toast({ title: 'Błąd', description: 'Nie udało się zapisać ustawień', variant: 'destructive' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleUploadImage = async (file: File) => {
    if (!tournament?.id || !tournament?.slug) return;
    setIsUploading(true);
    try {
      const url = await uploadTournamentPrizesImage(file, tournament.slug);
      setImageUrl(url);
      await updateDoc(doc(db, 'tournaments', tournament.id), {
        prizesDisplayMode: displayMode,
        prizesImageUrl: url,
      });
      toast({ title: 'Zdjęcie przesłane', description: 'Zdjęcie nagród zostało zapisane' });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({ title: 'Błąd', description: 'Nie udało się przesłać zdjęcia', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Display Mode Settings */}
      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardHeader>
          <CardTitle style={{ color: theme.headingColor }}>Tryb wyświetlania</CardTitle>
          <CardDescription style={{ color: theme.mutedTextColor }}>
            Wybierz jak nagrody będą prezentowane uczestnikom turnieju
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <button
              onClick={() => setDisplayMode('list')}
              className="flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left"
              style={{
                borderColor: displayMode === 'list' ? theme.primaryColor : theme.borderColor,
                backgroundColor: displayMode === 'list' ? `${theme.primaryColor}12` : 'transparent',
              }}
            >
              <List
                className="h-5 w-5 flex-shrink-0"
                style={{ color: displayMode === 'list' ? theme.primaryColor : theme.mutedTextColor }}
              />
              <div>
                <p className="font-medium text-sm" style={{ color: displayMode === 'list' ? theme.primaryColor : theme.headingColor }}>Lista nagród</p>
                <p className="text-xs mt-0.5" style={{ color: theme.mutedTextColor }}>Nagrody wyświetlane jako karty z detalami</p>
              </div>
            </button>
            <button
              onClick={() => setDisplayMode('image')}
              className="flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left"
              style={{
                borderColor: displayMode === 'image' ? theme.primaryColor : theme.borderColor,
                backgroundColor: displayMode === 'image' ? `${theme.primaryColor}12` : 'transparent',
              }}
            >
              <ImageIcon
                className="h-5 w-5 flex-shrink-0"
                style={{ color: displayMode === 'image' ? theme.primaryColor : theme.mutedTextColor }}
              />
              <div>
                <p className="font-medium text-sm" style={{ color: displayMode === 'image' ? theme.primaryColor : theme.headingColor }}>Zdjęcie promocyjne</p>
                <p className="text-xs mt-0.5" style={{ color: theme.mutedTextColor }}>Jedno zdjęcie z wszystkimi nagrodami</p>
              </div>
            </button>
          </div>

          {displayMode === 'image' && (
            <div className="space-y-3">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadImage(file);
                  e.target.value = '';
                }}
              />
              {imageUrl ? (
                <div className="space-y-3">
                  <div className="rounded-xl overflow-hidden" style={{ maxHeight: '220px' }}>
                    <img
                      src={imageUrl}
                      alt="Podgląd"
                      className="w-full object-cover"
                      style={{ maxHeight: '220px' }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full"
                    style={{ borderColor: theme.borderColor, color: theme.textColor }}
                  >
                    {isUploading
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Przesyłanie...</>
                      : <><ImageIcon className="h-4 w-4 mr-2" />Zmień zdjęcie</>}
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed transition-all"
                  style={{ borderColor: theme.borderColor, color: theme.mutedTextColor }}
                >
                  {isUploading ? (
                    <><Loader2 className="h-8 w-8 animate-spin" /><span className="text-sm">Przesyłanie...</span></>
                  ) : (
                    <><ImageIcon className="h-8 w-8" /><span className="text-sm">Kliknij aby wybrać zdjęcie</span></>
                  )}
                </button>
              )}
            </div>
          )}

          <Button
            onClick={handleSaveSettings}
            disabled={isSavingSettings}
            className="w-full sm:w-auto"
            style={{ backgroundColor: theme.primaryColor, color: '#fff' }}
          >
            {isSavingSettings
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <Save className="h-4 w-4 mr-2" />}
            Zapisz ustawienia
          </Button>
        </CardContent>
      </Card>

      {/* Header */}
      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gift className="h-6 w-6" style={{ color: theme.primaryColor }} />
              <div>
                <CardTitle style={{ color: theme.headingColor }}>Nagrody</CardTitle>
                <CardDescription style={{ color: theme.mutedTextColor }}>
                  Zarządzaj nagrodami turnieju widocznymi dla uczestników
                </CardDescription>
              </div>
            </div>
            <Button onClick={openCreateDialog} style={{ backgroundColor: theme.primaryColor, color: '#fff' }}>
              <Plus className="h-4 w-4 mr-2" />
              Dodaj nagrodę
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Prizes list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: theme.primaryColor }} />
        </div>
      ) : prizes.length === 0 ? (
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardContent className="py-16 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" style={{ color: theme.mutedTextColor }} />
            <p className="text-lg font-medium" style={{ color: theme.headingColor }}>Brak skonfigurowanych nagród</p>
            <p className="text-sm mt-1" style={{ color: theme.mutedTextColor }}>
              Dodaj pierwszą nagrodę klikając przycisk powyżej.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {prizes.map((prize, index) => (
            <Card
              key={prize.id}
              style={{
                backgroundColor: theme.cardColor,
                borderColor: prize.visible ? theme.borderColor : `${theme.borderColor}60`,
                opacity: prize.visible ? 1 : 0.6,
              }}
            >
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <GripVertical className="h-5 w-5 flex-shrink-0" style={{ color: theme.mutedTextColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-sm font-bold px-2 py-0.5 rounded"
                        style={{ backgroundColor: `${theme.primaryColor}20`, color: theme.primaryColor }}
                      >
                        {prize.category}
                      </span>
                      {!prize.visible && (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: `${theme.mutedTextColor}20`, color: theme.mutedTextColor }}>
                          Ukryta
                        </span>
                      )}
                    </div>
                    <p className="font-semibold mt-1 truncate" style={{ color: theme.headingColor }}>
                      {prize.prizeDetails}
                    </p>
                    {prize.description && (
                      <p className="text-sm mt-0.5 line-clamp-1" style={{ color: theme.mutedTextColor }}>
                        {prize.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleVisibility(prize)}
                      title={prize.visible ? 'Ukryj' : 'Pokaż'}
                    >
                      {prize.visible
                        ? <Eye className="h-4 w-4" style={{ color: theme.mutedTextColor }} />
                        : <EyeOff className="h-4 w-4" style={{ color: theme.mutedTextColor }} />
                      }
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(prize)}>
                      <Edit2 className="h-4 w-4" style={{ color: theme.primaryColor }} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setDeletingPrize(prize); setDeleteDialogOpen(true); }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <DialogHeader>
            <DialogTitle style={{ color: theme.headingColor }}>
              {editingPrize ? 'Edytuj nagrodę' : 'Dodaj nagrodę'}
            </DialogTitle>
            <DialogDescription style={{ color: theme.mutedTextColor }}>
              {editingPrize ? 'Zmień szczegóły nagrody' : 'Wypełnij formularz, aby dodać nową nagrodę'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="prize-category" style={{ color: theme.textColor }}>
                Kategoria <span className="text-red-500">*</span>
              </Label>
              <Input
                id="prize-category"
                placeholder="np. 1. miejsce, Zwycięzca Fantasy, MVP"
                value={formData.category}
                onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                style={{ backgroundColor: `${theme.backgroundColor}80`, borderColor: theme.borderColor, color: theme.textColor }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prize-details" style={{ color: theme.textColor }}>
                Nagroda <span className="text-red-500">*</span>
              </Label>
              <Input
                id="prize-details"
                placeholder="np. Karta podarunkowa Steam 200 zł"
                value={formData.prizeDetails}
                onChange={e => setFormData(prev => ({ ...prev, prizeDetails: e.target.value }))}
                style={{ backgroundColor: `${theme.backgroundColor}80`, borderColor: theme.borderColor, color: theme.textColor }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prize-description" style={{ color: theme.textColor }}>
                Opis (opcjonalnie)
              </Label>
              <Textarea
                id="prize-description"
                placeholder="Dodatkowe informacje o nagrodzie..."
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                style={{ backgroundColor: `${theme.backgroundColor}80`, borderColor: theme.borderColor, color: theme.textColor }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prize-order" style={{ color: theme.textColor }}>
                Kolejność wyświetlania
              </Label>
              <Input
                id="prize-order"
                type="number"
                min={0}
                value={formData.order}
                onChange={e => setFormData(prev => ({ ...prev, order: parseInt(e.target.value, 10) || 0 }))}
                style={{ backgroundColor: `${theme.backgroundColor}80`, borderColor: theme.borderColor, color: theme.textColor }}
              />
            </div>

            <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ backgroundColor: `${theme.backgroundColor}40` }}>
              <Label htmlFor="prize-visible" style={{ color: theme.textColor }}>
                Widoczna dla uczestników
              </Label>
              <Switch
                id="prize-visible"
                checked={formData.visible}
                onCheckedChange={checked => setFormData(prev => ({ ...prev, visible: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Anuluj
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              style={{ backgroundColor: theme.primaryColor, color: '#fff' }}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingPrize ? 'Zapisz zmiany' : 'Dodaj nagrodę'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: theme.headingColor }}>Usuń nagrodę</AlertDialogTitle>
            <AlertDialogDescription style={{ color: theme.mutedTextColor }}>
              Czy na pewno chcesz usunąć nagrodę &ldquo;{deletingPrize?.category}&rdquo;? Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
