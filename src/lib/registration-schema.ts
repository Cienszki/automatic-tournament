
import { z } from "zod";
import { PlayerRoles } from "./definitions";

export const MAX_FILE_SIZE = 1024 * 1024; // 1MB
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// Schema for a required single file
export const requiredFileSchema = z.instanceof(File, { message: "This file is required." })
  .refine(file => file.size > 0, "File cannot be empty.")
  .refine(file => file.size <= MAX_FILE_SIZE, `Max file size is 1MB.`)
  .refine(
    file => ACCEPTED_IMAGE_TYPES.includes(file.type),
    ".jpg, .jpeg, .png and .webp files are accepted."
  );

export const playerSchema = z.object({
  nickname: z.string().min(2, "Nickname must be at least 2 characters."),
  mmr: z.string()
    .min(1, "MMR is required.")
    .regex(/^[0-9]+$/, { message: "MMR must be a whole number using only digits (e.g., 4500)." })
    .pipe(z.coerce.number()
      .int({ message: "MMR must be a whole number."})
      .positive({ message: "MMR must be greater than zero." })
    ),
  profileScreenshot: requiredFileSchema,
  steamProfileUrl: z.string().url("Invalid Steam profile URL.").min(1, "Steam profile URL is required."),
  role: z.enum(PlayerRoles, {
    errorMap: () => ({ message: "Please select a valid role for the player." }),
  }),
});

export const registrationFormSchema = z.object({
  teamName: z.string().min(3, "Team name must be at least 3 characters."),
  teamLogo: requiredFileSchema,
  teamMotto: z.string().max(150, "Team motto cannot exceed 150 characters.").optional().or(z.literal('')),
  player1: playerSchema,
  player2: playerSchema,
  player3: playerSchema,
  player4: playerSchema,
  player5: playerSchema,
  rulesAgreed: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the tournament rules to register." }),
  }),
}).refine(data => {
  const roles = [
    data.player1.role,
    data.player2.role,
    data.player3.role,
    data.player4.role,
    data.player5.role,
  ];
  const uniqueRoles = new Set(roles);
  return uniqueRoles.size === PlayerRoles.length;
}, {
  message: "Each player role (Carry, Mid, Offlane, Soft Support, Hard Support) must be assigned to exactly one player.",
  path: ["player1.role"], 
}).refine(data => {
  const steamUrls = [
    data.player1.steamProfileUrl,
    data.player2.steamProfileUrl,
    data.player3.steamProfileUrl,
    data.player4.steamProfileUrl,
    data.player5.steamProfileUrl,
  ].filter(url => url.trim() !== ""); // Filter out empty strings in case some are optional or not yet filled
  const uniqueSteamUrls = new Set(steamUrls);
  return uniqueSteamUrls.size === steamUrls.length;
}, {
  message: "Each player must have a unique Steam Profile URL within this registration.",
  // You can target a specific player's URL field or a general path
  path: ["player1.steamProfileUrl"], 
});
