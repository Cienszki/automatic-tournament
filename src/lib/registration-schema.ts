import { z } from "zod";

export const MAX_FILE_SIZE = 1024 * 1024; // 1MB
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export const fileSchema = z.instanceof(File).optional()
  .refine(file => !file || file.size <= MAX_FILE_SIZE, `Max file size is 1MB.`)
  .refine(
    file => !file || ACCEPTED_IMAGE_TYPES.includes(file.type),
    ".jpg, .jpeg, .png and .webp files are accepted."
  );

export const playerSchema = z.object({
  nickname: z.string().min(2, "Nickname must be at least 2 characters."),
  mmr: z.string().regex(/^\d+$/, "MMR must be a number.").transform(Number),
  profileScreenshot: fileSchema,
  steamProfileUrl: z.string().url("Invalid Steam profile URL."),
});

export const registrationFormSchema = z.object({
  teamName: z.string().min(3, "Team name must be at least 3 characters."),
  teamLogo: fileSchema,
  player1: playerSchema,
  player2: playerSchema,
  player3: playerSchema,
  player4: playerSchema,
  player5: playerSchema,
});
