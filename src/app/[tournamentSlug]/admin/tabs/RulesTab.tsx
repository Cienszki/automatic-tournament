"use client";

import React, { useState, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
  type DraggableProvided,
  type DraggableStateSnapshot,
  type DraggableProvidedDragHandleProps,
} from '@hello-pangea/dnd';
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
  GripVertical,
  MessageSquare,
  Check,
  Loader2,
  Bold,
  Italic,
  Strikethrough,
  Link2,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Image,
  CornerDownRight,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, writeBatch, Timestamp } from 'firebase/firestore';
import type { RuleParagraph, RuleSection } from '@/lib/rules-numbering';
import {
  appendSubParagraph,
  moveParagraph,
  moveSubParagraph,
  normalizeParagraphs,
  renumberSections,
  reorderSections,
} from '@/lib/rules-editing';
import { applyMarkdown, type MarkdownFormat } from '@/lib/rules-markdown';
import { RuleText } from '@/components/rules/RuleText';

type DragHandleProps = DraggableProvidedDragHandleProps | null | undefined;

/** Grip that starts a drag (mouse/touch, or focus + space + arrow keys). */
function DragHandle({ handleProps, label }: { handleProps: DragHandleProps; label: string }) {
  return (
    <div
      {...handleProps}
      className="h-8 w-6 flex items-center justify-center rounded-md shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted cursor-grab active:cursor-grabbing"
      title={label}
      aria-label={label}
    >
      <GripVertical className="h-4 w-4" />
    </div>
  );
}

/** Compact chip shown under the cursor while dragging — whole chapters/paragraphs are too big to carry around. */
function DragPreview({ number, text, primaryColor }: { number: string; text: string; primaryColor: string }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-card shadow-2xl max-w-xl"
      style={{ borderColor: `${primaryColor}80` }}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm font-logik tabular-nums shrink-0" style={{ color: primaryColor }}>{number}</span>
      <span className="font-logik truncate">{text.split('\n')[0]}</span>
    </div>
  );
}

/**
 * While dragging, render the preview in a portal: the cards use backdrop-blur, which makes
 * them the containing block for the library's position:fixed drag layer (item would drift
 * away from the cursor). Same approach as the pick'em page.
 */
function renderDraggable(provided: DraggableProvided, snapshot: DraggableStateSnapshot, content: ReactNode, preview: ReactNode) {
  if (snapshot.isDragging) {
    return createPortal(
      <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>{preview}</div>,
      document.body
    );
  }
  return <div ref={provided.innerRef} {...provided.draggableProps}>{content}</div>;
}

const TOOLBAR: { format: MarkdownFormat; icon: React.ElementType; title: string }[] = [
  { format: 'h1', icon: Heading1, title: 'Nagłówek' },
  { format: 'h2', icon: Heading2, title: 'Mniejszy nagłówek' },
  { format: 'bold', icon: Bold, title: 'Pogrubienie (Ctrl+B)' },
  { format: 'italic', icon: Italic, title: 'Kursywa (Ctrl+I)' },
  { format: 'strike', icon: Strikethrough, title: 'Przekreślenie' },
  { format: 'link', icon: Link2, title: 'Link (Ctrl+K) — zaznacz tekst, potem wpisz adres' },
  { format: 'list', icon: List, title: 'Lista punktowana' },
  { format: 'orderedList', icon: ListOrdered, title: 'Lista numerowana' },
  { format: 'image', icon: Image, title: 'Obrazek (adres https://)' },
];

const SHORTCUTS: Record<string, MarkdownFormat> = { b: 'bold', i: 'italic', k: 'link' };

/**
 * Textarea with a Markdown toolbar, keyboard shortcuts and a live preview rendered exactly
 * like the public rules page (RuleText).
 */
