// src/components/app/home/HomeBanner.tsx
import { Card } from "@/components/ui/card";
import Image from "next/image";

export function HomeBanner() {
    return (
        <Card className="shadow-xl relative overflow-hidden min-h-[55vh]">
            <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(/main_logo.png)` }} />
            <div className="relative z-10 flex items-center justify-center h-full min-h-[55vh] p-6">
                {/* The image is now the background */}
            </div>
        </Card>
    );
}
