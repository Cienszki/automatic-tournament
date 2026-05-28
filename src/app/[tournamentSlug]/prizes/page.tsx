"use client";

import { useState, useEffect } from "react";
import { useTournament } from "@/context/TournamentContext";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion } from "framer-motion";
import { Trophy, Medal, Star, Loader2, Award } from "lucide-react";

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

function getPrizeTier(category: string): "gold" | "silver" | "bronze" | "special" {
  const lower = category.toLowerCase();
  if (lower.includes("1.") || lower.includes("1 ") || lower.includes("pierwsze") || lower.includes("winner") || lower.includes("mistrz")) return "gold";
  if (lower.includes("2.") || lower.includes("2 ") || lower.includes("drugie") || lower.includes("runner")) return "silver";
  if (lower.includes("3.") || lower.includes("3 ") || lower.includes("trzecie")) return "bronze";
  return "special";
}

const TIER_CONFIG = {
  gold: {
    icon: Trophy,
    gradient: "linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,165,0,0.05) 100%)",
    borderGlow: "rgba(255,215,0,0.4)",
    iconColor: "#FFD700",
    badgeGradient: "linear-gradient(135deg, #FFD700, #FFA500)",
    badgeTextColor: "#1a0f00",
    scale: 1,
  },
  silver: {
    icon: Medal,
    gradient: "linear-gradient(135deg, rgba(192,192,192,0.15) 0%, rgba(169,169,169,0.05) 100%)",
    borderGlow: "rgba(192,192,192,0.4)",
    iconColor: "#C0C0C0",
    badgeGradient: "linear-gradient(135deg, #C0C0C0, #A8A8A8)",
    badgeTextColor: "#1a1a1a",
    scale: 0.97,
  },
  bronze: {
    icon: Award,
    gradient: "linear-gradient(135deg, rgba(205,127,50,0.15) 0%, rgba(184,115,51,0.05) 100%)",
    borderGlow: "rgba(205,127,50,0.4)",
    iconColor: "#CD7F32",
    badgeGradient: "linear-gradient(135deg, #CD7F32, #B87333)",
    badgeTextColor: "#fff",
    scale: 0.94,
  },
  special: {
    icon: Star,
    gradient: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, transparent 100%)",
    borderGlow: "transparent",
    iconColor: "var(--tournament-primary, #6366f1)",
    badgeGradient: "var(--tournament-primary, #6366f1)",
    badgeTextColor: "#fff",
    scale: 0.92,
  },
};

interface PrizeCardProps {
  prizes: Prize[];
  index: number;
  theme: ReturnType<typeof useTournament>["theme"];
}

