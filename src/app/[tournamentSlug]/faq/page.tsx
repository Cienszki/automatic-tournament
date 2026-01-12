"use client";

import { useState, useMemo } from "react";
import { useTournament } from '@/context/TournamentContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  HelpCircle, 
  Search, 
  Users, 
  Gamepad2, 
  Calendar, 
  Settings, 
  MessageSquare, 
  Crown, 
  Award, 
  Monitor,
  X
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { translations } from "@/lib/translations";

/**
 * FAQ page - frequently asked questions
 */
export default function FaqPage() {
  const { tournament, theme } = useTournament();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  if (!tournament) return null;

  const categories = [
    { id: "general", icon: HelpCircle, color: "bg-blue-500" },
    { id: "registration", icon: Users, color: "bg-green-500" },
    { id: "gameplay", icon: Gamepad2, color: "bg-purple-500" },
    { id: "scheduling", icon: Calendar, color: "bg-orange-500" },
    { id: "technical", icon: Settings, color: "bg-gray-500" },
    { id: "communication", icon: MessageSquare, color: "bg-indigo-500" },
    { id: "fantasy", icon: Crown, color: "bg-yellow-500" },
    { id: "pickem", icon: Award, color: "bg-pink-500" },
    { id: "platform", icon: Monitor, color: "bg-cyan-500" }
  ];

  // Build FAQ data from translations
  const faqData = useMemo(() => {
    const data: { id: string; title: string; icon: typeof HelpCircle; color: string; items: { id: string; question: string; answer: string }[] }[] = [];
    
    categories.forEach(category => {
      try {
        const categoryData = (translations.faq as Record<string, unknown>)?.[category.id];
        if (categoryData && typeof categoryData === 'object') {
          const items: { id: string; question: string; answer: string }[] = [];
          
          Object.keys(categoryData as Record<string, unknown>).forEach(key => {
            const item = (categoryData as Record<string, { question?: string; answer?: string }>)[key];
            if (item && typeof item === 'object' && item.question && item.answer) {
              items.push({
                id: key,
                question: item.question,
                answer: item.answer
              });
            }
          });
          
          if (items.length > 0) {
            data.push({
              id: category.id,
              title: t(`faq.sections.${category.id}`),
              icon: category.icon,
              color: category.color,
              items
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to load FAQ data for category: ${category.id}`, error);
      }
    });
    
    return data;
  }, [t]);

  // Filter FAQ items based on search and category
  const filteredFaq = useMemo(() => {
    let filtered = faqData;

    if (selectedCategory) {
      filtered = filtered.filter(section => section.id === selectedCategory);
    }

    if (searchQuery) {
      filtered = filtered.map(section => ({
        ...section,
        items: section.items.filter(item =>
          item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.answer.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(section => section.items.length > 0);
    }

    return filtered;
  }, [faqData, selectedCategory, searchQuery]);

  const totalQuestions = faqData.reduce((sum, section) => sum + section.items.length, 0);
  const filteredQuestions = filteredFaq.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <HelpCircle className="h-8 w-8" style={{ color: theme.primaryColor }} />
        <h1 className="text-3xl font-bold">FAQ</h1>
        <Badge variant="outline">{totalQuestions} pytań</Badge>
      </div>

      {/* Search and Filter */}
      <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj w FAQ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {(searchQuery || selectedCategory) && (
              <Button 
                variant="outline" 
                onClick={() => { setSearchQuery(""); setSelectedCategory(null); }}
              >
                <X className="h-4 w-4 mr-2" />
                Wyczyść filtry
              </Button>
            )}
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            {categories.map(category => {
              const Icon = category.icon;
              const isSelected = selectedCategory === category.id;
              return (
                <Button
                  key={category.id}
                  variant={isSelected ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(isSelected ? null : category.id)}
                  className="gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {t(`faq.sections.${category.id}`)}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Results info */}
      {(searchQuery || selectedCategory) && (
        <p className="text-sm text-muted-foreground">
          Znaleziono {filteredQuestions} z {totalQuestions} pytań
        </p>
      )}

      {/* FAQ Sections */}
      {filteredFaq.length > 0 ? (
        filteredFaq.map(section => {
          const Icon = section.icon;
          return (
            <Card key={section.id} style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${section.color}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  {section.title}
                  <Badge variant="secondary" className="ml-auto">
                    {section.items.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible>
                  {section.items.map((item, index) => (
                    <AccordionItem key={item.id} value={item.id}>
                      <AccordionTrigger className="text-left">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          );
        })
      ) : (
        <Card style={{ backgroundColor: theme.cardColor, borderColor: theme.borderColor }}>
          <CardContent className="py-16 text-center">
            <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nie znaleziono pytań pasujących do wyszukiwania.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
