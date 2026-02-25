"use client";

import { motion } from 'framer-motion';
import { useTournament } from '@/context/TournamentContext';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Trophy, 
  Users, 
  Calendar, 
  ArrowUpDown, 
  Tv, 
  MessageCircle,
  ChevronRight,
  Star,
  Target,
  Zap,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { organizationConfig } from '@/config/organization';

/**
 * About PDL page - basic explanation of the tournament
 */
export default function AboutPage() {
  const { tournament, getTournamentPath, theme } = useTournament();

  if (!tournament) return null;

  const logoUrl = tournament.theme?.logoUrl || '/logos/pdl/pdl-s1-logo.png';

  // Derive format table from tournament config
  const matchFmt = (tournament.defaultMatchFormat ?? 'bo2').toUpperCase();
  const divisionCount = tournament.divisions?.length ?? 3;
  const format = tournament.type === 'league'
    ? [
        { label: 'Format meczów', value: `${matchFmt} (liga), BO3 (playoff)` },
        { label: 'Liczba dywizji', value: String(divisionCount) },
        { label: 'Drużyn w dywizji', value: '6-8' },
        { label: 'Czas trwania sezonu', value: '~4 miesiące' },
        { label: 'Dzień meczowy', value: 'Środa/Czwartek 20:00' },
      ]
    : [
        { label: 'Format meczów', value: `${matchFmt} (faza grupowa), BO3 (playoff)` },
        { label: 'Liczba grup', value: String(tournament.groupsCount ?? 4) },
        { label: 'Drużyn w grupie', value: String(tournament.teamsPerGroup ?? 4) },
        { label: 'Limit MMR', value: (tournament.mmrCap ?? 24000).toLocaleString('pl-PL') },
        { label: 'Awans do playoffów', value: `${tournament.playoffs?.teamsCount ?? 8} drużyn` },
      ];

  const features = [
    {
      icon: <Trophy className="h-8 w-8" />,
      title: 'System dywizji',
      description: 'Liga podzielona na dywizje: Elite, Challenger i Adept. Każda drużyna może awansować lub spaść w zależności od wyników.',
      color: '#FFD700'
    },
    {
      icon: <Calendar className="h-8 w-8" />,
      title: 'Regularne mecze',
      description: 'Mecze odbywają się co tydzień w ustalonych terminach. Elite gra w czwartki, pozostałe dywizje w środy o 20:00.',
      color: '#8B1538'
    },
    {
      icon: <ArrowUpDown className="h-8 w-8" />,
      title: 'Awanse i spadki',
      description: 'Po każdej rundzie najlepsze drużyny awansują do wyższej dywizji, a najsłabsze spadają niżej.',
      color: '#C0C0C0'
    },
    {
      icon: <Tv className="h-8 w-8" />,
      title: 'Transmisje na żywo',
      description: 'Wybrane mecze są transmitowane na żywo na kanale polishdota2inhouse na Twitchu.',
      color: '#9146FF'
    },
    {
      icon: <Target className="h-8 w-8" />,
      title: 'Fantasy & Pick\'em',
      description: 'Weź udział w Fantasy League i Pick\'em, aby zdobyć dodatkowe nagrody i rywalizować z innymi kibicami.',
      color: '#06b6d4'
    },
    {
      icon: <Users className="h-8 w-8" />,
      title: 'Społeczność',
      description: 'Dołącz do naszego Discorda, aby być na bieżąco z ogłoszeniami i poznać innych graczy.',
      color: '#7289da'
    }
  ];

  // format is computed above from tournament config

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d0f] via-[#121215] to-[#0d0d0f]" />
        <motion.div
          className="absolute inset-0 opacity-20"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(139, 21, 56, 0.2) 0%, transparent 60%)',
          }}
        />
      </div>

      {/* Hero Section */}
      <section className="relative py-16">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              className="inline-block mb-6"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Image
                src={logoUrl}
                alt={tournament.name}
                width={200}
                height={200}
                className="mx-auto"
                unoptimized
              />
            </motion.div>
            
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-white via-[#d4d4d4] to-[#8B1538] bg-clip-text text-transparent">
                  Czym jest {tournament.shortName || tournament.name}?
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-[#a0a0a0] leading-relaxed mb-8">
              {tournament.description || 'Turniej organizowany przez polską społeczność Dota 2.'}
            </p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href={getTournamentPath('/register')}
                  className={cn(
                    "inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg",
                    "bg-gradient-to-r from-[#8B1538] via-[#A91D45] to-[#8B1538] text-white",
                    "shadow-lg shadow-[#8B1538]/40 hover:shadow-xl hover:shadow-[#8B1538]/50",
                    "transition-all duration-300"
                  )}
                >
                  <Users className="h-6 w-6" />
                  Zarejestruj drużynę
                </Link>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href={getTournamentPath('/rules')}
                  className={cn(
                    "inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg",
                    "bg-[#1e1e24] border border-[#3a3a44] text-white",
                    "hover:bg-[#2a2a34] transition-all duration-300"
                  )}
                >
                  <Shield className="h-6 w-6" />
                  Zobacz regulamin
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-12">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1a1a1f]/50 to-transparent" />
        
        <div className="container mx-auto px-4 relative">
          <motion.h2 
            className="text-3xl font-bold text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="bg-gradient-to-r from-white to-[#8B1538] bg-clip-text text-transparent">
              Dlaczego warto dołączyć?
            </span>
          </motion.h2>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                variants={fadeInUp}
                className="group relative"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className={cn(
                  "relative p-6 rounded-2xl overflow-hidden h-full",
                  "bg-gradient-to-br from-[#1e1e24] to-[#16161a]",
                  "border border-[#2a2a32]",
                  "transition-all duration-300",
                  "hover:border-[#3a3a44]",
                  "shadow-lg shadow-black/30"
                )}>
                  {/* Glow effect on hover */}
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: `radial-gradient(circle at center, ${feature.color}10 0%, transparent 70%)`
                    }}
                  />
                  
                  <div className="relative">
                    <motion.div 
                      className="p-3 rounded-xl inline-block mb-4"
                      style={{ backgroundColor: `${feature.color}20` }}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                    >
                      <div style={{ color: feature.color }}>
                        {feature.icon}
                      </div>
                    </motion.div>
                    
                    <h3 className="text-xl font-bold mb-3 text-white">
                      {feature.title}
                    </h3>
                    
                    <p className="text-[#808090] leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Format Section */}
      <section className="relative py-12">
        <div className="container mx-auto px-4">
          <motion.div
            className="max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className={cn(
              "rounded-2xl overflow-hidden",
              "bg-gradient-to-br from-[#1e1e24] to-[#16161a]",
              "border border-[#2a2a32]",
              "shadow-lg shadow-black/30"
            )}>
              <div className="p-6 border-b border-[#2a2a32] bg-gradient-to-r from-[#8B1538]/20 to-transparent">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Zap className="h-6 w-6 text-[#8B1538]" />
                  Format ligi
                </h3>
              </div>
              
              <div className="p-6 space-y-4">
                {format.map((item, index) => (
                  <motion.div
                    key={item.label}
                    className="flex items-center justify-between py-3 border-b border-[#2a2a32]/50 last:border-0"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                  >
                    <span className="text-[#808090]">{item.label}</span>
                    <span className="font-bold text-white">{item.value}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-16">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <h2 className="text-3xl font-bold mb-4 text-white">
              Gotowy na wyzwanie?
            </h2>
            <p className="text-[#a0a0a0] mb-8 max-w-xl mx-auto">
              Zarejestruj swoją drużynę i dołącz do najlepszej polskiej ligi Dota 2!
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href={getTournamentPath('/register')}
                  className={cn(
                    "inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg",
                    "bg-gradient-to-r from-[#8B1538] via-[#A91D45] to-[#8B1538] text-white",
                    "shadow-lg shadow-[#8B1538]/40"
                  )}
                >
                  <Trophy className="h-6 w-6" />
                  Zarejestruj drużynę
                  <ChevronRight className="h-5 w-5" />
                </Link>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href={tournament?.discordUrl || organizationConfig.defaults.discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg text-white"
                  )}
                  style={{
                    background: '#7289da',
                    boxShadow: '0 8px 32px rgba(114, 137, 218, 0.3)'
                  }}
                >
                  <MessageCircle className="h-6 w-6" />
                  Dołącz do Discorda
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
