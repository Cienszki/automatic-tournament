// src/app/creator/new/page.tsx
// Tournament Creator - Step-by-step wizard

'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check,
  Loader2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createTournament, isSlugAvailable } from '@/lib/api/tournaments';

// Import step components
import { BasicInfoStep } from '@/components/creator/steps/BasicInfoStep';
import { BrandingStep } from '@/components/creator/steps/BrandingStep';
import { TournamentStructureStep } from '@/components/creator/steps/TournamentStructureStep';
import { ReviewStep } from '@/components/creator/steps/ReviewStep';

// Define steps outside component to prevent recreation on every render
const TOURNAMENT_STEPS = [
  { id: 'basic', label: 'Podstawowe Informacje', component: BasicInfoStep },
  { id: 'branding', label: 'Branding', component: BrandingStep },
  { id: 'structure', label: 'Struktura Turnieju', component: TournamentStructureStep },
  { id: 'review', label: 'Podsumowanie', component: ReviewStep },
];

export default function NewTournamentPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <NewTournamentContent />
    </Suspense>
  );
}

function NewTournamentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const template = searchParams.get('template') || 'custom';

  const [currentStep, setCurrentStep] = useState(0);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({
    template,
    basicInfo: {},
    branding: {},
    structure: {},
  });

  const CurrentStepComponent = TOURNAMENT_STEPS[currentStep].component;

  const handleNext = () => {
    if (currentStep < TOURNAMENT_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepDataChange = useCallback((stepData: any) => {
    const stepId = TOURNAMENT_STEPS[currentStep].id;
    setFormData((prev: any) => ({
      ...prev,
      [stepId]: stepData,
    }));
  }, [currentStep]);

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishError(null);

    try {
      // Validate required fields
      const basicInfo = formData.basic || {};
      if (!basicInfo.name || !basicInfo.slug || !basicInfo.organizerName) {
        setPublishError('Wypełnij wszystkie wymagane pola w podstawowych informacjach');
        setIsPublishing(false);
        return;
      }

      // Check if slug is available
      const slugAvailable = await isSlugAvailable(basicInfo.slug);
      if (!slugAvailable) {
        setPublishError(`Slug "${basicInfo.slug}" jest już zajęty. Wybierz inny.`);
        setIsPublishing(false);
        return;
      }

      // Create tournament in Firestore
      const tournamentId = await createTournament({
        basicInfo: formData.basic || {},
        branding: formData.branding || {},
        structure: formData.structure || {},
        template,
      });

      console.log('Tournament created:', tournamentId);

      // Redirect to tournament admin page (or draft preview)
      router.push(`/${basicInfo.slug}/admin?welcome=true`);
    } catch (error) {
      console.error('Error creating tournament:', error);
      setPublishError('Wystąpił błąd podczas tworzenia turnieju. Spróbuj ponownie.');
      setIsPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/creator"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Powrót</span>
            </Link>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold">Nowy Turniej</h1>
            </div>
            <div className="w-24" /> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="border-b border-border/40 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
              {TOURNAMENT_STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    onClick={() => setCurrentStep(index)}
                    disabled={index > currentStep}
                    className={cn(
                      'flex items-center gap-3 transition-all duration-200',
                      index <= currentStep ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200',
                        index < currentStep && 'bg-primary border-primary text-primary-foreground',
                        index === currentStep && 'bg-primary/10 border-primary text-primary',
                        index > currentStep && 'bg-muted border-border text-muted-foreground'
                      )}
                    >
                      {index < currentStep ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <span className="text-sm font-semibold">{index + 1}</span>
                      )}
                    </div>
                    <span
                      className={cn(
                        'hidden md:block text-sm font-medium transition-colors',
                        index <= currentStep ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {step.label}
                    </span>
                  </button>
                  {index < TOURNAMENT_STEPS.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-4 transition-colors duration-200',
                        index < currentStep ? 'bg-primary' : 'bg-border'
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-card border border-border rounded-lg p-8 shadow-lg"
            >
              <CurrentStepComponent
                data={formData[TOURNAMENT_STEPS[currentStep].id]}
                onChange={handleStepDataChange}
                allFormData={formData}
              />
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0 || isPublishing}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200',
                currentStep === 0 || isPublishing
                  ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                  : 'hover:bg-muted text-foreground'
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              Wstecz
            </button>

            <div className="flex items-center gap-4">
              {publishError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{publishError}</span>
                </div>
              )}

              {currentStep < TOURNAMENT_STEPS.length - 1 ? (
                <button
                  onClick={handleNext}
                  disabled={isPublishing}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all duration-200 disabled:opacity-50"
                >
                  Dalej
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="flex items-center gap-2 px-8 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all duration-200 disabled:opacity-50"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Tworzenie...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Opublikuj Turniej
                    </>
                  )}
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Ładowanie...</span>
      </div>
    </div>
  );
}
