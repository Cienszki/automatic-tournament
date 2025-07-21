"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface PlayerAvatarProps {
  src?: string | null;
  nickname: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const sizeMap = {
    small: "h-10 w-10",
    medium: "h-16 w-16",
    large: "h-32 w-32",
};

export function PlayerAvatar({ src, nickname, size = 'small', className }: PlayerAvatarProps) {
  return (
    <Avatar className={cn(sizeMap[size], className)}>
      <AvatarImage src={src || `https://placehold.co/128x128.png?text=${nickname.substring(0, 2)}`} />
      <AvatarFallback>{nickname.substring(0, 2)}</AvatarFallback>
    </Avatar>
  );
}