function PrizeCard({ prizes, index, theme }: PrizeCardProps) {
  const category = prizes[0].category;
  const tier = getPrizeTier(category);
  const config = TIER_CONFIG[tier];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div
        className="relative rounded-2xl overflow-hidden group cursor-default"
        style={{
          background: config.gradient,
          border: `1px solid ${config.borderGlow}`,
          boxShadow: tier !== "special"
            ? `0 4px 24px ${config.borderGlow}, 0 0 0 1px ${config.borderGlow}40`
            : `0 4px 16px rgba(0,0,0,0.2)`,
          backgroundColor: theme.cardColor,
          transform: `scale(${config.scale})`,
          transformOrigin: "center",
        }}
      >
        {/* Glow overlay on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${config.borderGlow} 0%, transparent 70%)`,
          }}
        />

        {/* Top shimmer bar */}
        {tier !== "special" && (
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: config.badgeGradient }}
          />
        )}

        <div className="relative p-6 sm:p-8">
          {/* Category badge + icon row */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
              style={{
                background: config.badgeGradient,
                color: config.badgeTextColor,
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {category}
            </span>

            {/* Large decorative icon */}
            <div
              className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: `${config.iconColor}18` }}
            >
              <Icon
                className="h-7 w-7"
                style={{ color: config.iconColor }}
              />
            </div>
          </div>

          {/* Prize items — multiple per position supported */}
          <div className="space-y-3">
            {prizes.map((prize, i) => (
              <div key={prize.id}>
                <p
                  className="text-xl font-bold leading-snug"
                  style={{ color: theme.headingColor }}
                >
                  {prize.prizeDetails}
                </p>
                {prize.description && (
                  <p
                    className="text-sm leading-relaxed mt-1"
                    style={{ color: theme.mutedTextColor }}
                  >
                    {prize.description}
                  </p>
                )}
                {i < prizes.length - 1 && (
                  <div className="h-px mt-3" style={{ backgroundColor: `${config.borderGlow}40` }} />
                )}
              </div>
            ))}
          </div>

          {/* Decorative bottom corner */}
          <div
            className="absolute bottom-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity"
            style={{ color: config.iconColor }}
          >
            <Icon className="h-16 w-16" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function PrizesPage() {
  const { tournament, theme } = useTournament();
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournament?.id) return;
    const load = async () => {
      try {
        const prizesRef = collection(db, "tournaments", tournament.id, "prizes");
        const q = query(prizesRef, orderBy("order", "asc"));
        const snapshot = await getDocs(q);
        const loaded = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }) as Prize)
          .filter(p => p.visible !== false);
        setPrizes(loaded);
      } catch (error) {
        console.error("Error loading prizes:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tournament?.id]);

  if (!tournament) return null;

  return (
    <div className="relative text-white overflow-x-hidden">
      {/* Atmospheric background - matches teams/stats pages */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-60"
          style={{
            background: "radial-gradient(ellipse at center, transparent 0%, transparent 40%, #000000 100%)",
          }}
        />
        <div
          className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.04] blur-[200px]"
          style={{ background: theme.primaryColor }}
        />
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full opacity-[0.03] blur-[150px]"
          style={{ background: theme.secondaryColor }}
        />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 pt-2 pb-4 space-y-4">
        {/* Hero header - matches teams/stats style */}
        <div className="text-center space-y-4 pt-2 pb-2 relative">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-32 blur-[100px] rounded-full pointer-events-none"
            style={{ background: `${theme.primaryColor}0D` }}
          />
          <h1
            className="text-6xl md:text-7xl font-logik-wide-black tracking-tighter uppercase relative z-10 drop-shadow-2xl"
            style={{ color: (theme as any).titleColor || theme.textColor || "#ffffff" }}
          >
            Nagrody
          </h1>
          <div className="flex items-center justify-center gap-4 opacity-60">
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-[var(--tournament-primary)]" />
            <div className="w-2 h-2 rotate-45 border border-[var(--tournament-primary)]" />
            <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-[var(--tournament-primary)]" />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin" style={{ color: theme.primaryColor }} />
          </div>
        ) : (tournament as any).prizesDisplayMode === 'image' && (tournament as any).prizesImageUrl ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="w-full flex items-center justify-center"
          >
            <img
              src={(tournament as any).prizesImageUrl}
              alt="Nagrody turnieju"
              className="w-full h-auto block object-contain"
              style={{
                aspectRatio: '2 / 1',
                maxHeight: 'calc(100dvh - 240px)',
                minHeight: '180px',
              }}
            />
          </motion.div>
        ) : prizes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center py-20 px-4"
          >
            <Trophy
              className="h-16 w-16 mx-auto mb-4 opacity-20"
              style={{ color: theme.mutedTextColor }}
            />
            <p className="text-lg font-semibold" style={{ color: theme.headingColor }}>
              Nagrody zostaną ogłoszone wkrótce
            </p>
            <p className="text-sm mt-2" style={{ color: theme.mutedTextColor }}>
              Administrator turnieju ogłosi nagrody przed rozpoczęciem zawodów.
            </p>
          </motion.div>
        ) : (
          <div>
            {(() => {
              // Group prizes by category, preserving order of first occurrence
              const categoryOrder: string[] = [];
              const grouped: Record<string, Prize[]> = {};
              for (const prize of prizes) {
                if (!grouped[prize.category]) {
                  grouped[prize.category] = [];
                  categoryOrder.push(prize.category);
                }
                grouped[prize.category].push(prize);
              }
              const topGroups = categoryOrder
                .map((cat, i) => ({ category: cat, prizes: grouped[cat], i }))
                .filter(g => getPrizeTier(g.category) !== 'special');
              const specialGroups = categoryOrder
                .map((cat, i) => ({ category: cat, prizes: grouped[cat], i }))
                .filter(g => getPrizeTier(g.category) === 'special');

              return (
                <>
                  {topGroups.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {topGroups.map((group, i) => (
                        <PrizeCard key={group.category} prizes={group.prizes} index={i} theme={theme} />
                      ))}
                    </div>
                  )}

                  {specialGroups.length > 0 && (
                    <>
                      {topGroups.length > 0 && (
                        <div className="flex items-center gap-4 mt-10 mb-6">
                          <div className="h-px flex-1" style={{ backgroundColor: theme.borderColor }} />
                          <span
                            className="text-sm font-semibold uppercase tracking-widest"
                            style={{ color: theme.mutedTextColor }}
                          >
                            Wyróżnienia specjalne
                          </span>
                          <div className="h-px flex-1" style={{ backgroundColor: theme.borderColor }} />
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {specialGroups.map((group, i) => (
                          <PrizeCard
                            key={group.category}
                            prizes={group.prizes}
                            index={topGroups.length + i}
                            theme={theme}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
