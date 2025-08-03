
"use client";

import { useState, useMemo } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
  Filter,
  X
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { translations } from "@/lib/translations";

export default function FaqPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
    const data: any[] = [];
    
    categories.forEach(category => {
      try {
        // Access the translations object directly instead of using t() function
        const categoryData = (translations.faq as any)?.[category.id];
        if (categoryData && typeof categoryData === 'object') {
          const items: any[] = [];
          
          // Extract questions and answers from the category
          Object.keys(categoryData).forEach(key => {
            const item = categoryData[key];
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

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(section => section.id === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.map(section => ({
        ...section,
        items: section.items.filter((item: any) =>
          item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.answer.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(section => section.items.length > 0);
    }

    return filtered;
  }, [faqData, searchQuery, selectedCategory]);

  const totalQuestions = faqData.reduce((sum, section) => sum + section.items.length, 0);
  const filteredQuestions = filteredFaq.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <Card className="shadow-xl text-center relative overflow-hidden h-[320px] fhd:h-[320px] 2k:h-[500px] flex-col justify-center p-6">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center opacity-80" 
          style={{ backgroundImage: `url(/backgrounds/faq.png)` }} 
        />
      </Card>

      {/* Search and Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            {t("faq.searchAndFilter")}
          </CardTitle>
          <CardDescription>
            {t("faq.searchDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("faq.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-auto p-1"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Category Filter */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">{t("faq.filterByCategory")}</span>
              {selectedCategory && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className="h-6 px-2 text-xs"
                >
                  {t("faq.clearFilter")}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const Icon = category.icon;
                const isSelected = selectedCategory === category.id;
                const categorySection = faqData.find(section => section.id === category.id);
                const questionCount = categorySection?.items.length || 0;
                
                if (questionCount === 0) return null;
                
                return (
                  <Button
                    key={category.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(isSelected ? null : category.id)}
                    className="flex items-center gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {t(`faq.sections.${category.id}`)}
                    <Badge variant="secondary" className="ml-1">
                      {questionCount}
                    </Badge>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Results Summary */}
          {(searchQuery || selectedCategory) && (
            <div className="text-sm text-muted-foreground">
              {t("faq.showingResults")} {filteredQuestions} {t("faq.of")} {totalQuestions} {t("faq.questions")}
              {searchQuery && ` ${t("faq.forQuery")} "${searchQuery}"`}
              {selectedCategory && ` ${t("faq.inCategory")} "${t(`faq.sections.${selectedCategory}`)}"`}
            </div>
          )}
        </CardContent>
      </Card>

      {/* FAQ Sections */}
      {filteredFaq.length > 0 ? (
        <div className="space-y-6">
          {filteredFaq.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.id} className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className={`p-2 rounded-lg ${section.color} text-white`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {section.title}
                    <Badge variant="outline">{section.items.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {section.items.map((item: any, idx: number) => (
                      <AccordionItem 
                        value={`${section.id}-${item.id}-${idx}`} 
                        key={`${section.id}-${item.id}-${idx}`}
                      >
                        <AccordionTrigger className="text-left hover:no-underline">
                          <span className="font-medium">{item.question}</span>
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground leading-relaxed whitespace-pre-line">
                          {item.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t("faq.noResults")}</h3>
            <p className="text-muted-foreground mb-4">
              {t("faq.noResultsDescription")}
            </p>
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory(null);
              }}
            >
              {t("faq.clearAllFilters")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
