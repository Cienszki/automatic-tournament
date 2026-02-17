"use client";

import { useState, useEffect } from "react";
import { useTournament } from '@/context/TournamentContext';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  ScrollText, 
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Loader2,
  MessageSquare,
  BookOpen,
  ExternalLink,
  Info,
} from "lucide-react";
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
    return (
      <div className="relative text-white overflow-x-hidden min-h-screen">
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute inset-0 z-0 pointer-events-none opacity-60"
            style={{ background: 'radial-gradient(ellipse at center, transparent 0%, transparent 40%, #000000 100%)' }}
          />
        </div>
        <div className="relative z-10 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: theme.primaryColor }} />
            <p className="text-gray-300 font-logik font-medium tracking-wider uppercase text-sm">Ładowanie regulaminu...</p>
          </div>
        </div>
      </div>
    );
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
          style={{ background: '#dc2626' }}
        />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-6 lg:px-12 py-8 space-y-12">
        {/* Header - Premium Hero Style */}
        <div className="text-center space-y-6 py-12 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/2 h-40 blur-[120px] rounded-full pointer-events-none"
            style={{ background: `${theme.primaryColor}20` }}
          />

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-logik-wide-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/50 tracking-tighter uppercase relative z-10 drop-shadow-2xl"
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
            <BookOpen className="w-16 h-16 mx-auto text-white/20 mb-6" />
            <h2 className="text-2xl font-logik-extended-bold text-white mb-3">
              Regulamin w przygotowaniu
            </h2>
            <p className="text-gray-300 font-body font-medium max-w-md mx-auto">
              Regulamin turnieju jest aktualnie opracowywany. Wróć wkrótce po aktualizacje.
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar - Table of Contents */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-1"
            >
              <div className="lg:sticky lg:top-24 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
                  <div className="p-4 border-b border-white/10">
                    <h3 className="font-logik-extended-bold text-white flex items-center gap-2">
                      <ScrollText className="w-4 h-4" style={{ color: theme.primaryColor }} />
                      Spis treści
                    </h3>
                  </div>
                  <div className="p-2">
                    {sections.map((section, index) => (
                      <button
                        key={section.id}
                        onClick={() => scrollToSection(section.id)}
                        className={cn(
                          "w-full text-left px-4 py-3 rounded-xl transition-all duration-200 group",
                          activeSection === section.id 
                            ? "bg-white/10 text-white" 
                            : "text-gray-400 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span 
                            className={cn(
                              "w-6 h-6 rounded-lg flex items-center justify-center text-xs font-logik-extended-bold transition-colors",
                              activeSection === section.id ? "text-white" : "text-gray-500"
                            )}
                            style={activeSection === section.id ? { backgroundColor: `${theme.primaryColor}40` } : {}}
                          >
                            {index + 1}
                          </span>
                          <span className="font-body text-sm truncate flex-1">
                            {section.title.replace(/^\d+\.\s*/, '')}
                          </span>
                          <ChevronRight 
                            className={cn(
                              "w-4 h-4 transition-transform",
                              activeSection === section.id ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                            )} 
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Main Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="lg:col-span-3 space-y-6"
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
                        <h2 className="text-xl font-logik-extended-bold text-white">
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
                                        <span className="text-sm text-gray-400 font-body font-medium tabular-nums">
                                          {section.order}.{paraIndex + 1}
                                        </span>
                                      </div>

                                      {/* Paragraph Content */}
                                      <div className="flex-1">
                                        <div className="flex items-start gap-2">
                                          <p className="text-gray-200 font-rules-content leading-relaxed flex-1 whitespace-pre-wrap">
                                            {paragraph.content}
                                          </p>
                                          
                                          {/* Commentary Popup */}
                                          {paragraph.commentary && (
                                            <Popover>
                                              <PopoverTrigger asChild>
                                                <button
                                                  className="shrink-0 p-1.5 rounded-full transition-colors hover:bg-white/10"
                                                  style={{ color: theme.primaryColor }}
                                                  title="Pokaż komentarz"
                                                >
                                                  <Info className="w-4 h-4" />
                                                </button>
                                              </PopoverTrigger>
                                              <PopoverContent 
                                                className="w-80 p-4"
                                                style={{ 
                                                  backgroundColor: `${theme.primaryColor}15`,
                                                  borderColor: `${theme.primaryColor}40`
                                                }}
                                              >
                                                <div className="flex items-start gap-2">
                                                  <MessageSquare 
                                                    className="w-4 h-4 mt-0.5 shrink-0" 
                                                    style={{ color: theme.primaryColor }}
                                                  />
                                                  <p className="text-sm font-rules-content leading-relaxed" style={{ color: theme.primaryColor }}>
                                                    {paragraph.commentary}
                                                  </p>
                                                </div>
                                              </PopoverContent>
                                            </Popover>
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
                                          <span className="text-sm text-gray-400 font-body font-medium tabular-nums">
                                            {section.order}.{paraIndex + 1}.{subIndex + 1}
                                          </span>
                                        </div>

                                        {/* Sub-paragraph Content */}
                                        <div className="flex-1">
                                          <div className="flex items-start gap-2">
                                            <p className="text-gray-200 font-rules-content leading-relaxed flex-1 whitespace-pre-wrap">
                                              {subParagraph.content}
                                            </p>
                                            
                                            {/* Commentary Popup */}
                                            {subParagraph.commentary && (
                                              <Popover>
                                                <PopoverTrigger asChild>
                                                  <button
                                                    className="shrink-0 p-1.5 rounded-full transition-colors hover:bg-white/10"
                                                    style={{ color: theme.primaryColor }}
                                                    title="Pokaż komentarz"
                                                  >
                                                    <Info className="w-4 h-4" />
                                                  </button>
                                                </PopoverTrigger>
                                                <PopoverContent 
                                                  className="w-80 p-4"
                                                  style={{ 
                                                    backgroundColor: `${theme.primaryColor}15`,
                                                    borderColor: `${theme.primaryColor}40`
                                                  }}
                                                >
                                                  <div className="flex items-start gap-2">
                                                    <MessageSquare 
                                                      className="w-4 h-4 mt-0.5 shrink-0" 
                                                      style={{ color: theme.primaryColor }}
                                                    />
                                                    <p className="text-sm font-rules-content leading-relaxed" style={{ color: theme.primaryColor }}>
                                                      {subParagraph.commentary}
                                                    </p>
                                                  </div>
                                                </PopoverContent>
                                              </Popover>
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
          </div>
        )}

        {/* Footer Note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-center py-8 border-t border-white/10"
        >
          <p className="text-gray-400 font-logik-readable font-medium text-sm">
            Ostatnia aktualizacja regulaminu: {new Date().toLocaleDateString('pl-PL')}
          </p>
          <p className="text-gray-500 font-logik-readable font-medium text-xs mt-2">
            W razie pytań dotyczących regulaminu, skontaktuj się z organizatorami turnieju.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