function MarkdownField({
  label,
  value,
  onChange,
  placeholder,
  linkColor,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  linkColor: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const apply = (format: MarkdownFormat) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const edit = applyMarkdown(value, textarea.selectionStart, textarea.selectionEnd, format);
    onChange(edit.value);
    // Restore focus/selection after React re-renders the controlled textarea
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  };

  return (
    <div className="space-y-2">
      <Label className="font-logik">{label}</Label>
      <div className="flex flex-wrap items-center gap-1 p-2 border border-border border-b-0 rounded-t-lg bg-muted/50">
        {TOOLBAR.map(({ format, icon: Icon, title }, i) => (
          <React.Fragment key={format}>
            {(i === 2 || i === 5 || i === 6) && <div className="w-px h-6 bg-border mx-1" />}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              // Keep the textarea selection: don't let the button take focus on mousedown
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply(format)}
              title={title}
              aria-label={title}
            >
              <Icon className="h-4 w-4" />
            </Button>
          </React.Fragment>
        ))}
      </div>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          const format = (e.ctrlKey || e.metaKey) && !e.altKey ? SHORTCUTS[e.key.toLowerCase()] : undefined;
          if (format) { e.preventDefault(); apply(format); }
        }}
        className="font-logik resize-y rounded-t-none border-t-0 -mt-2 min-h-[100px]"
        placeholder={placeholder}
      />
      {value.trim() && (
        <div className="rounded-lg border border-dashed border-border px-3 py-2">
          <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground font-logik mb-1">Podgląd</p>
          <RuleText content={value} linkColor={linkColor} className="font-logik text-sm" />
        </div>
      )}
    </div>
  );
}

interface SubParagraphProps {
  paragraph: RuleParagraph;
  number: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onUpdate: (updates: Partial<RuleParagraph>) => void;
  onDelete: () => void;
  dragHandleProps?: DragHandleProps;
}

interface ParagraphEditorProps {
  section: RuleSection;
  paragraph: RuleParagraph;
  paragraphNumber: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onUpdate: (updates: Partial<RuleParagraph>) => void;
  onDelete: () => void;
  onAddSubParagraph: () => void;
  theme: { primaryColor: string };
  subParagraphs: SubParagraphProps[];
  dragHandleProps: DragHandleProps;
  /** A sub-paragraph is being dragged — show every paragraph's sub-list as a drop target */
  isDraggingSub: boolean;
}

/**
 * Single paragraph editor with rich text support
 */
