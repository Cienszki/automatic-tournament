// src/components/divisions/TeamLogo.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface TeamLogoProps {
    src?: string;
    name: string;
    size?: number;
    className?: string;
    fallbackClassName?: string;
}

export function TeamLogo({
    src,
    name,
    size = 32,
    className,
    fallbackClassName
}: TeamLogoProps) {
    const [error, setError] = useState(!src);
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    if (error || !src) {
        return (
            <div
                className={cn(
                    "bg-muted rounded-md flex items-center justify-center font-bold text-muted-foreground select-none",
                    fallbackClassName
                )}
                style={{ width: size, height: size, fontSize: size * 0.4 }}
            >
                {initials}
            </div>
        );
    }

    return (
        <div className={cn("relative overflow-hidden rounded-md", className)} style={{ width: size, height: size }}>
            <Image
                src={src}
                alt={name}
                width={size}
                height={size}
                className="object-contain w-full h-full"
                onError={() => setError(true)}
                unoptimized
            />
        </div>
    );
}
