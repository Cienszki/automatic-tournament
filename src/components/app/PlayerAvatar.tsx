"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Player } from "@/lib/definitions";

interface PlayerAvatarProps {
  player?: Player;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const sizeMap = {
    small: "h-10 w-10",
    medium: "h-16 w-16",
    large: "h-32 w-32",
};

export function PlayerAvatar({ player, size = 'medium', className }: PlayerAvatarProps) {
  if (!player) {
    return (
      <Avatar className={cn(sizeMap[size], className)}>
        <AvatarImage src={`https://placehold.co/128x128.png?text=??`} />
        <AvatarFallback>??</AvatarFallback>
      </Avatar>
    );
  }

  const avatarSrc = size === 'large' ? player.avatarfull : player.avatarmedium || player.avatar;
  const fallbackText = player.nickname.substring(0, 2);

  return (
    <Avatar className={cn(sizeMap[size], className)}>
      <AvatarImage src={avatarSrc || `https://placehold.co/128x128.png?text=${fallbackText}`} />
      <AvatarFallback>{fallbackText}</AvatarFallback>
    </Avatar>
  );
}