function ParagraphEditor({
  section,
  paragraph,
  paragraphNumber,
  isEditing,
  onStartEdit,
  onStopEdit,
  onUpdate,
  onDelete,
  onAddSubParagraph,
  theme,
  subParagraphs,
  dragHandleProps,
  isDraggingSub,
}: ParagraphEditorProps) {
  return (
    <div>
      {/* Main paragraph */}
      <div
        className={cn(
          "p-4 pl-2 rounded-xl border border-border bg-background/50 flex gap-2",
          paragraph.parentId && "ml-8 border-l-2 border-l-blue-500/30"
        )}
      >
        <DragHandle handleProps={dragHandleProps} label="Przeciągnij, aby przenieść paragraf (także do innego rozdziału)" />
        <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="space-y-4">
            <MarkdownField
              label={`Treść paragrafu (${paragraphNumber})`}
              value={paragraph.content}
              onChange={(content) => onUpdate({ content })}
              placeholder="Treść paragrafu… Zaznacz tekst i użyj paska narzędzi, np. żeby wstawić link."
              linkColor={theme.primaryColor}
            />
            <MarkdownField
              label={<span className="flex items-center gap-2"><MessageSquare className="h-4 w-4" />Komentarz (opcjonalny)</span>}
              value={paragraph.commentary || ''}
              onChange={(commentary) => onUpdate({ commentary })}
              placeholder="Dodatkowe wyjaśnienie lub kontekst..."
              linkColor={theme.primaryColor}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onStopEdit}
                className="font-logik"
              >
                Gotowe
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <span className="text-sm text-muted-foreground font-logik shrink-0 tabular-nums">
              {paragraphNumber}
            </span>
            <div className="flex-1 min-w-0">
              <RuleText content={paragraph.content} linkColor={theme.primaryColor} className="font-logik" />
              {paragraph.commentary && (
                <div
                  className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-logik"
                  style={{
                    backgroundColor: `${theme.primaryColor}20`,
                    color: theme.primaryColor
                  }}
                >
                  <MessageSquare className="h-3 w-3" />
                  Ma komentarz
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* Add sub-paragraph button - only for parent paragraphs */}
              {!paragraph.parentId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onAddSubParagraph}
                  className="h-8 w-8"
                  title="Dodaj podparagraf"
                >
                  <CornerDownRight className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onStartEdit}
                className="h-8 w-8"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Sub-paragraphs — droppable so subs can be reordered or moved under another paragraph */}
      <Droppable droppableId={`subs:${paragraph.id}`} type="SUB">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "ml-8 space-y-2 rounded-xl transition-colors",
              (subParagraphs.length > 0 || isDraggingSub) && "mt-2",
              isDraggingSub && "min-h-[2.75rem] border border-dashed border-border p-1",
              snapshot.isDraggingOver && "bg-muted/40"
            )}
          >
            {subParagraphs.map((subProps, subIndex) => (
              <Draggable key={subProps.paragraph.id} draggableId={subProps.paragraph.id} index={subIndex}>
                {(dragProvided, dragSnapshot) => renderDraggable(
                  dragProvided,
                  dragSnapshot,
                  <SubParagraphEditor {...subProps} theme={theme} dragHandleProps={dragProvided.dragHandleProps} />,
                  <DragPreview number={subProps.number} text={subProps.paragraph.content} primaryColor={theme.primaryColor} />
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {isDraggingSub && subParagraphs.length === 0 && !snapshot.isDraggingOver && (
              <p className="text-xs text-muted-foreground font-logik text-center py-2.5">
                Upuść tutaj, aby dodać jako podpunkt {paragraphNumber}
              </p>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}

/**
 * Sub-paragraph editor (nested paragraphs like 5.11.1)
 */
function SubParagraphEditor({
  paragraph,
  number,
  isEditing,
  onStartEdit,
  onStopEdit,
  onUpdate,
  onDelete,
  theme,
  dragHandleProps,
}: SubParagraphProps & { theme: { primaryColor: string } }) {
  return (
    <div
      className="p-4 pl-2 rounded-xl border border-border bg-background/50 border-l-2 flex gap-2"
      style={{ borderLeftColor: `${theme.primaryColor}50` }}
    >
      <DragHandle handleProps={dragHandleProps} label="Przeciągnij, aby przenieść podpunkt (także pod inny paragraf)" />
      <div className="flex-1 min-w-0">
      {isEditing ? (
        <div className="space-y-4">
          <MarkdownField
            label={`Treść podparagrafu (${number})`}
            value={paragraph.content}
            onChange={(content) => onUpdate({ content })}
            placeholder="Treść podparagrafu… Zaznacz tekst i użyj paska narzędzi, np. żeby wstawić link."
            linkColor={theme.primaryColor}
          />
          <MarkdownField
            label={<span className="flex items-center gap-2"><MessageSquare className="h-4 w-4" />Komentarz (opcjonalny)</span>}
            value={paragraph.commentary || ''}
            onChange={(commentary) => onUpdate({ commentary })}
            placeholder="Dodatkowe wyjaśnienie lub kontekst..."
            linkColor={theme.primaryColor}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onStopEdit}
              className="font-logik"
            >
              Gotowe
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-4">
          <span className="text-sm text-muted-foreground font-logik shrink-0 tabular-nums">
            {number}
          </span>
          <div className="flex-1 min-w-0">
            <RuleText content={paragraph.content} linkColor={theme.primaryColor} className="font-logik" />
            {paragraph.commentary && (
              <div 
                className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-logik"
                style={{ 
                  backgroundColor: `${theme.primaryColor}20`,
                  color: theme.primaryColor 
                }}
              >
                <MessageSquare className="h-3 w-3" />
                Ma komentarz
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onStartEdit}
              className="h-8 w-8"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
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
  const [draggingType, setDraggingType] = useState<string | null>(null);
  // Snapshot of the last loaded/saved state — drag-and-drop makes it easy to forget to save
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const isDirty = !loading && JSON.stringify(sections) !== savedSnapshot;

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
            parentId: pDoc.data().parentId || undefined,
          }));
          
          // Sort paragraphs by order
          paragraphs.sort((a, b) => a.order - b.order);
          
          loadedSections.push({
            id: sectionDoc.id,
            title: sectionData.title || '',
            order: sectionData.order || 0,
            // Same display order, but sequential `order` values (older data had subs numbered 1..n among themselves)
            paragraphs: normalizeParagraphs(paragraphs),
          });
        }

        // Sort sections by order
        loadedSections.sort((a, b) => a.order - b.order);

        console.log('[RulesTab] Loaded sections:', loadedSections.length);
        setSections(loadedSections);
        setSavedSnapshot(JSON.stringify(loadedSections));
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
            parentId: paragraph.parentId || null,
            updatedAt: Timestamp.now(),
          }, { merge: true });
        }
      }
      
      await batch.commit();
      setSavedSnapshot(JSON.stringify(sections));
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
    // Renumber so the public page doesn't skip a chapter number
    setSections(renumberSections(sections.filter(s => s.id !== sectionId)));
  };

  const handleDragEnd = ({ type, source, destination }: DropResult) => {
    setDraggingType(null);
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    // Droppable ids are "paras:<sectionId>" / "subs:<parentParagraphId>"
    const idOf = (droppableId: string) => droppableId.slice(droppableId.indexOf(':') + 1);

    if (type === 'SECTION') {
      setSections(prev => reorderSections(prev, source.index, destination.index));
    } else if (type === 'PARAGRAPH') {
      setSections(prev => moveParagraph(prev, idOf(source.droppableId), source.index, idOf(destination.droppableId), destination.index));
    } else if (type === 'SUB') {
      setSections(prev => moveSubParagraph(prev, idOf(source.droppableId), source.index, idOf(destination.droppableId), destination.index));
    }
  };

  const addParagraph = (sectionId: string) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        const newParagraph: RuleParagraph = {
          id: `para-${Date.now()}`,
          content: 'Nowy paragraf...',
          order: s.paragraphs.length + 1,
        };
        return { ...s, paragraphs: normalizeParagraphs([...s.paragraphs, newParagraph]) };
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
          // Also delete sub-paragraphs when parent is deleted
          paragraphs: normalizeParagraphs(s.paragraphs.filter(p => p.id !== paragraphId && p.parentId !== paragraphId)),
        };
      }
      return s;
    }));
  };

  // Add a sub-paragraph to a parent paragraph
  const addSubParagraph = (sectionId: string, parentId: string) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        const newParagraph: RuleParagraph = {
          id: `para-${Date.now()}`,
          content: 'Nowy podparagraf...',
          order: 0, // assigned by appendSubParagraph
          parentId: parentId,
        };
        return { ...s, paragraphs: appendSubParagraph(s.paragraphs, parentId, newParagraph) };
      }
      return s;
    }));
  };

  // Helper to get paragraph number (e.g., "5.11" or "5.11.1")
  const getParagraphNumber = (section: RuleSection, paragraph: RuleParagraph, paraIndex: number): string => {
    if (!paragraph.parentId) {
      return `${section.order}.${paraIndex + 1}`;
    }
    
    // Find parent paragraph index
    const parentParagraphs = section.paragraphs.filter(p => !p.parentId);
    const parentIndex = parentParagraphs.findIndex(p => p.id === paragraph.parentId);
    
    // Find sub-paragraph index
    const subParagraphs = section.paragraphs.filter(p => p.parentId === paragraph.parentId);
    const subIndex = subParagraphs.findIndex(p => p.id === paragraph.id);
    
    return `${section.order}.${parentIndex + 1}.${subIndex + 1}`;
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
          {isDirty && !isSaving && (
            <span className="text-sm font-logik text-amber-500">Niezapisane zmiany</span>
          )}
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

      {sections.length > 0 && (
        <p className="text-sm text-muted-foreground font-logik flex items-center gap-1.5">
          <GripVertical className="h-4 w-4 shrink-0" />
          Przeciągnij za uchwyt, aby zmienić kolejność rozdziałów, paragrafów i podpunktów — także między rozdziałami. Numeracja aktualizuje się sama.
        </p>
      )}

      {/* Sections */}
      <DragDropContext onDragStart={start => setDraggingType(start.type)} onDragEnd={handleDragEnd}>
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
          <Droppable droppableId="sections" type="SECTION">
          {(sectionsProvided) => (
          <div ref={sectionsProvided.innerRef} {...sectionsProvided.droppableProps} className="space-y-4">
          {sections.map((section, sectionIndex) => (
            <Draggable key={section.id} draggableId={section.id} index={sectionIndex}>
            {(sectionDrag, sectionDragSnapshot) => renderDraggable(sectionDrag, sectionDragSnapshot,
            <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-4">
                  <DragHandle handleProps={sectionDrag.dragHandleProps} label="Przeciągnij, aby zmienić kolejność rozdziałów" />

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
                {/* Paragraphs - Render parent paragraphs first, then their children */}
                <Droppable droppableId={`paras:${section.id}`} type="PARAGRAPH">
                {(parasProvided, parasSnapshot) => (
                <div
                  ref={parasProvided.innerRef}
                  {...parasProvided.droppableProps}
                  className={cn(
                    "space-y-4 rounded-xl transition-colors",
                    draggingType === 'PARAGRAPH' && "min-h-[3.5rem] border border-dashed border-border p-1",
                    parasSnapshot.isDraggingOver && "bg-muted/30"
                  )}
                >
                {section.paragraphs
                  .filter(p => !p.parentId) // Only parent paragraphs
                  .map((paragraph, paraIndex) => {
                    const subParagraphs = section.paragraphs.filter(p => p.parentId === paragraph.id);
                    const paragraphNumber = getParagraphNumber(section, paragraph, paraIndex);

                    return (
                      <Draggable key={paragraph.id} draggableId={paragraph.id} index={paraIndex}>
                      {(paraDrag, paraDragSnapshot) => renderDraggable(paraDrag, paraDragSnapshot,
                      <ParagraphEditor
                        dragHandleProps={paraDrag.dragHandleProps}
                        isDraggingSub={draggingType === 'SUB'}
                        section={section}
                        paragraph={paragraph}
                        paragraphNumber={paragraphNumber}
                        isEditing={editingParagraph === paragraph.id}
                        onStartEdit={() => setEditingParagraph(paragraph.id)}
                        onStopEdit={() => setEditingParagraph(null)}
                        onUpdate={(updates) => updateParagraph(section.id, paragraph.id, updates)}
                        onDelete={() => deleteParagraph(section.id, paragraph.id)}
                        onAddSubParagraph={() => addSubParagraph(section.id, paragraph.id)}
                        theme={theme}
                        subParagraphs={subParagraphs.map((subPara, subIndex) => ({
                          paragraph: subPara,
                          number: getParagraphNumber(section, subPara, subIndex),
                          isEditing: editingParagraph === subPara.id,
                          onStartEdit: () => setEditingParagraph(subPara.id),
                          onStopEdit: () => setEditingParagraph(null),
                          onUpdate: (updates: Partial<RuleParagraph>) => updateParagraph(section.id, subPara.id, updates),
                          onDelete: () => deleteParagraph(section.id, subPara.id),
                        }))}
                      />,
                      <DragPreview number={paragraphNumber} text={paragraph.content} primaryColor={theme.primaryColor} />
                      )}
                      </Draggable>
                    );
                  })}
                {parasProvided.placeholder}
                </div>
                )}
                </Droppable>

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
            </Card>,
            <DragPreview number={`${section.order}.`} text={section.title} primaryColor={theme.primaryColor} />
            )}
            </Draggable>
          ))}
          {sectionsProvided.placeholder}
          </div>
          )}
          </Droppable>
        )}
      </div>
      </DragDropContext>

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
