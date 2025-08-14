
// src/components/app/DiscordUsernameModal.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/useTranslation";

interface DiscordUsernameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (username: string) => Promise<void>;
  isSubmitting: boolean;
}

export function DiscordUsernameModal({ isOpen, onClose, onSubmit, isSubmitting }: DiscordUsernameModalProps) {
  const [username, setUsername] = React.useState("");
  const { t } = useTranslation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onSubmit(username.trim());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("pickem.enterDiscordUsernameTitle")}</DialogTitle>
            <DialogDescription>
              {t("pickem.enterDiscordUsernameDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="discord-username" className="text-right">
                {t("pickem.username")}
              </Label>
              <Input
                id="discord-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("pickem.discordPlaceholder")}
                className="col-span-3"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
              {t("pickem.saveAndSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
