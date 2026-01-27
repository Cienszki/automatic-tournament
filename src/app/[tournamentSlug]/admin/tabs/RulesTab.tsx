"use client";

import React, { useState, useEffect } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { 
  BookOpen,
  Save,
  RotateCcw,
  Plus,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  MessageSquare,
  Check,
  Loader2,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, writeBatch, Timestamp } from 'firebase/firestore';

interface RuleSection {
  id: string;
  title: string;
  order: number;
  paragraphs: RuleParagraph[];
}

interface RuleParagraph {
  id: string;
  content: string;
  commentary?: string;
  order: number;
}

/**
 * Rules Tab - Chapter/paragraph editor with commentary and Firestore persistence
 */
export function RulesTab() {
  const { tournament, theme } = useTournament();
  
  const [sections, setSections] = useState<RuleSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingParagraph, setEditingParagraph] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load rules from Firestore on mount
  useEffect(() => {
    const loadRules = async () => {
      if (!tournament?.id) {
        console.log('[RulesTab] No tournament ID');
        setLoading(false);
        return;
      }

      try {
        console.log('[RulesTab] Loading rules for tournament:', tournament.id);
        const rulesRef = collection(db, 'tournaments', tournament.id, 'rules');
        const rulesSnapshot = await getDocs(rulesRef);
        
        const loadedSections: RuleSection[] = [];
        
        for (const sectionDoc of rulesSnapshot.docs) {
          const sectionData = sectionDoc.data();
          
          // Load paragraphs subcollection
          const paragraphsRef = collection(db, 'tournaments', tournament.id, 'rules', sectionDoc.id, 'paragraphs');
          const paragraphsSnapshot = await getDocs(paragraphsRef);
          
          const paragraphs: RuleParagraph[] = paragraphsSnapshot.docs.map(pDoc => ({
            id: pDoc.id,
            content: pDoc.data().content || '',
            commentary: pDoc.data().commentary || undefined,
            order: pDoc.data().order || 0,
          }));
          
          // Sort paragraphs by order
          paragraphs.sort((a, b) => a.order - b.order);
          
          loadedSections.push({
            id: sectionDoc.id,
            title: sectionData.title || '',
            order: sectionData.order || 0,
            paragraphs,
          });
        }
        
        // Sort sections by order
        loadedSections.sort((a, b) => a.order - b.order);
        
        console.log('[RulesTab] Loaded sections:', loadedSections.length);
        setSections(loadedSections);
      } catch (error) {
        console.error('[RulesTab] Error loading rules:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRules();
  }, [tournament?.id]);

  // Save all rules to Firestore
  const handleSave = async () => {
    if (!tournament?.id) return;
    
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      
      // First, get existing sections to delete ones that were removed
      const existingRulesRef = collection(db, 'tournaments', tournament.id, 'rules');
      const existingSnapshot = await getDocs(existingRulesRef);
      
      const existingSectionIds = new Set(existingSnapshot.docs.map(d => d.id));
      const currentSectionIds = new Set(sections.map(s => s.id));
      
      // Delete sections that no longer exist
      for (const sectionId of existingSectionIds) {
        if (!currentSectionIds.has(sectionId)) {
          // Delete all paragraphs first
          const paragraphsRef = collection(db, 'tournaments', tournament.id, 'rules', sectionId, 'paragraphs');
          const paragraphsSnapshot = await getDocs(paragraphsRef);
          for (const pDoc of paragraphsSnapshot.docs) {
            batch.delete(pDoc.ref);
          }
          // Delete section
          batch.delete(doc(db, 'tournaments', tournament.id, 'rules', sectionId));
        }
      }
      
      // Save/update all current sections
      for (const section of sections) {
        const sectionRef = doc(db, 'tournaments', tournament.id, 'rules', section.id);
        batch.set(sectionRef, {
          title: section.title,
          order: section.order,
          updatedAt: Timestamp.now(),
        }, { merge: true });
        
        // Get existing paragraphs for this section
        const existingParagraphsRef = collection(db, 'tournaments', tournament.id, 'rules', section.id, 'paragraphs');
        const existingParagraphsSnapshot = await getDocs(existingParagraphsRef);
        const existingParagraphIds = new Set(existingParagraphsSnapshot.docs.map(d => d.id));
        const currentParagraphIds = new Set(section.paragraphs.map(p => p.id));
        
        // Delete paragraphs that no longer exist
        for (const paragraphId of existingParagraphIds) {
          if (!currentParagraphIds.has(paragraphId)) {
            batch.delete(doc(db, 'tournaments', tournament.id, 'rules', section.id, 'paragraphs', paragraphId));
          }
        }
        
        // Save/update all current paragraphs
        for (const paragraph of section.paragraphs) {
          const paragraphRef = doc(db, 'tournaments', tournament.id, 'rules', section.id, 'paragraphs', paragraph.id);
          batch.set(paragraphRef, {
            content: paragraph.content,
            commentary: paragraph.commentary || null,
            order: paragraph.order,
            updatedAt: Timestamp.now(),
          }, { merge: true });
        }
      }
      
      await batch.commit();
      console.log('[RulesTab] Rules saved successfully');
    } catch (error) {
      console.error('[RulesTab] Error saving rules:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const addSection = () => {
    const newOrder = sections.length + 1;
    const newSection: RuleSection = {
      id: `section-${Date.now()}`,
      title: `${newOrder}. Nowy rozdział`,
      order: newOrder,
      paragraphs: [],
    };
    setSections([...sections, newSection]);
    setEditingSection(newSection.id);
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setSections(sections.map(s => 
      s.id === sectionId ? { ...s, title } : s
    ));
  };

  const deleteSection = (sectionId: string) => {
    setSections(sections.filter(s => s.id !== sectionId));
  };

  const moveSection = (sectionId: string, direction: 'up' | 'down') => {
    const index = sections.findIndex(s => s.id === sectionId);
    if (direction === 'up' && index > 0) {
      const newSections = [...sections];
      [newSections[index], newSections[index - 1]] = [newSections[index - 1], newSections[index]];
      newSections.forEach((s, i) => s.order = i + 1);
      setSections(newSections);
    } else if (direction === 'down' && index < sections.length - 1) {
      const newSections = [...sections];
      [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
      newSections.forEach((s, i) => s.order = i + 1);
      setSections(newSections);
    }
  };

  const addParagraph = (sectionId: string) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        const newOrder = s.paragraphs.length + 1;
        const newParagraph: RuleParagraph = {
          id: `para-${Date.now()}`,
          content: 'Nowy paragraf...',
          order: newOrder,
        };
        return { ...s, paragraphs: [...s.paragraphs, newParagraph] };
      }
      return s;
    }));
  };

  const updateParagraph = (sectionId: string, paragraphId: string, updates: Partial<RuleParagraph>) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          paragraphs: s.paragraphs.map(p => 
            p.id === paragraphId ? { ...p, ...updates } : p
          ),
        };
      }
      return s;
    }));
  };

  const deleteParagraph = (sectionId: string, paragraphId: string) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          paragraphs: s.paragraphs.filter(p => p.id !== paragraphId),
        };
      }
      return s;
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-logik-extended-bold">Regulamin</h2>
          <p className="text-muted-foreground font-logik">
            Edytor regulaminu z rozdziałami i komentarzami
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline"
            onClick={addSection}
            className="font-logik"
          >
            <Plus className="h-4 w-4 mr-2" />
            Dodaj rozdział
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="font-logik"
            style={{ backgroundColor: theme.primaryColor }}
          >
            {isSaving ? (
              <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Zapisz zmiany
          </Button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.length === 0 ? (
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-logik-extended-bold mb-2">Brak regulaminu</p>
              <p className="text-muted-foreground font-logik mb-4">
                Dodaj pierwszy rozdział aby rozpocząć tworzenie regulaminu
              </p>
              <Button onClick={addSection} className="font-logik">
                <Plus className="h-4 w-4 mr-2" />
                Dodaj rozdział
              </Button>
            </CardContent>
          </Card>
        ) : (
          sections.map((section, sectionIndex) => (
            <Card key={section.id} className="border-0 shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-4">
                  {/* Move buttons */}
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveSection(section.id, 'up')}
                      disabled={sectionIndex === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveSection(section.id, 'down')}
                      disabled={sectionIndex === sections.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Section Title */}
                  <div className="flex-1">
                    {editingSection === section.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={section.title}
                          onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                          className="font-logik-extended-bold text-lg"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingSection(null)}
                          className="text-green-500"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CardTitle className="font-logik-extended-bold">{section.title}</CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingSection(section.id)}
                          className="h-8 w-8"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <CardDescription className="font-logik">
                      {section.paragraphs.length} paragrafów
                    </CardDescription>
                  </div>

                  {/* Delete Section */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteSection(section.id)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Paragraphs */}
                {section.paragraphs.map((paragraph, paraIndex) => (
                  <div 
                    key={paragraph.id}
                    className="p-4 rounded-xl border border-border bg-background/50"
                  >
                    {editingParagraph === paragraph.id ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="font-logik">Treść paragrafu</Label>
                          <Textarea
                            value={paragraph.content}
                            onChange={(e) => updateParagraph(section.id, paragraph.id, { content: e.target.value })}
                            className="font-logik resize-none"
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="font-logik flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Komentarz (opcjonalny)
                          </Label>
                          <Textarea
                            value={paragraph.commentary || ''}
                            onChange={(e) => updateParagraph(section.id, paragraph.id, { commentary: e.target.value })}
                            placeholder="Dodatkowe wyjaśnienie lub kontekst..."
                            className="font-logik resize-none text-sm"
                            rows={2}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingParagraph(null)}
                            className="font-logik"
                          >
                            Gotowe
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-4">
                        <span className="text-sm text-muted-foreground font-logik shrink-0">
                          {section.order}.{paraIndex + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-logik">{paragraph.content}</p>
                          {paragraph.commentary && (
                            <div className="mt-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                              <p className="text-sm text-blue-400 font-logik flex items-start gap-2">
                                <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                                {paragraph.commentary}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingParagraph(paragraph.id)}
                            className="h-8 w-8"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteParagraph(section.id, paragraph.id)}
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add Paragraph Button */}
                <Button
                  variant="outline"
                  onClick={() => addParagraph(section.id)}
                  className="w-full font-logik border-dashed"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj paragraf
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Preview Link */}
      {sections.length > 0 && (
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-logik-extended-bold">Podgląd regulaminu</p>
                <p className="text-sm text-muted-foreground font-logik">
                  Zobacz jak regulamin wygląda dla użytkowników
                </p>
              </div>
              <Button variant="outline" className="font-logik" asChild>
                <a href={`/${tournament?.slug}/rules`} target="_blank" rel="noopener noreferrer">
                  Otwórz podgląd →
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
