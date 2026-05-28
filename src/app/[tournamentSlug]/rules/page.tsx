"use client";

import { useState, useEffect } from "react";
import { useTournament } from '@/context/TournamentContext';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ScrollText, 
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  MessageSquare,
  BookOpen,
  ExternalLink,  Info,} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

interface RuleParagraph {
  id: string;
  content: string;
  commentary?: string;
  order: number;
  parentId?: string; // For nested sub-paragraphs (e.g., 5.11.1)
}

interface RuleSection {
  id: string;
  title: string;
  order: number;
  paragraphs: RuleParagraph[];
}

/**
 * Rules page - Premium styled tournament rules and regulations
 */
export default function RulesPage() {
  const { tournament, theme, getTournamentPath } = useTournament();
  const [sections, setSections] = useState<RuleSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [openCommentaries, setOpenCommentaries] = useState<Set<string>>(new Set());

  const toggleCommentary = (id: string) => {
    setOpenCommentaries(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  // Load rules from Firestore
  useEffect(() => {
    const loadRules = async () => {
      if (!tournament?.id) {
        setLoading(false);
        return;
      }

      try {
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
          
          paragraphs.sort((a, b) => a.order - b.order);
          
          loadedSections.push({
            id: sectionDoc.id,
            title: sectionData.title || '',
            order: sectionData.order || 0,
            paragraphs,
          });
        }
        
        loadedSections.sort((a, b) => a.order - b.order);
        setSections(loadedSections);
        
        // Expand all sections by default
        setExpandedSections(new Set(loadedSections.map(s => s.id)));
        if (loadedSections.length > 0) {
          setActiveSection(loadedSections[0].id);
        }
      } catch (error) {
        console.error('[RulesPage] Error loading rules:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRules();
  }, [tournament?.id]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    if (!expandedSections.has(sectionId)) {
      setExpandedSections(prev => new Set([...prev, sectionId]));
    }
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!tournament) return null;

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="relative text-white overflow-x-hidden min-h-screen">
      {/* Premium Atmosphere Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Subtle vignette */}
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-60"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, transparent 40%, #000000 100%)',
          }}
        />

        {/* Ambient glow - top right */}
        <div
          className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.04] blur-[200px]"
          style={{ background: theme?.primaryColor || '#3b82f6' }}
        />

        {/* Ambient glow - bottom left */}
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full opacity-[0.03] blur-[150px]"
          style={{ background: theme?.secondaryColor || '#dc2626' }}
        />
      </div>

      {/* Fixed TOC Sidebar - always visible, scales with sections */}
      {sections.length > 0 && (
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden lg:flex fixed left-0 z-20 flex-col"
          style={{ top: '3.5rem', width: '16rem', height: 'calc(100vh - 3.5rem)' }}
        >
          <div className="flex flex-col h-full border-r border-white/10 bg-black/20 backdrop-blur-md">
            <div className="p-4 border-b border-white/10 shrink-0">
              <h3 className="font-logik-extended-bold flex items-center gap-2" style={{ color: theme.headingColor || theme.primaryTextColor || 'white', fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>
                <ScrollText className="w-4 h-4" style={{ color: theme.primaryColor }} />
                Spis treści
              </h3>
            </div>
            <div className="flex flex-col flex-1 min-h-0 px-2 py-1 overflow-hidden">
              {sections.map((section, index) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={cn(
                    "w-full text-left px-3 rounded-xl transition-all duration-200 group flex-1 flex items-center min-h-0",
                    activeSection === section.id ? "bg-white/10" : "hover:bg-white/5"
                  )}
                  style={{ color: activeSection === section.id ? (theme.primaryTextColor || 'white') : (theme.secondaryTextColor || '#9ca3af') }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span
                      className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-logik-extended-bold transition-colors shrink-0"
                      style={activeSection === section.id
                        ? { backgroundColor: `${theme.primaryColor}40`, color: theme.primaryColor }
                        : { color: theme.secondaryTextColor || '#6b7280' }}
                    >
                      {index + 1}
                    </span>
                    <span className="font-body text-xs leading-tight line-clamp-2 flex-1 text-left">
                      {section.title.replace(/^\d+\.\s*/, '')}
                    </span>
                    <ChevronRight
                      className={cn(
                        "w-3 h-3 transition-transform shrink-0",
                        activeSection === section.id ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                      )}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </motion.aside>
      )}

      {/* Main scrollable content - offset by TOC width on large screens */}
      <div className={cn("relative z-10", sections.length > 0 ? "lg:pl-64" : "")}>
        <div className="px-6 lg:px-10 py-8 space-y-8">
        {/* Header - Premium Hero Style */}
        <div className="text-center space-y-6 py-8 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/2 h-40 blur-[120px] rounded-full pointer-events-none"
            style={{ background: `${theme.primaryColor}20` }}
          />

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-logik-wide-black tracking-tighter uppercase relative z-10 drop-shadow-2xl"
            style={{ color: theme.titleColor || 'white', fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}
          >
            Regulamin
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-center justify-center gap-4 opacity-60"
          >
            <div className="h-[1px] w-16 bg-gradient-to-r from-transparent" style={{ backgroundImage: `linear-gradient(to right, transparent, ${theme.primaryColor})` }} />
            <div className="w-2 h-2 rotate-45 border" style={{ borderColor: theme.primaryColor }} />
            <div className="h-[1px] w-16 bg-gradient-to-l from-transparent" style={{ backgroundImage: `linear-gradient(to left, transparent, ${theme.primaryColor})` }} />
          </motion.div>
        </div>

        {sections.length === 0 ? (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-16 text-center"
          >
            <BookOpen className="w-16 h-16 mx-auto mb-6" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.2)' }} />
            <h2 className="text-2xl font-logik-extended-bold mb-3" style={{ color: theme.headingColor || theme.primaryTextColor || 'white', fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>
              Regulamin w przygotowaniu
            </h2>
            <p className="font-body font-medium max-w-md mx-auto" style={{ color: theme.secondaryTextColor || '#d1d5db' }}>
              Regulamin turnieju jest aktualnie opracowywany. Wróć wkrótce po aktualizacje.
            </p>
          </motion.div>
        ) : (
          <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="space-y-6"
            >
              {sections.map((section, sectionIndex) => (
                <motion.div
                  key={section.id}
                  id={section.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: sectionIndex * 0.05 }}
                  className="scroll-mt-24"
                >
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
                    {/* Section Header */}
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full p-6 flex items-center gap-4 hover:bg-white/5 transition-colors"
                    >
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-logik-extended-bold text-white text-lg"
                        style={{ backgroundColor: `${theme.primaryColor}30`, color: theme.primaryColor }}
                      >
                        {section.order}
                      </div>
                      <div className="flex-1 text-left">
                        <h2 className="text-xl font-logik-extended-bold" style={{ color: theme.headingColor || theme.primaryTextColor || 'white', fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>
                          {section.title}
                        </h2>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-5 h-5 text-gray-400 transition-transform duration-300",
                          expandedSections.has(section.id) ? "rotate-180" : ""
                        )}
                      />
                    </button>

                    {/* Section Content */}
                    <AnimatePresence>
                      {expandedSections.has(section.id) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-6 space-y-4">
                            {/* Render parent paragraphs and their sub-paragraphs */}
                            {section.paragraphs
                              .filter(p => !p.parentId)
                              .map((paragraph, paraIndex) => {
                                // Get sub-paragraphs for this parent
                                const subParagraphs = section.paragraphs.filter(p => p.parentId === paragraph.id);
                                
                                return (
                                  <div key={paragraph.id} className="space-y-3">
                                    {/* Parent paragraph */}
                                    <div className="flex gap-4 group">
                                      {/* Paragraph Number */}
                                      <div className="shrink-0">
                                        <span className="text-sm font-body font-medium tabular-nums" style={{ color: theme.secondaryTextColor || '#9ca3af' }}>
                                          {section.order}.{paraIndex + 1}
                                        </span>
                                      </div>

                                    {/* Paragraph Content + right margin note */}
                                      <div className="flex gap-4 flex-1 items-start">
                                        {/* Text + inline info button */}
                                        <div className="flex-1 min-w-0 flex items-start gap-1.5">
                                          <p className="font-rules-content leading-relaxed flex-1 whitespace-pre-wrap" style={{ color: theme.primaryTextColor || '#e5e7eb' }}>
                                            {paragraph.content}
                                          </p>
                                          {paragraph.commentary && (
                                            <button
                                              onClick={() => toggleCommentary(paragraph.id)}
                                              className="shrink-0 p-1 rounded-full hover:bg-white/10 transition-colors mt-0.5"
                                              style={{ color: openCommentaries.has(paragraph.id) ? theme.primaryColor : (theme.secondaryTextColor || '#6b7280') }}
                                              title="Pokaż komentarz"
                                            >
                                              <Info className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                        {/* Right margin: commentary note */}
                                        <div className="w-52 shrink-0">
                                          {paragraph.commentary && openCommentaries.has(paragraph.id) && (
                                            <div className="rounded-lg p-2.5 border" style={{ borderColor: `${theme.primaryColor}35`, backgroundColor: `${theme.primaryColor}0d` }}>
                                              <div className="flex items-start gap-1.5">
                                                <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" style={{ color: theme.primaryColor }} />
                                                <p className="text-xs font-rules-content leading-relaxed" style={{ color: theme.primaryColor }}>
                                                  {paragraph.commentary}
                                                </p>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Sub-paragraphs */}
                                    {subParagraphs.map((subParagraph, subIndex) => (
                                      <div 
                                        key={subParagraph.id} 
                                        className="flex gap-4 group ml-8 pl-4 border-l-2"
                                        style={{ borderLeftColor: `${theme.primaryColor}30` }}
                                      >
                                        {/* Sub-paragraph Number */}
                                        <div className="shrink-0">
                                          <span className="text-sm font-body font-medium tabular-nums" style={{ color: theme.secondaryTextColor || '#9ca3af' }}>
                                            {section.order}.{paraIndex + 1}.{subIndex + 1}
                                          </span>
                                        </div>

                                        {/* Sub-paragraph Content + right margin note */}
                                        <div className="flex gap-4 flex-1 items-start">
                                          {/* Text + inline info button */}
                                          <div className="flex-1 min-w-0 flex items-start gap-1.5">
                                            <p className="font-rules-content leading-relaxed flex-1 whitespace-pre-wrap" style={{ color: theme.primaryTextColor || '#e5e7eb' }}>
                                              {subParagraph.content}
                                            </p>
                                            {subParagraph.commentary && (
                                              <button
                                                onClick={() => toggleCommentary(subParagraph.id)}
                                                className="shrink-0 p-1 rounded-full hover:bg-white/10 transition-colors mt-0.5"
                                                style={{ color: openCommentaries.has(subParagraph.id) ? theme.primaryColor : (theme.secondaryTextColor || '#6b7280') }}
                                                title="Pokaż komentarz"
                                              >
                                                <Info className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>
                                          {/* Right margin: commentary note */}
                                          <div className="w-52 shrink-0">
                                            {subParagraph.commentary && openCommentaries.has(subParagraph.id) && (
                                              <div className="rounded-lg p-2.5 border" style={{ borderColor: `${theme.primaryColor}35`, backgroundColor: `${theme.primaryColor}0d` }}>
                                                <div className="flex items-start gap-1.5">
                                                  <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" style={{ color: theme.primaryColor }} />
                                                  <p className="text-xs font-rules-content leading-relaxed" style={{ color: theme.primaryColor }}>
                                                    {subParagraph.commentary}
                                                  </p>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </motion.div>
        )}

        {/* Footer Note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-center py-8 border-t border-white/10"
        >
          <p className="font-logik-readable font-medium text-sm" style={{ color: theme.secondaryTextColor || '#9ca3af' }}>
            Ostatnia aktualizacja regulaminu: {new Date().toLocaleDateString('pl-PL')}
          </p>
          <p className="font-logik-readable font-medium text-xs mt-2" style={{ color: theme.secondaryTextColor || '#6b7280' }}>
            W razie pytań dotyczących regulaminu, skontaktuj się z organizatorami turnieju.
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="h-px w-12" style={{ backgroundImage: 'linear-gradient(to right, transparent, var(--tournament-secondary-text, #9ca3af))' }} />
            <Link
              href={getTournamentPath('/privacy')}
              className="text-xs transition-opacity opacity-60 hover:opacity-100"
              style={{ color: 'var(--tournament-secondary-text, #9ca3af)' }}
            >
              Polityka Prywatności
            </Link>
            <div className="h-px w-12" style={{ backgroundImage: 'linear-gradient(to left, transparent, var(--tournament-secondary-text, #9ca3af))' }} />
          </div>
        </motion.div>
        </div>
      </div>
    </div>
  );
}
