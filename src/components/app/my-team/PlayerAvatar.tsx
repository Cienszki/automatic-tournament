"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getSteamAvatarUrl } from "@/lib/utils";

interface PlayerAvatarProps {
  steamProfileUrl: string;
  nickname: string;
}

export function PlayerAvatar({ steamProfileUrl, nickname }: PlayerAvatarProps) {
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchAvatar() {
      try {
        const url = await getSteamAvatarUrl(steamProfileUrl);
        setAvatarUrl(url);
      } catch (error) {
        console.error("Failed to fetch Steam avatar:", error);
        setAvatarUrl(null);
      }
    }

    if (steamProfileUrl) {
      fetchAvatar();
    }
  }, [steamProfileUrl]);

  return (
    <Avatar className="h-10 w-10">
      <AvatarImage src={avatarUrl ?? `https://placehold.co/40x40.png?text=${nickname.substring(0, 2)}`} />
      <AvatarFallback>{nickname.substring(0, 2)}</AvatarFallback>
    </Avatar>
  );
}
