
import { z } from "zod";

export const MAX_FILE_SIZE = 1024 * 1024; // 1MB
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// Schema for a required single file
export const requiredFileSchema = z.instanceof(File, { message: "This file is required." })
  .refine(file => file.size <= MAX_FILE_SIZE, `Max file size is 1MB.`)
  .refine(
    file => ACCEPTED_IMAGE_TYPES.includes(file.type),
    ".jpg, .jpeg, .png and .webp files are accepted."
  );

// Optional file schema (if needed elsewhere, but not for current registration form fields)
export const optionalFileSchema = z.instanceof(File).optional()
  .refine(file => !file || file.size <= MAX_FILE_SIZE, `Max file size is 1MB.`)
  .refine(
    file => !file || ACCEPTED_IMAGE_TYPES.includes(file.type),
    ".jpg, .jpeg, .png and .webp files are accepted."
  );

export const playerSchema = z.object({
  nickname: z.string().min(2, "Nickname must be at least 2 characters."),
  mmr: z.string().regex(/^\d+$/, "MMR must be a number.").min(1, "MMR is required.").transform(Number),
  profileScreenshot: requiredFileSchema,
  steamProfileUrl: z.string().url("Invalid Steam profile URL.").min(1, "Steam profile URL is required."),
});

export const registrationFormSchema = z.object({
  teamName: z.string().min(3, "Team name must be at least 3 characters."),
  teamLogo: requiredFileSchema,
  player1: playerSchema,
  player2: playerSchema,
  player3: playerSchema,
  player4: playerSchema,
  player5: playerSchema,
  rulesAgreed: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the tournament rules to register." }),
  }),
});
