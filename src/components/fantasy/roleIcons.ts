import { Swords, Sparkles, Shield as ShieldIconLucide, HandHelping, Eye as EyeIconLucide } from "lucide-react";
import type { PlayerRole } from "@/lib/definitions";

export const roleIcons: Record<PlayerRole, React.ElementType> = {
  "Carry": Swords,
  "Mid": Sparkles,
  "Offlane": ShieldIconLucide,
  "Soft Support": HandHelping,
  "Hard Support": EyeIconLucide
};
