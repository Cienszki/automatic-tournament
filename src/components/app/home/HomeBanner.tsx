// src/components/app/home/HomeBanner.tsx
"use client";

import { Card } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import Image from "next/image";

export function HomeBanner() {
    const { t } = useTranslation();
    
    return (
        <>
            {/* Desktop: show image banner with fixed height */}
            <Card className="hidden md:flex shadow-xl text-center relative overflow-hidden h-[320px] fhd:h-[320px] 2k:h-[500px] flex-col justify-center p-6">
                <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(/backgrounds/main_logo.png)` }} />
            </Card>
            {/* Mobile: show text banner with neon font */}
            <Card className="flex md:hidden shadow-xl text-center relative overflow-hidden h-[120px] flex-col justify-center items-center p-4 bg-black">
                <span className="text-3xl font-extrabold text-[#39ff14] drop-shadow-[0_0_8px_#39ff14] font-neon-bines">
                    {t('home.title')}
                </span>
            </Card>
        </>
    );
}
