// src/app/creator/page.tsx
// Tournament Creator - Main entry page

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Trophy, Users } from 'lucide-react';
import { fadeInUp } from '@/lib/animations';

export default function CreatorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Powrót do strony głównej</span>
            </Link>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold">Tournament Creator</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 md:py-20">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="max-w-4xl mx-auto"
        >
          {/* Hero Section */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6"
            >
              <Trophy className="h-10 w-10 text-primary" />
            </motion.div>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-foreground to-primary bg-clip-text text-transparent">
              Stwórz Swój Turniej
            </h2>
            
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Platforma do organizacji turniejów Dota 2. Wybierz format, dostosuj branding, zarządzaj zespołami i matchami - wszystko w jednym miejscu.
            </p>
          </div>

          {/* Template Selection */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <TemplateCard
              title="Turniej z Limitem MMR"
              description="Turniej dla graczy casual i semi-pro z limitem MMR drużyny"
              features={[
                'Limit MMR drużyny (np. 24,000)',
                'Faza grupowa + playoff',
                'Kapitanowie planują mecze',
                'System stand-inów',
              ]}
              icon={<Users className="h-8 w-8" />}
              color="from-blue-500/20 to-cyan-500/20"
              borderColor="border-blue-500/30"
              href="/creator/new?template=mmr-limited"
            />

            <TemplateCard
              title="Liga Profesjonalna"
              description="Sezonowa liga z podziałem na dywizje, awansami i spadkami"
              features={[
                'Wiele dywizji (Elite, Challenger...)',
                'System awansów/spadków',
                'Administracyjny harmonogram',
                'Turniej finałowy',
              ]}
              icon={<Trophy className="h-8 w-8" />}
              color="from-amber-500/20 to-orange-500/20"
              borderColor="border-amber-500/30"
              href="/creator/new?template=league"
            />
          </div>

          {/* Or Custom */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              lub zacznij od czystej karty
            </p>
            <Link
              href="/creator/new?template=custom"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-all duration-200"
            >
              <Sparkles className="h-4 w-4" />
              <span>Stwórz własny format</span>
            </Link>
          </div>

          {/* Info Section */}
          <div className="mt-16 p-6 rounded-xl bg-muted/30 border border-border/40">
            <h3 className="text-lg font-semibold mb-3">Co możesz dostosować?</h3>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Branding i kolory turnieju</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Format rozgrywek i playoff</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Limity MMR i zasady drużyn</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Fantasy League i Pick'em</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>System stand-inów</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Strony z zasadami i FAQ</span>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

interface TemplateCardProps {
  title: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  href: string;
}

function TemplateCard({
  title,
  description,
  features,
  icon,
  color,
  borderColor,
  href,
}: TemplateCardProps) {
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ y: -4, scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={`
          relative p-6 rounded-xl border-2 
          bg-gradient-to-br ${color}
          ${borderColor}
          hover:shadow-xl hover:shadow-primary/5
          transition-shadow duration-300
          cursor-pointer group
          overflow-hidden
        `}
      >
        {/* Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-background/50 backdrop-blur-sm group-hover:scale-110 transition-transform duration-200">
            {icon}
          </div>
          <h3 className="text-xl font-bold">{title}</h3>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4">
          {description}
        </p>

        {/* Features */}
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <div className="w-1 h-1 rounded-full bg-primary mt-2 shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {/* Hover Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </motion.div>
    </Link>
  );
}
